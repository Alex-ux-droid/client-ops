-- Автопостинг (крок 1): куди публікуємо і де матеріали клієнта
CREATE TABLE IF NOT EXISTS social_profiles (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL DEFAULT '',
  page_name TEXT NOT NULL DEFAULT '',
  ig_id TEXT NOT NULL DEFAULT '',
  ig_username TEXT NOT NULL DEFAULT '',
  drive_folder_id TEXT NOT NULL DEFAULT '',
  drive_folder_url TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO changelog (title, body, created_at) VALUES ('Контент: перший крок автопостингу', 'У картці клієнта нова вкладка «Контент». Там: куди публікуємо (сторінка Facebook і Instagram — система бачить їх сама через токен Meta) і папка Google Диска з матеріалами клієнта (рендери, планування) — система показує, що в ній лежить. Далі тут з’явиться черга готових постів з кнопками ✓ / правка. Для списку файлів потрібен підключений Google.', datetime('now'));
