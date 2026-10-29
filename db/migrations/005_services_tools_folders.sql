-- Клієнт: власник, масштаб, контакти, з якої дати ведемо, папка на Диску
ALTER TABLE clients ADD COLUMN owner_name TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN locations INTEGER NOT NULL DEFAULT 1;  -- скільки бізнесів / точок
ALTER TABLE clients ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN phone TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN work_since TEXT;                       -- YYYY-MM-DD
ALTER TABLE clients ADD COLUMN drive_url TEXT NOT NULL DEFAULT '';

-- Довідник інструментів: CRM, телефонія, платформи сайтів, хостинги
CREATE TABLE tools (
  id       INTEGER PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('crm','telephony','site','hosting')),
  name     TEXT NOT NULL,
  url      TEXT NOT NULL DEFAULT '',
  notes    TEXT NOT NULL DEFAULT '',
  UNIQUE (category, name)
);
INSERT INTO tools (category, name, url) VALUES
  ('crm','KeyCRM','https://keycrm.app'), ('crm','Bitrix24','https://www.bitrix24.ua'), ('crm','Kommo (amoCRM)','https://www.kommo.com'),
  ('crm','SalesDrive','https://salesdrive.ua'), ('crm','NetHunt CRM','https://nethunt.com'), ('crm','OneBox','https://onebox.ua'),
  ('crm','LP-CRM','https://lp-crm.biz'), ('crm','HubSpot','https://www.hubspot.com'), ('crm','Pipedrive','https://www.pipedrive.com'),
  ('crm','Zoho CRM','https://www.zoho.com/crm'), ('crm','Creatio','https://www.creatio.com'), ('crm','Odoo','https://www.odoo.com'),
  ('crm','Salesforce','https://www.salesforce.com'), ('crm','monday CRM','https://monday.com/crm'), ('crm','Google Таблиці','https://sheets.google.com'),
  ('telephony','Binotel','https://www.binotel.ua'), ('telephony','Ringostat','https://ringostat.com'), ('telephony','Phonet','https://phonet.ua'),
  ('telephony','Zadarma','https://zadarma.com'), ('telephony','Unitalk','https://unitalk.cloud'), ('telephony','Stream Telecom','https://stream-telecom.com'),
  ('telephony','Asterisk / FreePBX','https://www.freepbx.org'),
  ('site','WordPress',''), ('site','WooCommerce',''), ('site','Shopify','https://www.shopify.com'), ('site','Horoshop','https://horoshop.ua'),
  ('site','Tilda','https://tilda.cc'), ('site','Webflow','https://webflow.com'), ('site','Wix','https://www.wix.com'), ('site','OpenCart',''),
  ('site','Prom.ua','https://prom.ua'), ('site','Свій код (Next.js / React)',''),
  ('hosting','Cloudflare','https://www.cloudflare.com'), ('hosting','Vercel','https://vercel.com'), ('hosting','Hetzner','https://www.hetzner.com'),
  ('hosting','ukraine.com.ua','https://www.ukraine.com.ua'), ('hosting','Hostinger','https://www.hostinger.com'), ('hosting','De Novo','https://www.denovo.ua'),
  ('hosting','Shopify / Horoshop (вбудований)','');

-- Послуги, які ми надаємо клієнту. Кожна увімкнена послуга = вкладка в картці.
CREATE TABLE client_services (
  id           INTEGER PRIMARY KEY,
  client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','done')),
  started_at   TEXT,
  tool_id      INTEGER REFERENCES tools(id) ON DELETE SET NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, type)
);

-- Папки клієнта (Google Диск або будь-які посилання)
CREATE TABLE client_folders (
  id         INTEGER PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  url        TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, kind)
);
