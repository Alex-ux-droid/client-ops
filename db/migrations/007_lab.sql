-- Лабораторія: сесії підбору рішення для клієнта (яку CRM, телефонію, сайт...)
CREATE TABLE lab_sessions (
  id INTEGER PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'crm',      -- crm | telephony | site | other
  status TEXT NOT NULL DEFAULT 'open',       -- open | done
  brief TEXT NOT NULL DEFAULT '',            -- що треба клієнту, обмеження, бюджет
  notes TEXT NOT NULL DEFAULT '',            -- мозковий штурм
  conclusion TEXT NOT NULL DEFAULT '',       -- висновок
  chosen_option_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  done_at TEXT
);

CREATE TABLE lab_criteria (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES lab_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 2          -- 1 неважливо, 2 важливо, 3 критично
);

CREATE TABLE lab_options (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES lab_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tool_id INTEGER REFERENCES tools(id) ON DELETE SET NULL,
  link TEXT NOT NULL DEFAULT '',
  price_month REAL,
  price_setup REAL,
  pros TEXT NOT NULL DEFAULT '',
  cons TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''             -- що побачили на тесті
);

CREATE TABLE lab_scores (
  option_id INTEGER NOT NULL REFERENCES lab_options(id) ON DELETE CASCADE,
  criterion_id INTEGER NOT NULL REFERENCES lab_criteria(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,                    -- 1..5
  PRIMARY KEY (option_id, criterion_id)
);

CREATE INDEX lab_sessions_client ON lab_sessions(client_id);
