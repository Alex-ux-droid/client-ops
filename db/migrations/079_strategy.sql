-- Стратегія клієнта (замість Лабораторії): конспект, екосистема (частини: що будуємо / що надаємо / сервіси),
-- план по горизонтах, хроніка, знання і рішення по кожній частині, висновки, яких Джері вчиться.
CREATE TABLE strategy (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  where_now TEXT NOT NULL DEFAULT '',   -- де ми зараз
  goal TEXT NOT NULL DEFAULT '',        -- куди йдемо (3–6 міс)
  focus TEXT NOT NULL DEFAULT '',       -- головне зараз
  insights TEXT NOT NULL DEFAULT '',    -- висновки / патерни (Джері переписує після кожної витяжки)
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE strategy_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'build',   -- build (будуємо) | service (надаємо) | tool (підключений сервіс)
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'plan',  -- plan | building | live | improving | paused
  summary TEXT NOT NULL DEFAULT '',     -- що це і навіщо клієнту
  stack TEXT NOT NULL DEFAULT '',       -- з чого складається: модулі, інструменти, API (по рядку)
  pros TEXT NOT NULL DEFAULT '',
  cons TEXT NOT NULL DEFAULT '',
  next_step TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_strategy_parts ON strategy_parts(client_id, kind, position);
-- kind: plan (horizon week|month|later|done) | log (хроніка) | knowledge (cat fix|integration|lesson) | decision | idea
CREATE TABLE strategy_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  part_id INTEGER REFERENCES strategy_parts(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  horizon TEXT NOT NULL DEFAULT '',
  cat TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual', -- manual | extract | jerry
  task_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  done_at TEXT
);
CREATE INDEX idx_strategy_items ON strategy_items(client_id, kind, created_at);
