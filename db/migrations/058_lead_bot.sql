-- Куди йдуть заявки клієнта: наша група і/або власний Telegram-бот клієнта (токен — тільки в .env: LEADBOT_TOKEN_<client_id>)
CREATE TABLE lead_routes (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  to_group INTEGER NOT NULL DEFAULT 1,
  to_bot INTEGER NOT NULL DEFAULT 0,
  bot_username TEXT NOT NULL DEFAULT '',
  bot_name TEXT NOT NULL DEFAULT '',
  invite_code TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Хто отримує заявки в боті клієнта (натиснули посилання-запрошення)
CREATE TABLE leadbot_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tg_user_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, tg_user_id)
);
-- Кожне надіслане повідомлення із заявкою (щоб кнопка в одному місці оновила всі копії)
CREATE TABLE lead_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  via TEXT NOT NULL, -- main | client
  chat_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_lead_deliveries ON lead_deliveries(lead_id);
