-- AI-радар для всього бізнесу: 6 напрямків, оцінка «наскільки змінює гру», куди відправили картку.
ALTER TABLE ai_radar ADD COLUMN area TEXT NOT NULL DEFAULT 'creatives';  -- creatives|agents|automation|voice|dev|ads
ALTER TABLE ai_radar ADD COLUMN score INTEGER NOT NULL DEFAULT 0;        -- 1–5
ALTER TABLE ai_radar ADD COLUMN sent_to TEXT NOT NULL DEFAULT '';        -- style|idea|plan|ok
UPDATE ai_radar SET sent_to = 'style' WHERE status = 'accepted';
INSERT INTO settings (key, value) VALUES ('radar.repos', 'anthropics/skills
anthropics/claude-code
anthropics/claude-cookbooks
openai/openai-cookbook
modelcontextprotocol/servers
n8n-io/n8n')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now');

INSERT INTO changelog (title, body, created_at) VALUES ('AI-радар для всього бізнесу', 'Розвиток → нова вкладка «Радар». Раз на 3 дні Джері шукає, що нового в 6 напрямках: креативи, агенти і LLM, автоматизація бізнесу, голос і дзвінки, розробка, реклама Meta. Джерела: GitHub (репо, що найшвидше ростуть, і релізи ключових), Hacker News (топ про AI), офіційні блоги й розсилки (список правиться). Картка: що це → що дає нам і клієнтам → оцінка 1–5 «наскільки змінює гру». Дії: «В ідеї» / «В план розвитку» / «В стиль креативів» / «Корисно» / «Пропустити». Раз на місяць — «Карта ринку»: де зараз гра і 3 ідеї нових продуктів. Кинь Джері посилання з «радар» (у чаті чи Telegram) — зробить картку. Прийняте Джері бачить у кожній розмові. Ціна ≈5–8 $ на місяць. X, Telegram-канали і YouTube автоматично не читаються — пересилай посилання.', datetime('now'));
