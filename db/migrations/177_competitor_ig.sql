-- Автопостинг, крок 7: Instagram конкурентів (Business Discovery) → ідеї в план
CREATE TABLE IF NOT EXISTS competitor_ig (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  profile_json TEXT NOT NULL DEFAULT '{}',
  posts_json TEXT NOT NULL DEFAULT '[]',
  error TEXT NOT NULL DEFAULT '',
  fetched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, username)
);
INSERT INTO changelog (title, body, created_at) VALUES ('Автопостинг: конкуренти в Instagram', 'Контент → Аналіз → «Конкуренти в Instagram»: додай @акаунти конкурентів (бізнес- або автор-акаунти; Instagram посилання з карти конкурентів підставляються самі) → «Оновити» тягне їхні останні 25 постів: підписники, частота, лайки й коментарі на пост, формати, топ-пости. Охоплення чужих акаунтів Instagram не віддає — порівняння за реакціями. «Розібрати конкурентів» — Джері каже, що в них заходить, чого в нас нема, і дає ідеї; ідеї самі йдуть в автоплан. Щопонеділка оновлюється разом із тижневим розбором (той самий тумблер).', datetime('now'));
