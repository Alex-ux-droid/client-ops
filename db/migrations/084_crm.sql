-- CRM клієнта (Oselya CRM): продажі з усіх джерел. Ключ і секрет — тільки в .env (CRM_KEY_<id>, CRM_SECRET_<id>).
CREATE TABLE crm_links (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  last_event_at TEXT,
  last_pull_at TEXT,
  pull_since TEXT,
  last_error TEXT NOT NULL DEFAULT '',
  stages_json TEXT NOT NULL DEFAULT '',
  summary_json TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE crm_leads (
  client_id INTEGER NOT NULL,
  crm_id INTEGER NOT NULL,
  contact_id INTEGER,
  meta_lead_id TEXT NOT NULL DEFAULT '',
  meta_ad_id TEXT NOT NULL DEFAULT '',
  meta_adset_id TEXT NOT NULL DEFAULT '',
  meta_campaign_id TEXT NOT NULL DEFAULT '',
  ad_name TEXT NOT NULL DEFAULT '',
  campaign_name TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  status_raw TEXT NOT NULL DEFAULT '',
  deal_amount REAL,
  paid_amount REAL,
  cost_amount REAL,
  currency TEXT NOT NULL DEFAULT '',
  won_at TEXT,
  paid_at TEXT,
  lost_reason TEXT NOT NULL DEFAULT '',
  lost_comment TEXT NOT NULL DEFAULT '',
  manager TEXT NOT NULL DEFAULT '',
  first_contact_at TEXT,
  call_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (client_id, crm_id)
);
CREATE INDEX crm_leads_ad ON crm_leads(client_id, meta_ad_id);
CREATE INDEX crm_leads_meta ON crm_leads(meta_lead_id);
CREATE TABLE crm_events (
  event_id TEXT PRIMARY KEY,
  client_id INTEGER NOT NULL,
  event TEXT NOT NULL,
  crm_id INTEGER,
  summary TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX crm_events_client ON crm_events(client_id, occurred_at);
-- Витрати і ліди Meta по кожному оголошенню за весь час — щоб рахувати ціну продажу і ROAS навіть для старих оголошень
CREATE TABLE meta_ad_total (
  account_id TEXT NOT NULL,
  ad_id TEXT NOT NULL PRIMARY KEY,
  ad_name TEXT NOT NULL DEFAULT '',
  campaign_name TEXT NOT NULL DEFAULT '',
  spend REAL NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX meta_ad_total_account ON meta_ad_total(account_id);
