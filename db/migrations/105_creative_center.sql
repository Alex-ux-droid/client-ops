-- Центр креативів: мої шаблони стилю (йдуть у кожен промпт креативу) і AI-радар (що нового в AI для креативів).
CREATE TABLE creative_styles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'general',   -- general або ключ формату: square|feed|story|carousel|motion|video|ugc|imagegen
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'manual',  -- manual | radar | seed
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ai_radar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  what TEXT NOT NULL DEFAULT '',          -- що це
  how TEXT NOT NULL DEFAULT '',           -- як нам використати
  hint_style_id INTEGER,                  -- який шаблон оновити (або NULL — новий)
  hint_kind TEXT NOT NULL DEFAULT '',
  hint_title TEXT NOT NULL DEFAULT '',
  hint_body TEXT NOT NULL DEFAULT '',     -- що дописати в шаблон
  status TEXT NOT NULL DEFAULT 'new',     -- new | accepted | skipped
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ai_radar ON ai_radar(status, created_at);

INSERT INTO creative_styles (kind, title, body, source) VALUES
('general', 'Meta 2026: базові правила', '- Різноманітність концептів важливіша за мікроваріації: алгоритм Meta (Andromeda) сам підбирає аудиторію під креатив, тому тестуємо РІЗНІ кути (біль, результат, довіра, ціна, процес), а не 5 версій одного банера.
- Вертикаль перш за все: 9:16 для Reels/Stories, 4:5 для стрічки; квадрат — лише як запасний.
- Перша секунда / заголовок: одна думка, читається за 1 секунду на телефоні, великий контрастний текст.
- Безпечні зони 9:16: верхні ~250 px і нижні ~340 px без тексту і логотипа.
- Advantage+ Creative вмикає «покращення» за замовчуванням (з лютого 2026 у нових кампаніях на ліди) — для брендових креативів вирішуй свідомо, що лишити.
- Якщо в креативі згенеровані реалістичні люди/сцени — Meta вимагає позначку AI (з березня 2026); краще чесний стиль, ніж «фейкове фото».', 'seed'),
('square', 'Статика: як робити в Claude', '- Роби як HTML/CSS рівно потрібного розміру; шрифт з Google Fonts; текст — живим текстом, не картинкою.
- У Claude Code краще з офіційними скілами Anthropic: frontend-design (верстка з характером, не «шаблонна») або canvas-design (постер/арт у PNG/PDF).
- 2 варіанти А/Б, що відрізняються ОДНИМ елементом (заголовок або візуал).', 'seed'),
('motion', 'Моушен: HTML-анімація', '- HTML/CSS/SVG-анімація 1080×1920, 6–10 с, зациклена; таймлайн по секундах: 0–1 с хук, 1–6 с суть, останні 2 с CTA.
- Рух має вести око до головного (текст зʼявляється по словах, обʼєкт наближається), без мельтешіння.
- Альтернатива: статика 4:5/9:16 → у Ads Manager інструмент Meta «зображення → відео» (Advantage+ Creative).', 'seed'),
('ugc', 'UGC: живе відео з телефону', '- Хук-фраза в першу секунду, природна мова, без «рекламного» тону; 20–30 с.
- Субтитри великі, по 2–4 слова; знімати вертикально при денному світлі.
- Показати процес/результат руками, а не розповідати.', 'seed'),
('imagegen', 'Генератори фото/відео', '- Промпти англійською: обʼєкт, композиція, світло, обʼєктив/камера, стиль, співвідношення сторін (--ar 4:5 або 9:16).
- Текст НЕ генерувати всередині фото — накладати окремо.
- Реалістичних людей уникати або позначати AI у Meta.', 'seed');

INSERT INTO changelog (title, body, created_at) VALUES ('Центр креативів і AI-радар', 'Новий пункт меню «Креативи» (під «Рекламою»):
• Огляд — креативи всіх клієнтів: скільки в роботі, переможці, що працює за форматами.
• Мій стиль — шаблони (загальні правила Meta 2026 + по форматах: статика, моушен, UGC, генератори). Активні шаблони самі йдуть у кожен промпт креативу і в «Хто ми». Правиш — і всі нові промпти вже по-новому.
• AI-радар — раз на тиждень Джері перевіряє GitHub (офіційні скіли Anthropic, cookbooks) і новини (Anthropic, OpenAI, Meta, генератори фото/відео) і пише картки «що нового → як нам використати». «Прийняти» — дописує в шаблон, «Пропустити» — ховає. Кнопка «Перевірити зараз». Тумблер — Можливості → «AI-радар креативів» (≈5–15 центів за прогін).
• «Чим робимо креативи» — впиши свої інструменти (Midjourney, Higgsfield…), щоб промпти і радар були під них.', datetime('now'));
