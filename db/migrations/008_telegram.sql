-- Telegram: групи з клієнтами (бот мовчки записує) і повідомлення
CREATE TABLE tg_chats (
  chat_id INTEGER PRIMARY KEY,               -- id чату в Telegram (для груп від'ємний)
  title TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'group',        -- group | supergroup | private | channel
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,         -- 0 — бота прибрали з групи
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_message_at TEXT
);

CREATE TABLE tg_messages (
  id INTEGER PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES tg_chats(chat_id) ON DELETE CASCADE,
  message_id INTEGER NOT NULL,
  from_id INTEGER,
  from_name TEXT NOT NULL DEFAULT '',
  is_owner INTEGER NOT NULL DEFAULT 0,       -- написав Саша
  kind TEXT NOT NULL DEFAULT 'text',         -- text | voice | photo | document | video | other
  text TEXT NOT NULL DEFAULT '',             -- текст або підпис; для голосових — розшифровка
  file_name TEXT NOT NULL DEFAULT '',
  sent_at TEXT NOT NULL,                     -- коли написали в Telegram (київський час)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (chat_id, message_id)
);

CREATE INDEX tg_messages_chat ON tg_messages(chat_id, sent_at);
CREATE INDEX tg_chats_client ON tg_chats(client_id);
