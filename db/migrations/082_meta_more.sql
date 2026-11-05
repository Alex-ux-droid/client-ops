-- Meta: глибше дані. Відео-метрики, покупки, проблеми оголошення — extra_json; навчання і таргетинг групи — extra_json.
ALTER TABLE meta_ads ADD COLUMN extra_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE meta_adsets ADD COLUMN extra_json TEXT NOT NULL DEFAULT '{}';
-- Цифри кожного оголошення по днях (30 днів) — видно, коли креатив почав «вигорати»
CREATE TABLE meta_ad_daily (
  account_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  date TEXT NOT NULL,
  spend REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ad_id, date)
);
CREATE INDEX meta_ad_daily_account ON meta_ad_daily(account_id, date);
-- Історія по місяцях (12 міс) — сезонність, місяць до місяця
CREATE TABLE meta_monthly (
  account_id TEXT NOT NULL,
  month TEXT NOT NULL,
  spend REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  purchases INTEGER NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, month)
);
