-- Пульс сайту: що роблять люди на сайті клієнта (без особистих даних). Пише маленький скрипт на сайті → /api/site/<ключ>.
CREATE TABLE site_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  at TEXT NOT NULL,                 -- UTC ISO
  kind TEXT NOT NULL,               -- view | click | form_start | form_submit | form_success | form_error | scroll | js_error
  page TEXT NOT NULL DEFAULT '',    -- шлях без query
  label TEXT NOT NULL DEFAULT '',   -- що натиснули / яка форма / глибина / текст помилки
  source TEXT NOT NULL DEFAULT '',  -- facebook | instagram | google | direct | referral:<домен> | utm_source
  session TEXT NOT NULL DEFAULT '', -- випадковий id вкладки (не людини)
  device TEXT NOT NULL DEFAULT ''   -- mobile | desktop
);
CREATE INDEX idx_site_events ON site_events(product_id, at);
INSERT INTO changelog (title, body, created_at) VALUES ('Пульс сайту: що роблять люди на сайті', 'Сайти, які ми робимо, тепер можуть звітувати в систему: скільки зайшло і звідки (реклама Facebook/Instagram, Google, напряму), що натискають (кнопки, телефон, месенджери), скільки почали і відправили форму, де відвалюються, як глибоко гортають, з телефону чи компʼютера, і помилки на сторінці. Як підключити: проєкт сайту → «Пульс сайту» → «Промпт: підключити» → вставити в чат Claude Code цього сайту. Особисті дані (телефони, імена, текст форм) не передаються. Помилки сайту падають у «Що виправити» і в Telegram. Дані зберігаються 90 днів.', datetime('now'));
