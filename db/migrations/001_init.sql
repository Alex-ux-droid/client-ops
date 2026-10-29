-- Клієнти. Паролі тут НЕ зберігаються: bitwarden_ref — лише назва/посилання запису.
CREATE TABLE clients (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  niche         TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('lead','active','paused','archived')),
  offer         TEXT NOT NULL DEFAULT '',   -- що продаємо клієнту
  budget        TEXT NOT NULL DEFAULT '',   -- бюджет, вільний текст
  contacts      TEXT NOT NULL DEFAULT '',
  needs         TEXT NOT NULL DEFAULT '',   -- що хоче клієнт
  client_vision TEXT NOT NULL DEFAULT '',   -- як бачить клієнт
  my_vision     TEXT NOT NULL DEFAULT '',   -- як бачу я
  notes         TEXT NOT NULL DEFAULT '',
  bitwarden_ref TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tasks (
  id         INTEGER PRIMARY KEY,
  client_id  INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  details    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
  due_date   TEXT,          -- YYYY-MM-DD
  remind_at  TEXT,          -- ISO datetime
  done_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX tasks_due ON tasks(status, due_date);

-- Історія робіт: що зробили, коли, чому, результат
CREATE TABLE work_log (
  id         INTEGER PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  task_id    INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  done_at    TEXT NOT NULL,  -- YYYY-MM-DD
  what       TEXT NOT NULL,
  why        TEXT NOT NULL DEFAULT '',
  result     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX work_log_client ON work_log(client_id, done_at);

CREATE TABLE ideas (
  id         INTEGER PRIMARY KEY,
  client_id  INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  text       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','used','dropped')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Матеріали: вставлені чати, дані з рекламних кабінетів, брифи
CREATE TABLE materials (
  id         INTEGER PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('chat','ads','brief','other')),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE playbooks (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL,
  body_md    TEXT NOT NULL,  -- markdown, пункти чекліста "- [ ] ..."
  tags       TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE client_playbooks (
  id           INTEGER PRIMARY KEY,
  client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  playbook_id  INTEGER NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  checked_json TEXT NOT NULL DEFAULT '[]',  -- індекси відмічених пунктів
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, playbook_id)
);

CREATE TABLE chat_messages (
  id         INTEGER PRIMARY KEY,
  client_id  INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
