-- Бібліотека лід-форм клієнта (копія конструктора Meta Instant Form з готовими значеннями) + версії для тестів
CREATE TABLE cm_forms (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  parent_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  form_type TEXT NOT NULL DEFAULT 'volume',
  intro_headline TEXT NOT NULL DEFAULT '',
  intro_text TEXT NOT NULL DEFAULT '',
  questions TEXT NOT NULL DEFAULT '',
  privacy_text TEXT NOT NULL DEFAULT '',
  privacy_url TEXT NOT NULL DEFAULT '',
  thanks_headline TEXT NOT NULL DEFAULT '',
  thanks_text TEXT NOT NULL DEFAULT '',
  thanks_button TEXT NOT NULL DEFAULT '',
  thanks_url TEXT NOT NULL DEFAULT '',
  changes TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX cm_forms_client ON cm_forms(client_id);
ALTER TABLE cm_ads ADD COLUMN form_id INTEGER REFERENCES cm_forms(id) ON DELETE SET NULL;
INSERT INTO changelog (title, body, created_at) VALUES ('Лід-форми: бібліотека клієнта', 'Клієнт → Meta Ads → «Лід-форми»: усі форми клієнта в одному місці. Кожна форма — як конструктор миттєвої форми Meta, але вже заповнена: тип (більше заявок / вища якість), вступ, питання, політика конфіденційності, екран «Дякуємо» — біля кожного поля «Копіювати», поруч прев''ю як на телефоні. У кожного оголошення своя форма: вибираєш з бібліотеки або «✨ Нова форма від Джері». Джері сам робить форму для кожної групи, коли збирає кампанію. Зміни — спершу тут: «Нова версія» зберігає стару, і видно, скільки заявок і почім дала кожна версія (за оголошеннями, де вона стоїть). Питання пишуться по рядку: «Імʼя», «Телефон», «Email», «Місто» — стандартні поля Meta; «? Питання | варіант | варіант» — питання з варіантами; «? Питання» — коротка відповідь.', datetime('now'));
