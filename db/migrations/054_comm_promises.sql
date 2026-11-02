-- Профіль спілкування з клієнтом (як звертатись, тон, що цікавить) і обіцянки клієнтам → задачі-нагадування
CREATE TABLE client_comm (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  profile TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'auto', -- auto | manual
  messages_seen INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE promises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  what TEXT NOT NULL,
  due_date TEXT,
  quote TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'group', -- group | draft
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_promises_client ON promises(client_id, created_at);
