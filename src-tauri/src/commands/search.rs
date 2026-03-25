use serde::Serialize;
use std::path::Path;
use crate::security;

const MAX_RESULTS: usize = 50;

const SKIP_DIRS: &[&str] = &[
    "node_modules",
    "target",
    ".git",
    "dist",
    "__pycache__",
];

#[derive(Serialize, Clone)]
pub struct SearchMatch {
    pub file: String,
    pub line_number: usize,
    pub line_text: String,
}

fn should_skip_dir(name: &str) -> bool {
    if name.starts_with('.') {
        return true;
    }
    SKIP_DIRS.iter().any(|s| *s == name)
}

fn matches_file_pattern(file_name: &str, pattern: &str) -> bool {
    // Simple glob: supports a leading "*." prefix (e.g. "*.tsx", "*.rs")
    // and plain exact matches. Extend as needed.
    if let Some(ext_pattern) = pattern.strip_prefix("*.") {
        return file_name
            .rsplit('.')
            .next()
            .map(|ext| ext.eq_ignore_ascii_case(ext_pattern))
            .unwrap_or(false);
    }
    // Fall back to exact filename match
    file_name.eq_ignore_ascii_case(pattern)
}

fn walk_and_search(
    dir: &Path,
    pattern_lower: &str,
    file_pattern: &Option<String>,
    results: &mut Vec<SearchMatch>,
) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        if results.len() >= MAX_RESULTS {
            return;
        }

        let path = entry.path();
        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_owned(),
            None => continue,
        };

        if path.is_dir() {
            if should_skip_dir(&file_name) {
                continue;
            }
            walk_and_search(&path, pattern_lower, file_pattern, results);
        } else if path.is_file() {
            // Apply file pattern filter if provided
            if let Some(fp) = file_pattern {
                if !matches_file_pattern(&file_name, fp) {
                    continue;
                }
            }

            // Read file; skip on error or if binary-looking
            let contents = match std::fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let path_str = path.to_string_lossy().to_string();

            for (idx, line) in contents.lines().enumerate() {
                if results.len() >= MAX_RESULTS {
                    return;
                }
                if line.to_lowercase().contains(pattern_lower) {
                    results.push(SearchMatch {
                        file: path_str.clone(),
                        line_number: idx + 1,
                        line_text: line.to_string(),
                    });
                }
            }
        }
    }
}

#[tauri::command]
pub fn search_files(
    project_root: String,
    pattern: String,
    path: Option<String>,
    file_pattern: Option<String>,
) -> Result<Vec<SearchMatch>, String> {
    // Determine the search root: project_root optionally joined with a subdirectory
    let search_root = if let Some(ref sub) = path {
        let resolved = security::validate_path(&project_root, sub)?;
        resolved
    } else {
        std::path::Path::new(&project_root)
            .canonicalize()
            .map_err(|e| format!("Invalid project root: {}", e))?
    };

    if !search_root.is_dir() {
        return Err(format!("Search path is not a directory: {}", search_root.display()));
    }

    let pattern_lower = pattern.to_lowercase();
    let mut results: Vec<SearchMatch> = Vec::new();

    walk_and_search(&search_root, &pattern_lower, &file_pattern, &mut results);

    Ok(results)
}

/// Find files matching a glob pattern (e.g. "*.tsx", "src/**/*.ts").
/// Returns matching file paths relative to project root, capped at 100.
#[tauri::command]
pub fn glob_files(
    project_root: String,
    pattern: String,
) -> Result<Vec<String>, String> {
    use std::path::Path;

    let root = Path::new(&project_root)
        .canonicalize()
        .map_err(|e| format!("Invalid project root: {}", e))?;

    if !root.is_dir() {
        return Err(format!("Not a directory: {}", root.display()));
    }

    let mut results: Vec<String> = Vec::new();
    let max_results = 100;

    // Walk the directory tree and match against the pattern
    walk_glob(&root, &root, &pattern.to_lowercase(), &mut results, max_results);

    Ok(results)
}

fn walk_glob(
    base: &std::path::Path,
    dir: &std::path::Path,
    pattern: &str,
    results: &mut Vec<String>,
    max: usize,
) {
    if results.len() >= max {
        return;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        if results.len() >= max {
            return;
        }

        let path = entry.path();
        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_owned(),
            None => continue,
        };

        // Skip hidden dirs and common large dirs
        if file_name.starts_with('.') || file_name == "node_modules" || file_name == "target" || file_name == "dist" || file_name == "__pycache__" {
            if path.is_dir() {
                continue;
            }
        }

        if path.is_dir() {
            walk_glob(base, &path, pattern, results, max);
        } else {
            // Get relative path
            let rel = path.strip_prefix(base)
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .unwrap_or_else(|_| file_name.clone());

            let rel_lower = rel.to_lowercase();
            let name_lower = file_name.to_lowercase();

            // Match against pattern
            if glob_match(pattern, &rel_lower) || glob_match(pattern, &name_lower) {
                results.push(rel);
            }
        }
    }
}

/// Simple glob matching: supports *, **, and ? wildcards.
fn glob_match(pattern: &str, text: &str) -> bool {
    // Handle ** (match any path segments)
    if pattern.contains("**") {
        let parts: Vec<&str> = pattern.split("**").collect();
        if parts.len() == 2 {
            let prefix = parts[0].trim_end_matches('/');
            let suffix = parts[1].trim_start_matches('/');
            let prefix_ok = prefix.is_empty() || text.starts_with(prefix);
            let suffix_ok = suffix.is_empty() || simple_glob(suffix, text.rsplit('/').next().unwrap_or(text));
            return prefix_ok && suffix_ok;
        }
    }

    // Handle simple glob (*.ext, name.*, etc.)
    simple_glob(pattern, text)
}

fn simple_glob(pattern: &str, text: &str) -> bool {
    if pattern == "*" {
        return true;
    }

    // *.ext — match extension
    if let Some(ext) = pattern.strip_prefix("*.") {
        return text.ends_with(&format!(".{}", ext));
    }

    // name.* — match name
    if let Some(name) = pattern.strip_suffix(".*") {
        return text.starts_with(&format!("{}.", name));
    }

    // *pattern* — contains
    if pattern.starts_with('*') && pattern.ends_with('*') {
        let inner = &pattern[1..pattern.len()-1];
        return text.contains(inner);
    }

    // Exact match
    text == pattern || text.ends_with(&format!("/{}", pattern))
}
