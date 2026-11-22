import { db } from "../db";

// /clients/12?tab=meta_ads&mv=leads → /clients/:id?tab=meta_ads&mv=leads — рахуємо розділи, а не окремих клієнтів
export function normPath(path: string, search: string): string {
  const p = path.replace(/\/\d+(?=\/|$)/g, "/:id").slice(0, 120);
  const q = new URLSearchParams(search);
  const keep = ["tab", "v", "sv", "mv", "cv", "view", "m"].filter((k) => q.get(k)).map((k) => `${k}=${q.get(k)}`);
  return keep.length ? `${p}?${keep.join("&")}` : p;
}
const kyivDay = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
export function addView(path: string): void {
  db().prepare("INSERT INTO page_views (day, path, n) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET n = n + 1").run(kyivDay(), path);
}
export function addClick(path: string, label: string): void {
  db().prepare("INSERT INTO ui_clicks (day, path, label, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, path, label) DO UPDATE SET n = n + 1").run(kyivDay(), path, label.slice(0, 60));
}
export const topViews = (days = 14) => db().prepare("SELECT path, SUM(n) n, COUNT(*) days FROM page_views WHERE day >= date('now', ?) GROUP BY path ORDER BY n DESC").all(`-${days} days`) as { path: string; n: number; days: number }[];
export const topClicks = (days = 14) => db().prepare("SELECT path, label, SUM(n) n FROM ui_clicks WHERE day >= date('now', ?) GROUP BY path, label ORDER BY n DESC LIMIT 40").all(`-${days} days`) as { path: string; label: string; n: number }[];
export const trackingSince = () => (db().prepare("SELECT MIN(day) d FROM page_views").get() as { d: string | null }).d;

// Людські назви розділів
const PAGES: Record<string, string> = {
  "/": "Центр", "/tasks": "Задачі", "/clients": "Клієнти", "/money": "Гроші", "/ads": "Реклама", "/products": "Проєкти", "/kb": "Розвиток", "/journal": "Журнал",
  "/settings": "Налаштування", "/review": "Рев'ю", "/startups": "Стартапи", "/ideas": "Ідеї", "/playbooks": "Плейбуки", "/creatives": "Креативи", "/menu": "Меню (телефон)",
  "/clients/:id": "Клієнт", "/products/:id": "Проєкт", "/startups/:id": "Стартап",
};
const CLIENT_TABS: Record<string, string> = {
  overview: "Огляд", strategy: "Стратегія", sales: "Продажі", content: "Контент", brand: "Бренд", competitors: "Конкуренти", telegram: "Telegram", mail: "Пошта",
  tasks: "Задачі", history: "Історія", money: "Гроші", files: "Файли", access: "Доступи", materials: "Матеріали (старі)", playbooks: "Плейбуки", setup: "Налаштування клієнта",
  meta_ads: "Meta", google_ads: "Google Ads", tiktok_ads: "TikTok", website: "Сайт", crm: "CRM", telephony: "Телефонія", sales_training: "Навчання", automation: "Автоматизація",
};
const SUB: Record<string, Record<string, string>> = {
  mv: { campaigns: "Кампанії", forms: "Лід-форми", tree: "Структура", creatives: "Креативи", audience: "Аудиторія", leads: "Заявки", analysis: "Висновки" },
  cv: { analysis: "Аналіз", plan: "План", posts: "Пости", assets: "Матеріали", strategy: "Стратегія", settings: "Налаштування" },
  sv: { board: "Дошка", systems: "Екосистема", plan: "План", log: "Хроніка", knowledge: "Знання", insights: "Висновки", hypotheses: "Гіпотези", part: "Частина" },
};
export function pathLabel(p: string): string {
  const [base, qs = ""] = p.split("?");
  const q = new URLSearchParams(qs);
  const parts = [PAGES[base] ?? base];
  if (base === "/clients/:id") parts.push(CLIENT_TABS[q.get("tab") ?? "overview"] ?? q.get("tab")!);
  for (const k of ["mv", "cv", "sv"]) if (q.get(k)) parts.push(SUB[k][q.get(k)!] ?? q.get(k)!);
  const V: Record<string, string> = { connect: "Звʼязок", requests: "Правки", knowledge: "Знання", log: "Хронологія", kit: "Набір", edit: "Змінити", updates: "Оновлення", archive: "Відправлені", dev: "Напрямок", docs: "Інструкції", radar: "Радар", all: "Усі", week: "Тиждень", overdue: "Прострочені" };
  if (q.get("v")) parts.push(V[q.get("v")!] ?? q.get("v")!);
  return parts.join(" → ");
}

// Що є в системі, але не відкривалось за N днів — кандидати прибрати
export function unusedSections(days = 14): string[] {
  const seen = new Set(topViews(days).map((v) => pathLabel(v.path)));
  const all = [
    ...["/", "/tasks", "/clients", "/money", "/ads", "/products", "/kb", "/journal", "/settings"].map((x) => PAGES[x]),
    ...Object.keys(CLIENT_TABS).filter((k) => !["google_ads", "tiktok_ads", "telephony", "sales_training", "automation", "crm", "mail"].includes(k)).map((k) => `Клієнт → ${CLIENT_TABS[k]}`),
    ...Object.values(SUB.mv).map((x) => `Клієнт → Meta → ${x}`),
    ...Object.values(SUB.cv).map((x) => `Клієнт → Контент → ${x}`),
  ];
  return all.filter((x) => ![...seen].some((s) => s === x || s.startsWith(`${x} →`)));
}
