-- Лабораторія: режим «робота над рішенням» — продукти рішення (з собівартістю), покрокові етапи, фінанси
ALTER TABLE lab_sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'choose'; -- choose | solution
CREATE TABLE lab_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES lab_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  about TEXT NOT NULL DEFAULT '',      -- що це дає клієнту
  ptype TEXT NOT NULL DEFAULT 'ours',  -- ours (наша розробка/робота) | service (сторонній сервіс) | contractor (підрядник)
  price_setup REAL,                    -- клієнт платить разово
  price_month REAL,                    -- клієнт платить щомісяця
  cost_setup REAL,                     -- наша собівартість разово
  cost_month REAL,                     -- наша собівартість щомісяця
  notes TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE lab_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES lab_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  steps_md TEXT NOT NULL DEFAULT '',   -- кроки (1. 2. 3.)
  result TEXT NOT NULL DEFAULT '',     -- що клієнт має на виході
  duration TEXT NOT NULL DEFAULT '',   -- скільки часу
  product_id INTEGER,                  -- до якого продукту відноситься
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX lab_products_s ON lab_products(session_id, position);
CREATE INDEX lab_stages_s ON lab_stages(session_id, position);
