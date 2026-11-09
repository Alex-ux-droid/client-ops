-- Продукти = база проєктів: робоче місце (чат Claude Code, репо, прод) + правки (заявки на виправлення).
-- Правки зараз додає Саша або Джері; згодом — бот підтримки клієнтів (source 'bot').
ALTER TABLE products ADD COLUMN chat_url TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN repo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN prod_url TEXT NOT NULL DEFAULT '';
CREATE TABLE product_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',   -- manual | jerry | app | bot
  author TEXT NOT NULL DEFAULT '',          -- хто написав (імʼя клієнта / менеджера)
  text TEXT NOT NULL,
  files_json TEXT NOT NULL DEFAULT '[]',    -- id файлів (скріни) з таблиці files
  status TEXT NOT NULL DEFAULT 'new',       -- new | doing | done | rejected
  done_note TEXT NOT NULL DEFAULT '',
  notified INTEGER NOT NULL DEFAULT 0,      -- клієнту повідомили, що виправлено (для бота)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  done_at TEXT
);
CREATE INDEX idx_product_requests ON product_requests(product_id, status);
INSERT INTO changelog (title, body, created_at) VALUES ('Проєкти: чат Claude Code, репо і правки в кожному продукті', 'Меню: «Креативи» і «Плейбуки» прибрані, замість них у «Роботі» — «Проєкти» (це Продукти). Там два розділи: мої продукти і проєкти клієнтів. У кожного проєкту є код P-N — так само назви чат у Claude Code («P-12 · Сайт ProVector»), щоб усе збігалось. У картці проєкту: кнопки «Чат Claude Code», GitHub, Сайт (посилання вписуєш у «Змінити → Робоче місце») і вкладка «Правки»: записуєш, що треба виправити (від кого), кнопка «Промпт: виправити» збирає паспорт + усі відкриті правки з кодами R-N → вставляєш у чат проєкту → оновлення назад, і правки з кодами R-N закриваються самі. Джері теж може записати правку зі слів (інструмент product_request). Далі сюди ж писатиме бот підтримки клієнтів.', datetime('now'));
