-- Воронка лідів, гроші, реклама, плейбуки по клієнту

ALTER TABLE clients ADD COLUMN stage TEXT NOT NULL DEFAULT 'new'
  CHECK (stage IN ('new','contacted','proposal','negotiation'));   -- етап, поки клієнт у статусі lead
ALTER TABLE clients ADD COLUMN fee_monthly REAL NOT NULL DEFAULT 0;  -- скільки платить мені щомісяця
ALTER TABLE clients ADD COLUMN pay_day INTEGER NOT NULL DEFAULT 1;   -- день місяця, коли чекаю оплату
ALTER TABLE clients ADD COLUMN next_step TEXT NOT NULL DEFAULT '';   -- наступний крок

-- Оплати від клієнтів: очікувані (paid_at NULL) і отримані
CREATE TABLE payments (
  id         INTEGER PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount     REAL NOT NULL,
  due_date   TEXT NOT NULL,   -- YYYY-MM-DD
  paid_at    TEXT,            -- YYYY-MM-DD, NULL = ще не заплатив
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX payments_due ON payments(paid_at, due_date);

-- Цифри з рекламних кабінетів за період
CREATE TABLE ad_stats (
  id           INTEGER PRIMARY KEY,
  client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL DEFAULT 'facebook',
  period_start TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  spend        REAL NOT NULL DEFAULT 0,
  impressions  INTEGER NOT NULL DEFAULT 0,
  clicks       INTEGER NOT NULL DEFAULT 0,
  leads        INTEGER NOT NULL DEFAULT 0,
  sales        INTEGER NOT NULL DEFAULT 0,
  revenue      REAL NOT NULL DEFAULT 0,
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ad_stats_client ON ad_stats(client_id, period_end);
