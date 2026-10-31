INSERT INTO changelog (title, body, created_at) VALUES
('GitHub для Джері (і приватні репозиторії)',
'Налаштування → Конектори → GitHub: вставити токен тільки на читання — і Джері бачить твої репозиторії, включно з приватними: список, папки і файли, пошук по коду, задачі і PR, останні коміти. Нічого не змінює. Інструменти: github_repos, github_browse, github_search, github_issues, github_commits. Вимикається в «Можливостях».',
'2026-10-31 13:30:00');

INSERT INTO kb_articles (title, category, body_md) VALUES
('GitHub: підключити токен для Джері', 'Підключення',
'Щоб Джері бачив твої репозиторії (і приватні) — тільки читання.

1. Відкрий **github.com/settings/personal-access-tokens/new** (Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token).
2. Назва: «Client Ops — Джері». Expiration — 1 рік.
3. Repository access: **All repositories** (або тільки потрібні).
4. Repository permissions: **Contents — Read-only**, **Issues — Read-only**, **Pull requests — Read-only**. Metadata стане Read-only сама. Більше нічого не вмикати.
5. Generate token → скопіювати (видно тільки раз).
6. Client Ops → Налаштування → Конектори → GitHub → вставити → «Підключити».

Коли токен протермінується, Джері скаже «токен GitHub не працює» — повторити кроки і вставити новий.');
