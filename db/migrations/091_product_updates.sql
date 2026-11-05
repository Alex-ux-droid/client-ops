-- Оновлення продукту: кожна витяжка після стартового паспорта = «Оновлення N». ver: 0 — старт (повний паспорт), 1, 2, … — оновлення.
ALTER TABLE product_items ADD COLUMN ver INTEGER;
-- Записи, що вже були з витяжок, — стартовий паспорт
UPDATE product_items SET ver = 0 WHERE source = 'extract';
