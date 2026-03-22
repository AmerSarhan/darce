use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create initial tables",
        sql: include_str!("../../migrations/001.sql"),
        kind: MigrationKind::Up,
    }]
}
