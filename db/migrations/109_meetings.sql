-- Зустрічі з клієнтом: тези під час зустрічі (автозбереження), потім розбір з Джері.
CREATE TABLE meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',   -- new — ще не розібрали | done — розібрано
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_meetings ON meetings(client_id, created_at);
INSERT INTO changelog (title, body, created_at) VALUES ('Зустрічі з клієнтом', 'У картці клієнта кнопка «Зустріч» (вгорі, на будь-якій вкладці): відкривається велике вікно — пишеш або диктуєш тези прямо під час зустрічі, усе зберігається само кожні кілька секунд. Закрив — можна продовжити пізніше. На Огляді клієнта — плитка «Зустрічі»: перечитати, «Розібрати з Джері» (дописує памʼять клієнта, домовленості, задачі) і «Розібрано». Джері бачить нерозібрані зустрічі в знімку клієнта.', datetime('now'));
