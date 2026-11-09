-- Шлях клієнта від А до Я: дірки → червоні → жовті → зелені (підкручуємо, вдосконалюємо)
CREATE TABLE strategy_path (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'holes',      -- holes | red | yellow | green
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',      -- open | doing | done
  task_id INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  done_at TEXT
);
CREATE INDEX idx_strategy_path ON strategy_path(client_id, stage, position);
-- Дошка-детектив клієнта (як Miro, тільки простіше): стікери + нитки між ними, усе в JSON
CREATE TABLE strategy_boards (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  data_json TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO changelog (title, body, created_at) VALUES ('Стратегія: Шлях від А до Я і дошка-детектив', 'У Стратегії клієнта зверху тепер «Шлях»: 4 етапи по черзі — 1) Дірки (що протікає — латаємо), 2) Червоні проблеми, 3) Жовті, 4) Зелене — підкручуємо і вдосконалюємо. Кожен етап — список пунктів з галочками і прогресом; «Ми тут» підсвічує перший етап, де ще є відкриті пункти. Пункт можна перенести між етапами або зробити задачею. Окремо — велика кнопка «Дошка»: вільна дошка як у Miro / детективі — стікери різних кольорів, перетягування, нитки між стікерами, масштаб; зберігається сама. Джері бачить Шлях і може додавати в нього пункти.', datetime('now'));
