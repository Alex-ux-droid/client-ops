-- Студія контенту: стратегія клієнта, рубрики (пілари), план по тижнях, пости, матеріали з Диску, шаблони (глобальні)
ALTER TABLE social_profiles ADD COLUMN audience TEXT NOT NULL DEFAULT '';
ALTER TABLE social_profiles ADD COLUMN voice TEXT NOT NULL DEFAULT '';
ALTER TABLE social_profiles ADD COLUMN cta TEXT NOT NULL DEFAULT '';
ALTER TABLE social_profiles ADD COLUMN banned TEXT NOT NULL DEFAULT '';
ALTER TABLE social_profiles ADD COLUMN facts TEXT NOT NULL DEFAULT '';
ALTER TABLE social_profiles ADD COLUMN approval TEXT NOT NULL DEFAULT 'manual'; -- manual | auto
ALTER TABLE social_profiles ADD COLUMN auto_hours INTEGER NOT NULL DEFAULT 24;
ALTER TABLE social_profiles ADD COLUMN cadence_json TEXT NOT NULL DEFAULT '{"reel":2,"carousel":2,"story":4,"post":0}';
ALTER TABLE social_profiles ADD COLUMN slots_json TEXT NOT NULL DEFAULT '{"1":"18:30","3":"18:30","5":"18:30"}';
ALTER TABLE social_profiles ADD COLUMN assets_synced_at TEXT;

CREATE TABLE IF NOT EXISTS content_pillars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#2d8a52',
  share INTEGER NOT NULL DEFAULT 20,
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_content_pillars ON content_pillars(client_id, archived);

CREATE TABLE IF NOT EXISTS content_weeks (
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL, -- понеділок YYYY-MM-DD
  theme TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (client_id, week_start)
);

CREATE TABLE IF NOT EXISTS content_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  pillar_id INTEGER REFERENCES content_pillars(id) ON DELETE SET NULL,
  format TEXT NOT NULL DEFAULT 'carousel', -- reel | carousel | story | post
  topic TEXT NOT NULL DEFAULT '',
  hook TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  template_key TEXT NOT NULL DEFAULT '',
  spec_json TEXT NOT NULL DEFAULT '{}',
  asset_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'idea', -- idea | making | review | scheduled | published | failed | rejected
  scheduled_at TEXT, -- YYYY-MM-DD HH:MM (Київ)
  published_at TEXT,
  ig_media_id TEXT NOT NULL DEFAULT '',
  fb_post_id TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_content_posts ON content_posts(client_id, status, scheduled_at);

CREATE TABLE IF NOT EXISTS content_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  drive_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'render', -- render | plan | photo | logo | video | doc | other
  tags TEXT NOT NULL DEFAULT '',
  size INTEGER,
  link TEXT NOT NULL DEFAULT '',
  hidden INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  modified_at TEXT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, drive_id)
);

CREATE TABLE IF NOT EXISTS content_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  track TEXT NOT NULL DEFAULT 'production', -- production | rnd
  status TEXT NOT NULL DEFAULT 'planned', -- planned | trial | active | retired
  description TEXT NOT NULL DEFAULT '',
  slots TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO content_templates (key, name, format, description, slots) VALUES
 ('carousel-feature', 'Карусель «Фішка»', 'carousel', 'Одна перевага на слайд: великий рендер, коротка теза, фінальний слайд з CTA', 'обкладинка-хук, 3–6 слайдів: рендер + теза ≤60 симв., CTA'),
 ('carousel-plan', 'Карусель «Планування»', 'carousel', 'Реальне планування квартири: площа, кімнати, кому підходить, чому зручно', 'планування, площа, 3 переваги, ціна «від» з шахматки, CTA'),
 ('story-fact', 'Сторіс «Факт»', 'story', 'Один факт великим шрифтом поверх рендеру з легким наїздом камери, стікер-CTA', 'рендер, факт ≤40 симв., підпис, CTA'),
 ('reel-kinetic', 'Reels «Кінетичний текст»', 'reel', '12–15 с: рендери з повільним рухом камери, текст з''являється в ритм, фінал з лого і CTA', '3–5 рендерів, 4–6 рядків тексту, музика, лого, CTA');

INSERT INTO changelog (title, body, created_at) VALUES ('Студія контенту в картці клієнта', 'Вкладка «Контент» тепер — повна студія: Огляд (конвеєр постів і запуск клієнта по кроках), План (календар місяця, тема тижня, пости за днями), Пости (дошка за статусами), Матеріали (файли з папки Google Диска з прев’ю, тип і теги), Стратегія (аудиторія, тон, CTA, заборони, факти, рубрики з частками), Налаштування (сторінка й Instagram, папка Диска, апрув, частота і час публікацій). Шаблони — спільна бібліотека для всіх клієнтів. Генерація і публікація — наступний крок.', datetime('now'));
