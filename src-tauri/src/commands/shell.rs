use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

pub struct ProcessState {
    pub active_pid: Mutex<Option<u32>>,
    pub background: Mutex<HashMap<String, u32>>,
}

#[tauri::command]
pub fn check_dangerous_command(command: String) -> bool {
    crate::security::is_dangerous_command(&command)
}

#[tauri::command]
pub fn kill_process(state: State<'_, ProcessState>) -> Result<(), String> {
    let pid = state.active_pid.lock().unwrap();
    if let Some(p) = *pid {
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("taskkill")
                .args(["/PID", &p.to_string(), "/F"])
                .output()
                .map_err(|e| format!("Failed to kill process: {}", e))?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            std::process::Command::new("kill")
                .arg(p.to_string())
                .output()
                .map_err(|e| format!("Failed to kill process: {}", e))?;
        }
        Ok(())
    } else {
        Err("No active process".into())
    }
}

#[derive(serde::Serialize)]
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Run a shell command and return its full output.
/// Uses std::process::Command directly — no Tauri shell plugin scope needed.
#[tauri::command]
pub async fn run_shell_command(
    cwd: String,
    command: String,
    state: State<'_, ProcessState>,
) -> Result<CommandOutput, String> {
    let (shell, flag) = if cfg!(target_os = "windows") {
        ("cmd", "/C")
    } else {
        ("sh", "-c")
    };

    let child = std::process::Command::new(shell)
        .arg(flag)
        .arg(&command)
        .current_dir(&cwd)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    // Store PID
    {
        let mut pid = state.active_pid.lock().unwrap();
        *pid = Some(child.id());
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for command: {}", e))?;

    // Clear PID
    {
        let mut pid = state.active_pid.lock().unwrap();
        *pid = None;
    }

    Ok(CommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

// ── Background process output event payload ──────────────────────────────────

#[derive(Clone, serde::Serialize)]
struct ProcessOutput {
    id: String,
    line: String,
    stream: String, // "stdout" or "stderr"
}

// ── Background process result ─────────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct BackgroundProcess {
    pub id: String,
    pub pid: u32,
}

// ── Shared counter for generating unique process IDs ─────────────────────────

static PROC_COUNTER: std::sync::atomic::AtomicU64 =
    std::sync::atomic::AtomicU64::new(1);

/// Spawn a long-running background process and stream its output via events.
#[tauri::command]
pub fn spawn_background_process(
    cwd: String,
    command: String,
    state: State<'_, ProcessState>,
    app: tauri::AppHandle,
) -> Result<BackgroundProcess, String> {
    use std::io::BufRead;
    use tauri::Emitter;

    let (shell, flag) = if cfg!(target_os = "windows") {
        ("cmd", "/C")
    } else {
        ("sh", "-c")
    };

    let mut child = std::process::Command::new(shell)
        .arg(flag)
        .arg(&command)
        .current_dir(&cwd)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn background process: {}", e))?;

    let pid = child.id();
    let counter = PROC_COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let id = format!("proc_{}", counter);

    // Register in background map
    {
        let mut map = state.background.lock().unwrap();
        map.insert(id.clone(), pid);
    }

    // Capture stdout and stderr handles before moving child
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Stream stdout in a background thread
    if let Some(stdout) = stdout {
        let app_clone = app.clone();
        let id_clone = id.clone();
        std::thread::spawn(move || {
            let reader = std::io::BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        let _ = app_clone.emit(
                            "process:output",
                            ProcessOutput {
                                id: id_clone.clone(),
                                line: l,
                                stream: "stdout".into(),
                            },
                        );
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // Stream stderr in a background thread
    if let Some(stderr) = stderr {
        let app_clone = app.clone();
        let id_clone = id.clone();
        std::thread::spawn(move || {
            let reader = std::io::BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        let _ = app_clone.emit(
                            "process:output",
                            ProcessOutput {
                                id: id_clone.clone(),
                                line: l,
                                stream: "stderr".into(),
                            },
                        );
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // Reap the child in a background thread so it doesn't become a zombie
    std::thread::spawn(move || {
        let _ = child.wait();
    });

    Ok(BackgroundProcess { id, pid })
}

/// Kill a running background process by its ID.
#[tauri::command]
pub fn kill_background_process(
    id: String,
    state: State<'_, ProcessState>,
) -> Result<(), String> {
    let mut map = state.background.lock().unwrap();
    let pid = map
        .remove(&id)
        .ok_or_else(|| format!("No background process found with id: {}", id))?;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output()
            .map_err(|e| format!("Failed to kill process {}: {}", pid, e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("kill")
            .arg(pid.to_string())
            .output()
            .map_err(|e| format!("Failed to kill process {}: {}", pid, e))?;
    }

    Ok(())
}
