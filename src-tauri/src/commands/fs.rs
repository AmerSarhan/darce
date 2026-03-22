use serde::Serialize;
use std::fs;
use std::path::Path;

use crate::security;

#[derive(Serialize, Clone)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    children: Option<Vec<FileEntry>>,
}

#[tauri::command]
pub fn read_file(project_root: String, file_path: String) -> Result<String, String> {
    let resolved = security::validate_path(&project_root, &file_path)?;
    fs::read_to_string(&resolved).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn write_file(project_root: String, file_path: String, content: String) -> Result<(), String> {
    let resolved = security::validate_path(&project_root, &file_path)?;
    if let Some(parent) = resolved.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&resolved, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn delete_file(project_root: String, file_path: String) -> Result<(), String> {
    let resolved = security::validate_path(&project_root, &file_path)?;
    if resolved.is_dir() {
        fs::remove_dir_all(&resolved).map_err(|e| format!("Failed to delete directory: {}", e))
    } else {
        fs::remove_file(&resolved).map_err(|e| format!("Failed to delete file: {}", e))
    }
}

#[tauri::command]
pub fn list_directory(project_root: String, dir_path: Option<String>) -> Result<Vec<FileEntry>, String> {
    let base = if let Some(ref dp) = dir_path {
        security::validate_path(&project_root, dp)?
    } else {
        Path::new(&project_root)
            .canonicalize()
            .map_err(|e| format!("Invalid project root: {}", e))?
    };
    read_dir_recursive(&base, &base, 3)
}

fn read_dir_recursive(path: &Path, root: &Path, max_depth: usize) -> Result<Vec<FileEntry>, String> {
    if max_depth == 0 {
        return Ok(vec![]);
    }
    let mut entries: Vec<FileEntry> = Vec::new();
    let read_dir = fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') || name == "node_modules" || name == "target" || name == "__pycache__" || name == "dist" {
            continue;
        }

        let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
        let rel_path = entry.path()
            .strip_prefix(root)
            .unwrap_or(&entry.path())
            .to_string_lossy()
            .replace('\\', "/");

        let children = if is_dir {
            Some(read_dir_recursive(&entry.path(), root, max_depth - 1).unwrap_or_default())
        } else {
            None
        };

        entries.push(FileEntry { name, path: rel_path, is_dir, children });
    }

    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[tauri::command]
pub fn check_sensitive(file_path: String) -> bool {
    security::is_sensitive_path(&file_path)
}
