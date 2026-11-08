-- Фаза 4 «Головна метрика»: що вважаємо успіхом для клієнта + історія значень (знімок раз на день)
CREATE TABLE client_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                -- crm_contact_pct | crm_sale_pct | crm_sales | crm_revenue | meta_leads | meta_cpl | manual
  name TEXT NOT NULL DEFAULT '',
  target REAL,                         -- ціль; порожня — без тривоги
  direction TEXT NOT NULL DEFAULT 'up',-- up — більше краще, down — менше краще
  is_main INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE client_metric_values (
  metric_id INTEGER NOT NULL REFERENCES client_metrics(id) ON DELETE CASCADE,
  day TEXT NOT NULL,                   -- YYYY-MM-DD за Києвом
  value REAL NOT NULL,
  PRIMARY KEY (metric_id, day)
);

INSERT INTO changelog (title, body, created_at) VALUES ('Головна метрика клієнта', 'На Огляді клієнта зверху — «Головна метрика»: що для цього клієнта означає успіх. Обираєш з готових (з CRM: «лід → контакт %», «лід → продаж %», продажі і сума за 30 днів; з Meta: ліди і ціна ліда за 7 днів) або «вручну» і ставиш ціль. Значення система записує сама раз на день — видно тренд. Якщо головна метрика гірша за ціль або впала на третину за 2 тижні — бейдж у «Потребують уваги» (продажі вище за рекламу). Джері: client_metrics (list/add/update/delete/value).', datetime('now'));
