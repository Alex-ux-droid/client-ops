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
    stage: "new", fee_monthly: 500, pay_day: 5, next_step: "Погодити скрипт для адмінів",
  },
  {
    name: "Тест: Школа англійської «Speakly»", niche: "освіта", status: "active",
    offer: "Сайт + реклама", budget: "$800/міс",
    contacts: "Менеджер: Ігор (тестовий контакт)", needs: "Ліди на пробний урок",
    client_vision: "Лендинг як у конкурентів", my_vision: "Квіз-лендинг, ліди одразу в CRM",
    notes: "", bitwarden_ref: "Bitwarden: Speakly / Hosting",
    stage: "new", fee_monthly: 400, pay_day: 15, next_step: "",
  },
  {
    name: "Тест: Меблі на замовлення «Дуб»", niche: "виробництво", status: "lead",
    offer: "Налаштування відділу продажу", budget: "обговорюємо",
    contacts: "Власник: Андрій (тестовий контакт)", needs: "Менеджери губляться в заявках",
    client_vision: "", my_vision: "CRM + телефонія + навчання 2 менеджерів",
    notes: "Дзвінок-знайомство був на минулому тижні", bitwarden_ref: "",
    stage: "proposal", fee_monthly: 900, pay_day: 1, next_step: "Дотиснути КП до п'ятниці",
  },
  {
    name: "Тест: Автосервіс «Мотор»", niche: "авто", status: "lead",
    offer: "Facebook-реклама", budget: "$600/міс",
    contacts: "Власник: Сергій (тестовий контакт)", needs: "Записи на ТО",
    client_vision: "", my_vision: "Лід-форми + автодзвін", notes: "", bitwarden_ref: "",
    stage: "contacted", fee_monthly: 350, pay_day: 1, next_step: "Дзвінок у четвер",
  },
  {
    name: "Тест: Салон краси «Lumi»", niche: "б'юті", status: "lead",
    offer: "CRM + Instagram", budget: "",
    contacts: "Адмін: Ірина (тестовий контакт)", needs: "", client_vision: "", my_vision: "",
    notes: "Прийшла з рекомендації", bitwarden_ref: "",
    stage: "new", fee_monthly: 0, pay_day: 1, next_step: "",
  },
];

const insClient = db.prepare(`INSERT INTO clients (name, niche, status, offer, budget, contacts, needs, client_vision, my_vision, notes, bitwarden_ref, stage, fee_monthly, pay_day, next_step)
  VALUES (@name, @niche, @status, @offer, @budget, @contacts, @needs, @client_vision, @my_vision, @notes, @bitwarden_ref, @stage, @fee_monthly, @pay_day, @next_step)`);
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
const pbCrm = insPb.run("Налаштування CRM", "# Налаштування CRM\n\n- [ ] Етапи воронки погоджені з клієнтом\n- [ ] Поля картки ліда\n- [ ] Ролі та доступи менеджерів\n- [ ] Автозадачі на передзвон\n- [ ] Навчання менеджерів (30 хв)\n", "crm").lastInsertRowid;
insPb.run("Пуш лідів з Facebook у CRM", "# Пуш лідів з Facebook\n\n- [ ] Доступ до сторінки та лід-форм\n- [ ] Інтеграція з CRM\n- [ ] Тестовий лід пройшов\n- [ ] Сповіщення менеджеру\n", "facebook,crm");

// Оплати: 5 місяців історії по двох активних клієнтах + поточний місяць
const insPay = db.prepare("INSERT INTO payments (client_id, amount, due_date, paid_at, note) VALUES (?, ?, ?, ?, ?)");
const monthDay = (back, d) => {
  const x = new Date();
  x.setDate(1);
  x.setMonth(x.getMonth() - back);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
for (let back = 5; back >= 1; back--) {
  insPay.run(ids[0], 500, monthDay(back, 5), monthDay(back, 6), "щомісячна оплата");
  if (back <= 3) insPay.run(ids[1], 400, monthDay(back, 15), monthDay(back, 16), "щомісячна оплата");
}
insPay.run(ids[1], 300, monthDay(4, 20), monthDay(4, 22), "лендинг, передоплата");
insPay.run(ids[0], 500, day(-3), null, "щомісячна оплата");
insPay.run(ids[1], 400, day(10), null, "щомісячна оплата");

// Реклама: 6 тижнів по стоматології
const insAd = db.prepare(`INSERT INTO ad_stats (client_id, period_start, period_end, spend, impressions, clicks, leads, sales, revenue, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
[
  [280, 21000, 310, 15, 3, 2400, "старт кампанії"],
  [300, 23500, 360, 17, 4, 3100, ""],
  [310, 22800, 330, 14, 3, 2600, "вигорання креативу"],
  [290, 26000, 470, 24, 6, 4800, "нові відео-відгуки"],
  [295, 27100, 500, 26, 7, 5200, ""],
  [305, 27800, 520, 27, 6, 4900, ""],
].forEach((r, i) => insAd.run(ids[0], day(-7 * (6 - i) - 6), day(-7 * (6 - i)), ...r));

db.prepare("INSERT INTO client_playbooks (client_id, playbook_id, checked_json) VALUES (?, ?, ?)").run(ids[0], pbCrm, "[0,1]");

// Власники, послуги, папки
const upd = db.prepare("UPDATE clients SET owner_name = ?, city = ?, phone = ?, locations = ?, work_since = ? WHERE id = ?");
upd.run("Олена (тест)", "Київ", "+380000000001", 2, day(-120), ids[0]);
upd.run("Ігор (тест)", "Львів", "+380000000002", 1, day(-60), ids[1]);
upd.run("Андрій (тест)", "Житомир", "", 1, null, ids[2]);
const tool = (cat, name) => db.prepare("SELECT id FROM tools WHERE category = ? AND name = ?").get(cat, name)?.id ?? null;
const svc = db.prepare("INSERT INTO client_services (client_id, type, started_at, tool_id, details_json) VALUES (?, ?, ?, ?, ?)");
svc.run(ids[0], "meta_ads", day(-110), null, JSON.stringify({ account_id: "act_000000000", budget: "1200", strategy: "Імплантація: лід-форми + відео-відгуки" }));
svc.run(ids[0], "crm", day(-90), tool("crm", "KeyCRM"), JSON.stringify({ users: "3", setup: "Воронка запису, автозадачі на передзвон" }));
svc.run(ids[0], "telephony", day(-90), tool("telephony", "Binotel"), JSON.stringify({ numbers: "2 номери", integration: "KeyCRM" }));
svc.run(ids[1], "website", day(-55), tool("site", "Tilda"), JSON.stringify({ url: "https://example.com", work: "Квіз-лендинг на пробний урок" }));
svc.run(ids[1], "meta_ads", day(-30), null, JSON.stringify({ budget: "800" }));

console.log(`Seed готовий: ${ids.length} тестові клієнти.`);
