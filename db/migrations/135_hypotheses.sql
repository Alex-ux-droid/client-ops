-- Фаза 6: гіпотези в стратегії + власник і дата перегляду в рішень
CREATE TABLE hypotheses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,             -- «Якщо …, то …»
  action TEXT NOT NULL DEFAULT '',     -- що робимо, щоб перевірити
  metric_id INTEGER REFERENCES client_metrics(id) ON DELETE SET NULL,
  expected TEXT NOT NULL DEFAULT '',   -- що очікуємо побачити (цифра)
  deadline TEXT,                       -- YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'idea', -- idea | running | confirmed | rejected
  result TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);
CREATE INDEX idx_hypotheses ON hypotheses(client_id, status);
ALTER TABLE strategy_items ADD COLUMN owner TEXT NOT NULL DEFAULT '';
ALTER TABLE strategy_items ADD COLUMN review_date TEXT;

INSERT INTO changelog (title, body, created_at) VALUES ('Стратегія: гіпотези і перевірка плану', 'Що нового у Стратегії клієнта:
- Вкладка «Гіпотези»: «Якщо …, то …», що робимо, яка метрика, що очікуємо, дедлайн; статуси ідея → перевіряємо → підтвердилась / не підтвердилась + результат. Закриваєш гіпотезу — результат одразу пропонується записати у «Висновки». Гіпотези з дедлайном цього тижня видно в Рев''ю.
- Перевірка пріоритетів: якщо у Висновках «проблема з обробкою заявок» або горить «без контакту», а в плані на тиждень — більше лідів/бюджету без пункту про обробку, зверху попередження «план суперечить висновку».
- Пункт плану, з якого зробили задачу, сам відмічається, коли задачу закрили.
- Назва частини біля пунктів — тільки якщо частин більше однієї.
- У рішень є «хто відповідає» і «переглянути до».
- Памʼять Джері по клієнту — тепер у Стратегія → Хроніка; на Огляді — останній рядок.', datetime('now'));
