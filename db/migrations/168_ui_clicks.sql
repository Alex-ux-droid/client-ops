-- Трекер користування: на що Саша тисне (назва кнопки/посилання + розділ), по днях. Тільки підписи елементів, без даних.
CREATE TABLE IF NOT EXISTS ui_clicks (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  label TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, label)
);
INSERT INTO changelog (title, body, created_at) VALUES ('Трекер: чим користуєшся, а чим ні', 'Налаштування → «Користування»: які розділи відкриваєш і як часто, на які кнопки тиснеш, і чого не відкривав за 14 днів — кандидати прибрати. Пишуться тільки назви розділів і кнопок, без даних клієнтів. Перевірки Claude не рахуються.', datetime('now'));
