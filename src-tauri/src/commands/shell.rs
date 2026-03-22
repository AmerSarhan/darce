use std::sync::Mutex;
use tauri::State;

pub struct ProcessState {
    pub active_pid: Mutex<Option<u32>>,
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
