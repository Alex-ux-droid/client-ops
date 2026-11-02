-- Лабораторія → результат для клієнта: сценарії (покрокові варіанти рішення) і пропозиція (A4 для клієнта)
CREATE TABLE lab_scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES lab_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',     -- суть одним-двома реченнями
  steps_md TEXT NOT NULL DEFAULT '',    -- покроково (markdown: 1. … або ## Етап)
  timeline TEXT NOT NULL DEFAULT '',    -- скільки часу
  price_setup REAL,                     -- разово
  price_month REAL,                     -- щомісяця
  pros TEXT NOT NULL DEFAULT '',
  cons TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX lab_scenarios_s ON lab_scenarios(session_id, position);
ALTER TABLE lab_sessions ADD COLUMN proposal_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE lab_sessions ADD COLUMN chosen_scenario_id INTEGER;
