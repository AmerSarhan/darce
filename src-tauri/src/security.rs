use std::path::{Path, PathBuf};

/// Validates that a target path is within the allowed project root.
/// Works for both existing and non-existing paths (for file creation).
pub fn validate_path(project_root: &str, target: &str) -> Result<PathBuf, String> {
    let root = Path::new(project_root)
        .canonicalize()
        .map_err(|e| format!("Invalid project root: {}", e))?;

    let joined = root.join(target);

    // Try to canonicalize (works for existing paths)
    // For new files, canonicalize the parent directory instead
    let resolved = if joined.exists() {
        joined.canonicalize()
            .map_err(|e| format!("Invalid path: {}", e))?
    } else {
        // For new files: canonicalize the parent, then append the filename
        let parent = joined.parent()
            .ok_or_else(|| "Invalid path: no parent directory".to_string())?;

        // Create parent dirs if needed, then canonicalize
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }

        let canonical_parent = parent.canonicalize()
            .map_err(|e| format!("Invalid parent path: {}", e))?;

        let file_name = joined.file_name()
            .ok_or_else(|| "Invalid path: no file name".to_string())?;

        canonical_parent.join(file_name)
    };

    if !resolved.starts_with(&root) {
        return Err("Path traversal detected: path escapes project root".into());
    }

    Ok(resolved)
}

/// Checks if a path matches sensitive file patterns
pub fn is_sensitive_path(path: &str) -> bool {
    let sensitive = [".env", ".ssh", "credentials", "secret", ".key", ".pem"];
    let lower = path.to_lowercase();
    sensitive.iter().any(|s| lower.contains(s))
}

/// Checks if a command is potentially dangerous
pub fn is_dangerous_command(cmd: &str) -> bool {
    let dangerous = [
        "rm -rf", "rm -fr", "rmdir /s",
        "git push --force", "git push -f",
        "sudo ", "chmod 777",
        "curl | sh", "curl | bash",
        "wget | sh", "wget | bash",
        "format ", "del /f",
        "> /dev/sda", "mkfs",
    ];
    let lower = cmd.to_lowercase();
    dangerous.iter().any(|d| lower.contains(d))
}
