-- Конкуренти клієнта: карта по рівнях, загроза, «що робимо», нагляд і журнал спостережень.
CREATE TABLE competitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT '',
  site TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  scale TEXT NOT NULL DEFAULT '',
  what TEXT NOT NULL DEFAULT '',
  for_whom TEXT NOT NULL DEFAULT '',
  why TEXT NOT NULL DEFAULT '',
  pros TEXT NOT NULL DEFAULT '',
  cons TEXT NOT NULL DEFAULT '',
  numbers TEXT NOT NULL DEFAULT '',
  threat TEXT NOT NULL DEFAULT '',     -- high | mid | low
  action TEXT NOT NULL DEFAULT '',     -- що з цим робимо
  checked TEXT NOT NULL DEFAULT '',    -- як перевірено
  watch INTEGER NOT NULL DEFAULT 0,    -- під наглядом (автоперевірка раз на тиждень)
  archived INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT,                     -- остання перевірка Джері
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_competitors ON competitors(client_id, archived);
CREATE TABLE competitor_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competitor_id INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note',    -- note | change | price | ad | content | check
  text TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual', -- manual | jerry
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_competitor_notes ON competitor_notes(competitor_id, created_at);
INSERT INTO changelog (title, body, created_at) VALUES ('Конкуренти клієнта', 'У картці клієнта розділ «Конкуренти»: уся карта конкурентів — рівень, регіон, масштаб, що роблять, переваги/мінуси, цифри, загроза (висока/середня/низька) і «що з цим робимо». Інтерактивна таблиця (сортування, фільтр за рівнем і загрозою, пошук), картка конкурента з журналом спостережень. «Імпорт з Excel» — закидаєш файл, система сама знаходить колонки (повтори оновлюються, не дублюються); аркуш «Висновки» → блок висновків. «Під наглядом» — Джері раз на тиждень перевіряє сайт і новини конкурента і пише, що змінилось (тумблер «Нагляд за конкурентами» у Можливостях; ≈2–5 центів за конкурента). Кнопка «Перевірити зараз» — те саме вручну.', datetime('now'));
