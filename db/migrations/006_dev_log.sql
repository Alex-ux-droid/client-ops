-- Журнал системи: запити на доробку, глюки, нюанси, помилки. Експортується файлом для Claude.
CREATE TABLE dev_log (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('request','bug','note','error')),
  source      TEXT NOT NULL CHECK (source IN ('sasha','assistant','system')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  context     TEXT NOT NULL DEFAULT '',   -- сторінка / клієнт, де це виникло
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','exported')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  exported_at TEXT
);
CREATE INDEX dev_log_status ON dev_log(status, id);
