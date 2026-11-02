-- Креативи: промпти для Claude (з чого зробили креатив) + привʼязка до оголошень Meta → видно, який промпт дав які цифри.
-- Журнал змін реклами: що змінили, чому, чого чекали і що вийшло — і для Джері, і для звіту клієнту.
CREATE TABLE creative_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  angle TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  ad_ids TEXT NOT NULL DEFAULT '',   -- через кому
  verdict TEXT NOT NULL DEFAULT '',  -- '' | win | lose
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_creative_prompts ON creative_prompts(client_id, created_at);
CREATE TABLE ad_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  at TEXT NOT NULL DEFAULT (date('now')),
  what TEXT NOT NULL,
  why TEXT NOT NULL DEFAULT '',
  expect TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ad_changes ON ad_changes(client_id, at);
