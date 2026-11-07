-- Брендбук клієнта: позиціонування, тон, правила, кольори, шрифти, логотипи і файли.
CREATE TABLE brand (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  positioning TEXT NOT NULL DEFAULT '',  -- хто ми і чим відрізняємось
  audience TEXT NOT NULL DEFAULT '',     -- для кого
  offer TEXT NOT NULL DEFAULT '',        -- що рекламуємо: продукт, оффер, ціни, переваги
  promise TEXT NOT NULL DEFAULT '',      -- головне обіцяння / УТП
  tone TEXT NOT NULL DEFAULT '',         -- тон спілкування, слова
  rules TEXT NOT NULL DEFAULT '',        -- можна / не можна
  notes TEXT NOT NULL DEFAULT '',        -- візуальний стиль, фото, інше
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE brand_colors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  hex TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',          -- primary | secondary | accent | background | text
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE brand_fonts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',          -- headings | body | accent
  url TEXT NOT NULL DEFAULT '',           -- Google Fonts / де взяти
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE brand_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'other',     -- logo | font | guide | photo | other
  title TEXT NOT NULL DEFAULT '',
  file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  url TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_brand_colors ON brand_colors(client_id, position);
CREATE INDEX idx_brand_assets ON brand_assets(client_id, kind);

-- Перенести те, що вже було в Креативах (бренд-текст, оффер, правила)
INSERT OR IGNORE INTO brand (client_id) SELECT DISTINCT CAST(replace(replace(replace(key, 'creative.offer.', ''), 'creative.rules.', ''), 'brand.', '') AS INTEGER) AS cid
  FROM settings WHERE (key LIKE 'brand.%' OR key LIKE 'creative.offer.%' OR key LIKE 'creative.rules.%') AND trim(value) <> ''
  AND CAST(replace(replace(replace(key, 'creative.offer.', ''), 'creative.rules.', ''), 'brand.', '') AS INTEGER) IN (SELECT id FROM clients);
UPDATE brand SET notes = COALESCE((SELECT value FROM settings WHERE key = 'brand.' || brand.client_id), '');
UPDATE brand SET offer = COALESCE((SELECT value FROM settings WHERE key = 'creative.offer.' || brand.client_id), '');
UPDATE brand SET rules = COALESCE((SELECT value FROM settings WHERE key = 'creative.rules.' || brand.client_id), '');

INSERT INTO changelog (title, body, created_at) VALUES ('Брендбук клієнта', 'У картці клієнта новий розділ «Бренд» — усе про бренд в одному місці: позиціонування, для кого, оффер, головне обіцяння, тон, можна/не можна; кольори (плашки з HEX, клік — копія); шрифти; логотипи і файли (завантаження до 20 МБ, прев''ю, скачати). Брендбук сам іде в «Хто ми» для креативів і в памʼять Джері. Кнопки: «Скопіювати брендбук» і «Промпт для дизайн-системи» (у Claude) → витяжка [CLIENT-OPS:БРЕНД] назад у «Бренд». Те, що було в Креативах («Оффер, бренд, правила»), перенесено сюди.', datetime('now'));
