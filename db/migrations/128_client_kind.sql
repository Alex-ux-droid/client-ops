-- Фаза 3 «Тип сутності»: клієнт чи партнерство, модель доходу, частка, партнери (тільки додаємо колонки)
ALTER TABLE clients ADD COLUMN kind TEXT NOT NULL DEFAULT 'client';            -- client | partner
ALTER TABLE clients ADD COLUMN revenue_model TEXT NOT NULL DEFAULT 'retainer'; -- retainer | profit_share | mixed | project | none
ALTER TABLE clients ADD COLUMN share_percent REAL NOT NULL DEFAULT 0;           -- моя частка, %
ALTER TABLE clients ADD COLUMN partners TEXT NOT NULL DEFAULT '';               -- хто партнери і хто за що, по рядку

INSERT INTO changelog (title, body, created_at) VALUES ('Клієнт чи партнерство', 'У картці клієнта (Редагувати → Гроші) тепер є «Тип»: клієнт або партнерство, «Як я заробляю»: абонплата / частка прибутку / абонплата + частка / разова оплата / без оплати, «Моя частка, %» і «Партнери» (хто за що). Для партнерства абонплата 0 — це норма: на Огляді замість «абонплату не вказано» видно «партнерство · частка N%». У списку клієнтів — фільтр «Клієнти / Партнерства». Джері знає тип і частку (update_client: kind, revenue_model, share_percent, partners).', datetime('now'));
