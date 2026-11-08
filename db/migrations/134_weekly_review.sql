-- Фаза 5: тижневий рев'ю. Чернетка рішень по клієнтах + знімок закритого тижня (архів)
CREATE TABLE weekly_review_items (
  week TEXT NOT NULL,                 -- понеділок тижня, YYYY-MM-DD
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  decision TEXT NOT NULL DEFAULT '',
  to_task INTEGER NOT NULL DEFAULT 0,
  task_id INTEGER,
  PRIMARY KEY (week, client_id)
);
CREATE TABLE weekly_reviews (
  week TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,            -- знімок: клієнти (метрика зараз/тиждень тому/ціль, що змінилось, план, рішення), гроші тижня
  closed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO changelog (title, body, created_at) VALUES ('Тижневий рев''ю', 'Новий пункт меню «Рев''ю». По рядку на кожного активного клієнта: головна метрика зараз / тиждень тому / ціль, що змінилось за тиждень (з Історії, до 5 пунктів), план стратегії на тиждень і поле «Рішення на тиждень» (обовʼязкове) з галочкою «→ задача» (задача на +7 днів). Внизу — гроші тижня: отримано, очікую, прострочено. «Закрити тиждень» зберігає знімок, архів тижнів — там само. З неділі 18:00 на Центрі банер і рядок у ранковому зведенні, поки рев''ю не закрите. Тижнева чернетка звіту клієнту бере рішення і цифри з цього знімка.', datetime('now'));
