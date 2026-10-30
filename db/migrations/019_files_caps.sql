-- Файли, які робить система/Джері (PDF тощо). Самі файли — на диску поруч з базою (data/files), тут — опис.
CREATE TABLE files (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  mime       TEXT NOT NULL DEFAULT 'application/octet-stream',
  size       INTEGER NOT NULL DEFAULT 0,
  path       TEXT NOT NULL,
  client_id  INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  source     TEXT NOT NULL DEFAULT 'assistant',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO changelog (title, body, created_at) VALUES
('Джері робить PDF і надсилає файли в Telegram',
'Джері вміє зробити PDF (A4, фірмовий шрифт Onest: заголовки, списки, жирне, таблиці простим текстом) — інструмент make_pdf. У чаті системи зʼявляється посилання на файл, у Telegram файл приходить документом. Також telegram_send — написати Саші в Telegram або надіслати файл з будь-якої розмови.',
'2026-10-30 22:20:00'),
('Налаштування → «Можливості»: тумблери на все',
'Нова вкладка в Налаштуваннях. «Що Джері може»: змінювати дані, видаляти, памʼять, файли/PDF, писати в Telegram, пошта, Диск, календар, Meta-привʼязка, журнал, база знань, Лабораторія — кожне вмикається/вимикається. «Що система робить сама»: ранкове зведення, тижневий розбір реклами від Джері (кредити), бекап на Диск, фото з Telegram на Диск, самонавчання памʼяті Джері. За замовчуванням усе увімкнено. Якщо Джері просять те, що вимкнено, — він каже, де увімкнути.',
'2026-10-30 22:21:00');
