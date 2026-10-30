-- Telegram: фото і файли з груп. tg_file_id — щоб скачати з Telegram (бот бачить до 20 МБ),
-- drive_id — копія в папці клієнта на Google Диску (підпапка «Telegram»)
ALTER TABLE tg_messages ADD COLUMN tg_file_id TEXT NOT NULL DEFAULT '';
ALTER TABLE tg_messages ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tg_messages ADD COLUMN mime TEXT NOT NULL DEFAULT '';
ALTER TABLE tg_messages ADD COLUMN drive_id TEXT NOT NULL DEFAULT '';
