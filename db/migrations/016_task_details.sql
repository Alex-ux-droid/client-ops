-- Задачі як робоче місце: підзадачі-чекліст, посилання/файли, пріоритет. details — інструкція в markdown.
ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high','normal','low'));

CREATE TABLE task_items (
  id       INTEGER PRIMARY KEY,
  task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text     TEXT NOT NULL,
  done     INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX task_items_task ON task_items(task_id, position);

CREATE TABLE task_links (
  id      INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title   TEXT NOT NULL DEFAULT '',
  url     TEXT NOT NULL
);
CREATE INDEX task_links_task ON task_links(task_id);

INSERT INTO changelog (title, body, created_at) VALUES
('Задачі: підзадачі, інструкції, посилання, вікно задачі',
'Клік по задачі відкриває вікно по центру: галочки-підзадачі з прогресом, інструкція (markdown: списки, жирне, посилання), посилання і файли (Google Диск, документи, Telegram), пріоритет, статус, дедлайн, клієнт, «закрити зі звітом», «Джері, допоможи». У списку видно прогрес підзадач і пріоритет. Джері: create_task/update_task вміють subtasks і links, task_items — відмітити/додати/видалити підзадачі. Багатокрокові задачі Джері розкладає на підзадачі, а «як зробити» пише в інструкцію.',
'2026-10-30 18:00:00');

-- Google Календар: подія для дедлайну задачі
ALTER TABLE tasks ADD COLUMN gcal_event_id TEXT;

INSERT INTO changelog (title, body, created_at) VALUES
('Google Календар для задач',
'У вікні задачі кнопка «📅 В Google Календар»: подія на день дедлайну з нагадуванням напередодні о 9:00, в описі — клієнт, підзадачі, інструкція і посилання на задачу. Якщо задача вже в календарі — подія оновлюється сама, коли міняєш назву, дату чи статус; видалив задачу — зникає й подія. Джері: task_to_calendar. Щоб працювало: увімкнути Google Calendar API в Google Cloud і один раз перепідключити Google (Налаштування → Конектори → Google). Автоматичне дублювання всіх задач — пізніше, коли вирішимо.',
'2026-10-30 18:10:00');
