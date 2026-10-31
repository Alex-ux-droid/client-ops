-- Опори стартапу як система: ідея (формула + стрес-тест), маркетинг (воронка). Сегменти, кути, канали, модулі,
-- інфраструктура, релізи, розмови з клієнтами, альтернативи, версії формули — це startup_items з новими kind.
ALTER TABLE startups ADD COLUMN idea_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE startups ADD COLUMN mkt_json TEXT NOT NULL DEFAULT '{}';
