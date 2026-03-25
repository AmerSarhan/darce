mod commands;
mod security;

use commands::{db, shell::ProcessState};
use std::collections::HashMap;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ProcessState {
            active_pid: Mutex::new(None),
            background: Mutex::new(HashMap::new()),
        })
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:darce.db", db::get_migrations())
                .build(),
        )
        .plugin(tauri_plugin_aptabase::Builder::new("A-EU-1239712183").build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                let _ = app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                );
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_file,
            commands::fs::write_file,
            commands::fs::delete_file,
            commands::fs::list_directory,
            commands::fs::check_sensitive,
            commands::shell::check_dangerous_command,
            commands::shell::kill_process,
            commands::shell::run_shell_command,
            commands::shell::spawn_background_process,
            commands::shell::kill_background_process,
            commands::search::search_files,
            commands::search::glob_files,
            commands::ai::send_chat_message,
            commands::ai::validate_api_key,
            commands::ai::list_models,
            commands::ai::simple_chat,
            commands::ai::simple_chat_raw,
            commands::ai::send_signup_email,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
