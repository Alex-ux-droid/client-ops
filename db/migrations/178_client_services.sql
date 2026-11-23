-- Сервіси й доступи клієнта: не лише «де пароль», а що підключено, на кого акаунт, скільки й з чого платиться, журнал дій.
-- Номери карт повністю НЕ зберігаються: лише останні 4 цифри (перевіряє код).
ALTER TABLE client_access ADD COLUMN purpose TEXT NOT NULL DEFAULT '';          -- навіщо: «Viber/Telegram/WhatsApp у CRM»
ALTER TABLE client_access ADD COLUMN account_holder TEXT NOT NULL DEFAULT '';   -- на кого акаунт: «Оля (менеджер)», «директор»
ALTER TABLE client_access ADD COLUMN connected_at TEXT;                         -- коли підключили (YYYY-MM-DD)
ALTER TABLE client_access ADD COLUMN status TEXT NOT NULL DEFAULT 'active';     -- active | trial | paused | off
ALTER TABLE client_access ADD COLUMN cost REAL;                                 -- скільки коштує
ALTER TABLE client_access ADD COLUMN currency TEXT NOT NULL DEFAULT 'UAH';
ALTER TABLE client_access ADD COLUMN period TEXT NOT NULL DEFAULT 'month';      -- once | month | year | free
ALTER TABLE client_access ADD COLUMN payer TEXT NOT NULL DEFAULT 'client';      -- client | mine
ALTER TABLE client_access ADD COLUMN pay_method TEXT NOT NULL DEFAULT '';       -- «карта клієнта Моно •••• 4521», «рахунок ФОП»
ALTER TABLE client_access ADD COLUMN next_pay TEXT;                             -- наступна оплата (YYYY-MM-DD)
CREATE TABLE IF NOT EXISTS client_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  access_id INTEGER NOT NULL REFERENCES client_access(id) ON DELETE CASCADE,
  day TEXT NOT NULL,                     -- дата події
  text TEXT NOT NULL,                    -- «підключив», «оплатив за грудень», «додав менеджера Олю»
  amount REAL,
  currency TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS client_access_log_a ON client_access_log(access_id, day);
INSERT INTO changelog (title, body, created_at) VALUES ('Сервіси й доступи клієнта', 'Картка клієнта → «Сервіси й доступи» (раніше «Доступи», тепер видно завжди): на кожен підключений сервіс — навіщо він, коли підключили, на кого акаунт, статус (працює / пробний / на паузі / відключено), скільки коштує і як часто, з чийого рахунку (клієнта чи мій), чим платили (карта — лише останні 4 цифри, повний номер система не приймає), коли наступна оплата (за 7 днів підсвічується), логін, Bitwarden, 2FA. У кожного сервісу — журнал: «23.11 підключив, сплатив 500 грн», «додав менеджера Олю». Згори — скільки на місяць іде за рахунок клієнта і скільки моїх. Можна просто написати Джері: «підключив Аквавіті E-chat, 500 грн/міс з карти клієнта 4521, акаунт на Олю» — він запише. Паролі — як і раніше, тільки в Bitwarden.', datetime('now'));
