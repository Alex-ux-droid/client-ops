-- Доробки фаз 3/4/8 за ТЗ v2: клієнт у витратах API, базове значення метрики, метрики CRM за замовчуванням
ALTER TABLE api_usage ADD COLUMN client_id INTEGER;
ALTER TABLE client_metrics ADD COLUMN baseline REAL;

-- Клієнтам з підключеною CRM без жодної метрики — «лід → контакт %» (головна) і «лід → продаж %»
INSERT INTO client_metrics (client_id, source, direction, is_main)
  SELECT l.client_id, 'crm_contact_pct', 'up', 1 FROM crm_links l WHERE NOT EXISTS (SELECT 1 FROM client_metrics m WHERE m.client_id = l.client_id);
INSERT INTO client_metrics (client_id, source, direction, is_main)
  SELECT l.client_id, 'crm_sale_pct', 'up', 0 FROM crm_links l WHERE NOT EXISTS (SELECT 1 FROM client_metrics m WHERE m.client_id = l.client_id AND m.source = 'crm_sale_pct');

INSERT INTO changelog (title, body, created_at) VALUES ('Метрики: база, CRM за замовчуванням, усюди на виду', 'Що додали:
- У клієнтів з CRM самі зʼявились метрики «лід → контакт %» (головна) і «лід → продаж %». Ціль і «база» (як було до нас) — у Огляд → Головна метрика.
- Головна метрика видно в шапці клієнта, у списку клієнтів і на Центрі.
- Нові тривоги: метрика гірша за базу; ручна метрика не оновлювалась 7+ днів; 0 продажів за 14 днів, коли реклама крутиться. Бейдж «без контакту» тепер виглядає як «без контакту N (X%)».
- План доходу на Центрі рахує тільки абонплату (партнерства з часткою — окремо). Тип «Свій продукт».
- Витрати API видно і по клієнтах. Ключ доступу Claude — 7 днів (як у ТЗ).
- Памʼять Джері: на 90% вона сама стискається (дублі зливаються), а стара версія повністю йде в архів — нічого не губиться.', datetime('now'));
