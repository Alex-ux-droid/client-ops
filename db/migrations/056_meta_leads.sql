-- Заявки з лід-форм Meta: сторінки (привʼязка до клієнта), форми (підписи питань), самі заявки + статус з Telegram-кнопок
CREATE TABLE meta_pages (
  page_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  leads_on INTEGER NOT NULL DEFAULT 0,  -- 1 — надсилати заявки в Telegram-групу клієнта
  last_lead_time TEXT,          -- ISO останньої обробленої заявки (звідки тягти далі)
  last_error TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE meta_lead_forms (
  form_id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  questions_json TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL UNIQUE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  page_id TEXT NOT NULL DEFAULT '',
  form_id TEXT NOT NULL DEFAULT '',
  form_name TEXT NOT NULL DEFAULT '',
  ad_id TEXT NOT NULL DEFAULT '',
  ad_name TEXT NOT NULL DEFAULT '',
  adset_name TEXT NOT NULL DEFAULT '',
  campaign_name TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  created_time TEXT NOT NULL,   -- ISO UTC з Meta
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  fields_json TEXT NOT NULL DEFAULT '[]', -- [{label, value}]
  quality TEXT NOT NULL DEFAULT '',        -- '' | good | bad
  quality_by TEXT NOT NULL DEFAULT '',
  taken_at TEXT,
  taken_by TEXT NOT NULL DEFAULT '',
  notified_at TEXT,             -- 'backfill' — стара, не надсилали
  tg_chat_id INTEGER,
  tg_message_id INTEGER,
  reminded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_leads_client ON leads(client_id, created_time);
