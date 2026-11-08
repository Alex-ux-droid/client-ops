-- Фаза 10: плейбук = кроки (назва, опис, час, зсув у днях) → «Застосувати до клієнта» створює задачі з дедлайнами
ALTER TABLE playbooks ADD COLUMN service TEXT NOT NULL DEFAULT '';
ALTER TABLE playbooks ADD COLUMN description TEXT NOT NULL DEFAULT '';
CREATE TABLE playbook_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playbook_id INTEGER NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  minutes INTEGER NOT NULL DEFAULT 0,   -- скільки часу займає
  offset_days INTEGER NOT NULL DEFAULT 0 -- на який день від старту
);
CREATE INDEX idx_playbook_steps ON playbook_steps(playbook_id, position);
ALTER TABLE client_playbooks ADD COLUMN started_at TEXT;
CREATE TABLE playbook_tasks (
  client_playbook_id INTEGER NOT NULL REFERENCES client_playbooks(id) ON DELETE CASCADE,
  step_id INTEGER NOT NULL REFERENCES playbook_steps(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL,
  PRIMARY KEY (client_playbook_id, step_id)
);

-- Дві порожні заготовки (кроки Саша впише сам)
INSERT INTO playbooks (title, body_md, tags, service, description)
  SELECT 'Запуск реклами Meta', '', 'meta', 'meta_ads', 'Від брифу до першого тижня реклами. Кроки впиши сам.' WHERE NOT EXISTS (SELECT 1 FROM playbooks WHERE title = 'Запуск реклами Meta');
INSERT INTO playbooks (title, body_md, tags, service, description)
  SELECT 'Аудит рекламного акаунту', '', 'meta', 'meta_ads', 'Що перевіряємо в кабінеті нового клієнта. Кроки впиши сам.' WHERE NOT EXISTS (SELECT 1 FROM playbooks WHERE title = 'Аудит рекламного акаунту');

INSERT INTO changelog (title, body, created_at) VALUES ('Плейбуки → задачі з дедлайнами', 'Плейбук тепер — кроки: назва, опис, скільки часу, на який день від старту. «Застосувати до клієнта» (на сторінці плейбука або в картці клієнта → Плейбуки) з датою старту створює задачу на кожен крок з дедлайном «старт + N днів». У клієнта видно, на якому кроці плейбук (перший незакритий). Додано дві порожні заготовки: «Запуск реклами Meta» і «Аудит рекламного акаунту» — кроки впиши сам (Плейбуки → відкрити → «Кроки»). Старі плейбуки-чеклісти працюють як раніше.', datetime('now'));
