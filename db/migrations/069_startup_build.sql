-- Стартап = «будинок»: тип (свій продукт / рішення для клієнта), база знань (startup_items kind knowledge)
-- і журнал проблем, які надсилає сам продукт (помилки, збої, відгуки користувачів) → чиняться через Claude Code.
ALTER TABLE startups ADD COLUMN kind TEXT NOT NULL DEFAULT 'product'; -- product | client
UPDATE startups SET kind = 'client' WHERE client_id IS NOT NULL AND lab_id IS NOT NULL;
CREATE TABLE startup_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  startup_id INTEGER NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'error',      -- error | bug | feedback
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',        -- стек, що натиснули, дані
  url TEXT NOT NULL DEFAULT '',
  reporter TEXT NOT NULL DEFAULT '',
  fingerprint TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'new',      -- new | work | fixed | ignored
  fix_note TEXT NOT NULL DEFAULT '',
  first_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_startup_issues ON startup_issues(startup_id, status, last_at);
CREATE UNIQUE INDEX idx_startup_issues_fp ON startup_issues(startup_id, fingerprint);
