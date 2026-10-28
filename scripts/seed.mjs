// Тестові дані. Тільки вигадані клієнти, жодних реальних даних.
// Запуск: npm run db:seed (додає дані, якщо база порожня), npm run db:reset (з нуля).
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { dbPath, migrate } from "../lib/migrate.mjs";

const file = dbPath();
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new Database(file);
db.pragma("foreign_keys = ON");
migrate(db, path.join(process.cwd(), "db", "migrations"));

if (db.prepare("SELECT COUNT(*) AS n FROM clients").get().n > 0) {
  console.log("База вже має дані, seed пропущено. Для чистого старту: npm run db:reset");
  process.exit(0);
}

const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const clients = [
  {
    name: "Тест: Стоматологія «Посмішка»", niche: "медицина", status: "active",
    offer: "Facebook-реклама + CRM", budget: "$1200/міс реклама, $500 моя робота",
    contacts: "Адмін: Олена (тестовий контакт)", needs: "Більше записів на імплантацію, менше пропущених дзвінків",
    client_vision: "Хочуть 40 нових пацієнтів на місяць", my_vision: "Спочатку CRM і скрипти адмінам, потім масштабувати рекламу",
    notes: "Рішення приймає власник, відповідає ввечері", bitwarden_ref: "Bitwarden: Posmishka / FB Ads",
  },
  {
    name: "Тест: Школа англійської «Speakly»", niche: "освіта", status: "active",
    offer: "Сайт + реклама", budget: "$800/міс",
    contacts: "Менеджер: Ігор (тестовий контакт)", needs: "Ліди на пробний урок",
    client_vision: "Лендинг як у конкурентів", my_vision: "Квіз-лендинг, ліди одразу в CRM",
    notes: "", bitwarden_ref: "Bitwarden: Speakly / Hosting",
  },
  {
    name: "Тест: Меблі на замовлення «Дуб»", niche: "виробництво", status: "lead",
    offer: "Налаштування відділу продажу", budget: "обговорюємо",
    contacts: "Власник: Андрій (тестовий контакт)", needs: "Менеджери губляться в заявках",
    client_vision: "", my_vision: "CRM + телефонія + навчання 2 менеджерів",
    notes: "Дзвінок-знайомство був на минулому тижні", bitwarden_ref: "",
  },
];

const insClient = db.prepare(`INSERT INTO clients (name, niche, status, offer, budget, contacts, needs, client_vision, my_vision, notes, bitwarden_ref)
  VALUES (@name, @niche, @status, @offer, @budget, @contacts, @needs, @client_vision, @my_vision, @notes, @bitwarden_ref)`);
const ids = clients.map((c) => Number(insClient.run(c).lastInsertRowid));

const insTask = db.prepare("INSERT INTO tasks (client_id, title, details, status, due_date) VALUES (?, ?, ?, ?, ?)");
[
  [ids[0], "Перевірити ліди з Facebook за вчора", "", "todo", day(-1)],
  [ids[0], "Звіт по рекламі за тиждень", "CPL, кількість записів", "todo", day(0)],
  [ids[1], "Зібрати тексти для квіз-лендингу", "", "doing", day(0)],
  [ids[1], "Налаштувати пуш лідів у CRM", "", "todo", day(2)],
  [ids[2], "Відправити комерційну пропозицію", "", "todo", day(1)],
  [ids[2], "Демо CRM для менеджерів", "", "todo", day(9)],
  [null, "Оновити свій плейбук по телефонії", "", "todo", null],
].forEach((t) => insTask.run(...t));

const insWork = db.prepare("INSERT INTO work_log (client_id, done_at, what, why, result) VALUES (?, ?, ?, ?, ?)");
[
  [ids[0], day(-7), "Запустив нову кампанію на імплантацію", "Стара вигоріла, CPL виріс до $18", "CPL $11 за перші 3 дні"],
  [ids[0], day(-3), "Налаштував воронку в CRM", "Адміни губили заявки", "Всі ліди тепер з етапами"],
  [ids[1], day(-2), "Зібрав структуру лендингу", "Клієнт хоче як у конкурентів", "Погодили 5 блоків"],
].forEach((w) => insWork.run(...w));

const insIdea = db.prepare("INSERT INTO ideas (client_id, text) VALUES (?, ?)");
[
  [ids[0], "Відео-відгуки пацієнтів для реклами"],
  [ids[1], "Безкоштовний тест рівня англійської як лід-магніт"],
  [null, "Зробити шаблон звіту для всіх клієнтів"],
].forEach((i) => insIdea.run(...i));

db.prepare("INSERT INTO materials (client_id, kind, title, content) VALUES (?, ?, ?, ?)").run(
  ids[0], "ads", "Facebook Ads: тиждень (тест)", "Витрачено: $280\nЛіди: 25\nCPL: $11.2\nCTR: 1.8%",
);

const insPb = db.prepare("INSERT INTO playbooks (title, body_md, tags) VALUES (?, ?, ?)");
insPb.run("Налаштування CRM", "# Налаштування CRM\n\n- [ ] Етапи воронки погоджені з клієнтом\n- [ ] Поля картки ліда\n- [ ] Ролі та доступи менеджерів\n- [ ] Автозадачі на передзвон\n- [ ] Навчання менеджерів (30 хв)\n", "crm");
insPb.run("Пуш лідів з Facebook у CRM", "# Пуш лідів з Facebook\n\n- [ ] Доступ до сторінки та лід-форм\n- [ ] Інтеграція з CRM\n- [ ] Тестовий лід пройшов\n- [ ] Сповіщення менеджеру\n", "facebook,crm");

console.log(`Seed готовий: ${ids.length} тестові клієнти.`);
