-- Аналіз акаунтів клієнта (Instagram + Facebook): останній знімок профілю і постів з метриками, розбір Джері
CREATE TABLE IF NOT EXISTS social_snapshots (
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  network TEXT NOT NULL, -- ig | fb
  profile_json TEXT NOT NULL DEFAULT '{}',
  posts_json TEXT NOT NULL DEFAULT '[]',
  error TEXT NOT NULL DEFAULT '',
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (client_id, network)
);
INSERT INTO changelog (title, body, created_at) VALUES ('Контент → Аналіз: Instagram і Facebook клієнта', 'Нова вкладка «Аналіз» у студії контенту: підписники, скільки постів за 30 днів, середнє охоплення, залученість; останні пости з цифрами (охоплення, збереження, репости, лайки, коментарі); що заходить по форматах (Reels / каруселі / фото). Кнопка «Розібрати» — Джері коротко: що працює, що ні, 3 дії. Цифри — з Meta через наш токен; «Оновити» тягне свіжі.', datetime('now'));
