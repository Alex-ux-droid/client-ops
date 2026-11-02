-- Лабораторія → продаж: послуги з «що входить» і ринковою ціною, пакети (Базовий/Оптимальний/Преміум), обраний пакет = рахунок.
-- Бібліотека «Мої послуги» — шаблони, які Саша додає в будь-яку лабораторію одним кліком.
ALTER TABLE lab_products ADD COLUMN includes TEXT NOT NULL DEFAULT '';
ALTER TABLE lab_products ADD COLUMN market_setup REAL;
ALTER TABLE lab_products ADD COLUMN market_month REAL;
ALTER TABLE lab_sessions ADD COLUMN chosen_package_id INTEGER;
CREATE TABLE lab_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES lab_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  price_setup REAL,   -- NULL — сума послуг
  price_month REAL,
  highlight INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE lab_package_items (
  package_id INTEGER NOT NULL REFERENCES lab_packages(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES lab_products(id) ON DELETE CASCADE,
  PRIMARY KEY (package_id, product_id)
);
CREATE TABLE service_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  about TEXT NOT NULL DEFAULT '',
  includes TEXT NOT NULL DEFAULT '',
  ptype TEXT NOT NULL DEFAULT 'ours',
  price_setup REAL, price_month REAL, cost_setup REAL, cost_month REAL, market_setup REAL, market_month REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
