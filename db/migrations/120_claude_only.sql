-- Саша робить креативи ТІЛЬКИ в Claude: без Midjourney / Higgsfield / CapCut
INSERT INTO settings (key, value) VALUES ('creative.tools', 'Тільки Claude: ідея, тексти, статика (HTML/CSS → PNG), каруселі, моушен (HTML/CSS/SVG-анімація)')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now');
UPDATE creative_styles SET active = 0, updated_at = datetime('now')
  WHERE title LIKE '%Midjourney%' OR title LIKE '%Higgsfield%' OR title LIKE '%CapCut%';
INSERT INTO creative_styles (kind, title, body, source) VALUES
('general', 'Робимо все в Claude', '- Усі креативи — в одному чаті Claude: статика як HTML/CSS-сторінка рівно під розмір (зберегти PNG), карусель — кілька таких сторінок, моушен — HTML/CSS/SVG-анімація 6–10 с.
- Фото не генеруємо: беремо справжні фото / рендери клієнта (брендбук, папка клієнта), Claude робить дизайн поверх — заголовок, ціна, плашки, CTA.
- Немає фото — графічний креатив: типографіка, іконки, інфографіка, кольори бренду.
- Текст на креативі коротко: заголовок до 6–7 слів + 1 рядок (ціна / вигода / заклик). 9:16 — без тексту у верхніх 250 і нижніх 340 px.
- Шрифти і кольори — з брендбуку клієнта.', 'seed');
INSERT INTO changelog (title, body, created_at) VALUES ('Креативи — тільки в Claude', 'Джері більше не пропонує Midjourney / Higgsfield / CapCut. Бриф кожного креативу — завдання для Claude: статика HTML/CSS рівно під розмір (зберегти PNG), карусель, моушен HTML/CSS/SVG-анімацією. Фото не генеруються — Claude робить дизайн поверх справжніх фото/рендерів клієнта або графічний креатив. Старі шаблони стилю з Midjourney/Higgsfield/CapCut вимкнено (не видалено), додано «Робимо все в Claude».', datetime('now'));
