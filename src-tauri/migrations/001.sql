CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_opened TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS concept_progress (
  concept_id TEXT NOT NULL,
  project_id TEXT,
  encounters INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'seen' CHECK (status IN ('seen', 'practicing', 'understood')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (concept_id, COALESCE(project_id, '__global__'))
);

CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id, created_at);
