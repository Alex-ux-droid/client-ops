-- Порядок у конекторі Meta: зайві кабінети і сторінки можна сховати (сторінки, сховані — ще й не опитуються на заявки)
ALTER TABLE meta_accounts ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE meta_pages ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
