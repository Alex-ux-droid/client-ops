-- Конструктор кампаній Meta: кампанія → групи оголошень → оголошення (креатив + тексти) + журнал навчання.
-- Готуємо в системі, копіюємо в Ads Manager; після запуску звʼязуємо з живими цифрами (meta_*_id або код AD-N у назві).
CREATE TABLE cm_campaigns (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT 'leads',
  status TEXT NOT NULL DEFAULT 'draft',
  budget_level TEXT NOT NULL DEFAULT 'campaign',
  budget_type TEXT NOT NULL DEFAULT 'daily',
  budget REAL,
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  idea TEXT NOT NULL DEFAULT '',
  target_cpl REAL,
  special_category TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  meta_campaign_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX cm_campaigns_client ON cm_campaigns(client_id);

CREATE TABLE cm_adsets (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES cm_campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  conversion TEXT NOT NULL DEFAULT 'form',
  form TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  budget REAL,
  locations TEXT NOT NULL DEFAULT '',
  age_min INTEGER NOT NULL DEFAULT 18,
  age_max INTEGER NOT NULL DEFAULT 65,
  gender TEXT NOT NULL DEFAULT 'all',
  languages TEXT NOT NULL DEFAULT '',
  interests TEXT NOT NULL DEFAULT '',
  exclusions TEXT NOT NULL DEFAULT '',
  audiences TEXT NOT NULL DEFAULT '',
  advantage INTEGER NOT NULL DEFAULT 1,
  placements TEXT NOT NULL DEFAULT 'advantage',
  notes TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  meta_adset_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX cm_adsets_campaign ON cm_adsets(campaign_id);

CREATE TABLE cm_ads (
  id INTEGER PRIMARY KEY,
  adset_id INTEGER NOT NULL REFERENCES cm_adsets(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  angle TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'image',
  file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  media_url TEXT NOT NULL DEFAULT '',
  creative_id INTEGER REFERENCES creative_prompts(id) ON DELETE SET NULL,
  primary_text TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  variants_json TEXT NOT NULL DEFAULT '{}',
  cta TEXT NOT NULL DEFAULT 'LEARN_MORE',
  url TEXT NOT NULL DEFAULT '',
  utm TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  meta_ad_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX cm_ads_adset ON cm_ads(adset_id);

CREATE TABLE cm_notes (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES cm_campaigns(id) ON DELETE CASCADE,
  adset_id INTEGER,
  ad_id INTEGER,
  kind TEXT NOT NULL DEFAULT 'note',
  text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX cm_notes_campaign ON cm_notes(campaign_id);

