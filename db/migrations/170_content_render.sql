-- Автопостинг, крок 2: готовий файл поста (рендер), повідомлення апруву в Telegram, помилка публікації
ALTER TABLE content_posts ADD COLUMN media_path TEXT NOT NULL DEFAULT '';
ALTER TABLE content_posts ADD COLUMN media_at TEXT;
ALTER TABLE content_posts ADD COLUMN tg_msg_id INTEGER;
ALTER TABLE content_posts ADD COLUMN publish_error TEXT NOT NULL DEFAULT '';
ALTER TABLE social_profiles ADD COLUMN palette_json TEXT NOT NULL DEFAULT '';
UPDATE content_templates SET status = 'trial', slots = 'рендер, факт ≤40 симв., підпис ≤90, CTA ≤26' WHERE key = 'story-fact';
INSERT INTO changelog (title, body, created_at) VALUES ('Автопостинг: перша сторіс від початку до кінця', 'Контент → Пости: пост з шаблоном «Сторіс «Факт»» — обираєш реальний рендер з матеріалів, пишеш кікер, факт, підпис і CTA (або «Джері, заповни» з тем і фактів клієнта) → «Зібрати» — система малює сторіс 1080×1920 у стилі каталогу клієнта (рендер угорі, хвиля, кольори з Налаштувань студії, логотип — з матеріалів типу «Лого»). «На апрув» — сторіс приходить тобі в Telegram з кнопками ✓ / ✕. Після ✓ публікується в Instagram у свій час (або одразу, якщо час минув). Кнопка «Перевірити доступ до публікації» в Налаштуваннях студії — пробує підготувати публікацію, нічого не викладаючи. Тумблер: Можливості → «Публікація постів».', datetime('now'));
