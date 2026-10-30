-- Meta: креативи в нормальній якості. image_url — повна картинка (або обкладинка відео),
-- kind — image | video | carousel, images_json — усі картинки каруселі, preview_url — перегляд оголошення як у Facebook
ALTER TABLE meta_ads ADD COLUMN image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE meta_ads ADD COLUMN kind TEXT NOT NULL DEFAULT '';
ALTER TABLE meta_ads ADD COLUMN video_id TEXT NOT NULL DEFAULT '';
ALTER TABLE meta_ads ADD COLUMN images_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE meta_ads ADD COLUMN preview_url TEXT NOT NULL DEFAULT '';
