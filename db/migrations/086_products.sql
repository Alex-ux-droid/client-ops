-- Наші продукти (програми, набори-промпти, послуги) — паспорт кожного: що це, як працює, з чого складається, знання (що ламалось, юридичне), хроніка.
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'app',          -- app (програма) | kit (набір / промпт) | service (послуга)
  status TEXT NOT NULL DEFAULT 'building',   -- idea | building | live | improving | paused
  summary TEXT NOT NULL DEFAULT '',          -- що це і для кого
  how TEXT NOT NULL DEFAULT '',              -- як працює
  features TEXT NOT NULL DEFAULT '',         -- головні фічі, по рядку
  stack TEXT NOT NULL DEFAULT '',            -- з чого складається, по рядку
  pros TEXT NOT NULL DEFAULT '',
  cons TEXT NOT NULL DEFAULT '',
  next_step TEXT NOT NULL DEFAULT '',
  links TEXT NOT NULL DEFAULT '',            -- посилання по рядку: «Назва — url»
  kit_md TEXT NOT NULL DEFAULT '',           -- для наборів: сам промпт / інструкція ({{HOST}} підставляється)
  last_event_at TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE product_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                        -- log | knowledge | decision | idea | plan
  cat TEXT NOT NULL DEFAULT '',              -- knowledge: fix | integration | legal | lesson
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  done INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',     -- manual | extract | jerry
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX product_items_p ON product_items(product_id, kind);
CREATE TABLE product_clients (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (product_id, client_id)
);
-- Події від програм, підключених через «Client Ops Connect» (помилки, відгуки, релізи, використання)
CREATE TABLE product_events (
  event_id TEXT PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX product_events_p ON product_events(product_id, received_at);
-- Розвиток організації: план (зараз / далі / потім), рішення, уроки, ідеї. Тексти напрямку — у settings org.*
CREATE TABLE org_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                        -- plan | decision | lesson | idea
  horizon TEXT NOT NULL DEFAULT '',          -- plan: now | next | later | done
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  done_at TEXT
);
