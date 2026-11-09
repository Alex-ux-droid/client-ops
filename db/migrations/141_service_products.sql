-- Послуга клієнта (сайт, CRM, автоматизація) веде свій «паспорт розвитку» як продукт
ALTER TABLE products ADD COLUMN client_id INTEGER;
ALTER TABLE products ADD COLUMN service_type TEXT;
CREATE INDEX IF NOT EXISTS products_client_service ON products(client_id, service_type);
INSERT INTO changelog (title, body, created_at) VALUES ('Сайт, CRM, автоматизація клієнта — промпт і розвиток', 'У вкладках послуг «Сайт», «CRM», «Автоматизація» тепер блок «Розвиток». Кнопка «Промпт: повна витяжка» → вставляєш у чат Claude, де робиш цю систему клієнту → він видає паспорт (що зроблено, фічі, інтеграції/API, що ламалось, ідеї як розвивати) → вставляєш відповідь назад у «Вставити витяжку». Далі кнопка «Промпт: оновлення N» — тільки нове з минулого разу. Усе копиться: хронологія, фічі, ідеї для клієнта (що можна запропонувати далі). Повний паспорт — у «Продуктах».', datetime('now'));
