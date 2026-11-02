-- Памʼять Джері по клієнту: де ми зараз, про що домовились, що вже зроблено, що далі.
-- Оновлюється сама після кожної розмови, де йшлося про клієнта; Саша може правити руками.
CREATE TABLE client_memory (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
