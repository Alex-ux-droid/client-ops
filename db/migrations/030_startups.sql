-- Стартапи: власні продукти Саші — від сирої ідеї до працюючої системи.
-- stage: raw (скринька ідей) | idea | research | foundation | build | launch | grow | paused | closed
CREATE TABLE startups (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  one_liner TEXT NOT NULL DEFAULT '',        -- одним реченням: що це і для кого
  stage TEXT NOT NULL DEFAULT 'idea',
  north_star TEXT NOT NULL DEFAULT '',       -- головна метрика
  next_step TEXT NOT NULL DEFAULT '',
  canvas_json TEXT NOT NULL DEFAULT '{}',    -- фундамент: problem, audience, solution, why_us, money, channels, competitors, metrics, risks
  spec_md TEXT NOT NULL DEFAULT '',          -- ТЗ / промпт для Claude Code
  spec_updated_at TEXT,
  repo TEXT NOT NULL DEFAULT '',             -- owner/name на GitHub
  prod_url TEXT NOT NULL DEFAULT '',         -- де живе (для моніторингу)
  lab_id INTEGER,                            -- звідки прийшов (Лабораторія)
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL, -- перший клієнт / для кого робимо
  raw_text TEXT NOT NULL DEFAULT '',         -- як ідея була записана вперше (дослівно)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Усе, що наповнює проєкт. kind: milestone | experiment | decision | question | note | link
-- status: milestone — now|next|later|done; experiment — planned|running|confirmed|refuted; question — open|closed
CREATE TABLE startup_items (
  id INTEGER PRIMARY KEY,
  startup_id INTEGER NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX startup_items_s ON startup_items(startup_id, kind, position);

-- Задачі можуть належати стартапу і етапу плану
ALTER TABLE tasks ADD COLUMN startup_id INTEGER REFERENCES startups(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN milestone_id INTEGER;

-- Моніторинг продакшену: перевірка адреси раз на 5 хв
CREATE TABLE startup_checks (
  startup_id INTEGER NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  ok INTEGER NOT NULL,
  status INTEGER NOT NULL DEFAULT 0,
  ms INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX startup_checks_s ON startup_checks(startup_id, at);

INSERT INTO changelog (title, body, created_at) VALUES
('Стартапи: робочий простір для власних продуктів',
'Новий розділ «Стартапи». Зверху «Скринька ідей» — записати ідею голосом за 5 секунд (Джері потім розгорне). Проєкт проходить стадії Ідея → Дослідження → Фундамент → Будуємо → Запуск → Росте. Всередині: Огляд (пульт), Фундамент (9 опорних блоків: біль, для кого, рішення, чому ми, гроші, канали, конкуренти, метрика, ризики), План (етапи з задачами з системи задач), Тести (гіпотези і краш-тести з результатом), Рішення (журнал з причинами і альтернативами), ТЗ для Claude Code (Джері збирає з усього; копіювати/завантажити), Нотатки, Моніторинг (GitHub-репозиторій + перевірка сайту кожні 5 хв, якщо ліг — повідомлення в Telegram). З Лабораторії — кнопка «Будуємо самі → у Стартапи». Джері: startups_list, startup_get, startup_create, startup_update, startup_item, idea_capture.',
'2026-10-31 15:00:00');
