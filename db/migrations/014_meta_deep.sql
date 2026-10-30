-- Meta: глибше — групи оголошень, охоплення, розрізи (плейсменти, вік/стать, регіони, пристрої), аналіз Джері
CREATE TABLE meta_adsets (
  adset_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES meta_accounts(account_id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  daily_budget REAL,
  lifetime_budget REAL,
  optimization_goal TEXT NOT NULL DEFAULT '',
  spend_30d REAL NOT NULL DEFAULT 0,
  impressions_30d INTEGER NOT NULL DEFAULT 0,
  clicks_30d INTEGER NOT NULL DEFAULT 0,
  leads_30d INTEGER NOT NULL DEFAULT 0,
  reach_30d INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX meta_adsets_account ON meta_adsets(account_id);

ALTER TABLE meta_ads ADD COLUMN adset_id TEXT NOT NULL DEFAULT '';
ALTER TABLE meta_ads ADD COLUMN reach_30d INTEGER NOT NULL DEFAULT 0;

-- Розрізи за 30 днів. kind: total | placement | age_gender | region | device
CREATE TABLE meta_breakdowns (
  account_id TEXT NOT NULL REFERENCES meta_accounts(account_id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  spend REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, kind, key)
);

-- Розбір реклами від Джері (JSON: підсумок, плюси, мінуси, поради, думка по креативах)
CREATE TABLE meta_analysis (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
