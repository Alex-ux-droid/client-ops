-- Meta Ads (тільки читання): кабінети, цифри по днях і кампаніях, оголошення з креативами
CREATE TABLE meta_accounts (
  account_id TEXT PRIMARY KEY,               -- act_123…
  name TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT '',
  account_status INTEGER,                    -- 1 активний; інше — проблема (блок, оплата…)
  disable_reason INTEGER,
  business_name TEXT NOT NULL DEFAULT '',
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  last_sync_at TEXT,
  last_error TEXT NOT NULL DEFAULT ''
);

CREATE TABLE meta_campaigns (
  campaign_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES meta_accounts(account_id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',           -- effective_status: ACTIVE, PAUSED…
  objective TEXT NOT NULL DEFAULT '',
  daily_budget REAL,                         -- у валюті кабінету (не в центах)
  lifetime_budget REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Цифри по кампаніях за кожен день (останні 30 днів перезаписуються при синхронізації)
CREATE TABLE meta_daily (
  account_id TEXT NOT NULL REFERENCES meta_accounts(account_id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  date TEXT NOT NULL,
  spend REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, campaign_id, date)
);

-- Оголошення: креатив і сума за останні 30 днів
CREATE TABLE meta_ads (
  ad_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES meta_accounts(account_id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  spend_30d REAL NOT NULL DEFAULT 0,
  impressions_30d INTEGER NOT NULL DEFAULT 0,
  clicks_30d INTEGER NOT NULL DEFAULT 0,
  leads_30d INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX meta_accounts_client ON meta_accounts(client_id);
CREATE INDEX meta_daily_date ON meta_daily(account_id, date);
CREATE INDEX meta_ads_account ON meta_ads(account_id);
