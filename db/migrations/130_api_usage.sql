-- Фаза 8: облік кожного виклику Claude API (токени і вартість), щоб бачити, скільки коштує Джері і автоматики
CREATE TABLE api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  feature TEXT NOT NULL DEFAULT '',     -- Джері, памʼять, радар, підтверди…
  model TEXT NOT NULL DEFAULT '',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write INTEGER NOT NULL DEFAULT 0,
  cache_read INTEGER NOT NULL DEFAULT 0,
  web_searches INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0
);
CREATE INDEX idx_api_usage_at ON api_usage(at);

INSERT INTO changelog (title, body, created_at) VALUES ('Скільки коштує API', 'Налаштування → «Витрати»: кожен виклик Claude записується (що саме — Джері, памʼять, радар, черга Підтверди, диктування…, модель, токени, ціна в $). Видно сьогодні / місяць / по функціях / по днях. Можна поставити місячний ліміт у $: на 80% і 100% прийде повідомлення в Telegram (система нічого сама не вимикає — вирішуєш ти). Ціни — за прайсом Anthropic станом на жовтень 2026; рахунок у platform.claude.com — головне джерело правди, тут оцінка.', datetime('now'));
