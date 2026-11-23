// Помилки програм (app.error) людською мовою: що сталось, чим це загрожує, що зробити і хто.
// Відомі — правилами; незнайомі — Джері пояснює один раз (кнопка), відповідь лежить у settings errx.<підпис>.
import { createHash } from "node:crypto";
import { askJson } from "./llmJson";
import { productEvents } from "./repo/products";
import { getSetting, setSetting } from "./repo/settings";

export type Who = "you" | "claude" | "nobody";
export type Plain = { title: string; impact: string; action: string; who: Who };
export const WHO: Record<Who, string> = { you: "Тобі", claude: "Claude (кнопка «Промпт: виправити»)", nobody: "Нічого — мине само" };

const RULES: [RegExp, Plain][] = [
  [/PBX has no file for .*answered call/i, { title: "АТС не зберегла запис розмови", impact: "Розмова була, але файлу запису в Zadarma нема — AI-розбору цього дзвінка не буде.", action: "Кабінет Zadarma → АТС → Запис розмов: перевір, що запис увімкнений для внутрішнього номера менеджера і сховище не заповнене. Якщо все ввімкнено — це дуже короткі розмови, можна ігнорувати.", who: "you" }],
  [/requested file not found|recording.*not (ready|found)/i, { title: "Запис дзвінка ще не готовий", impact: "Система попросила запис раніше, ніж АТС його зберегла. Повторить сама.", action: "Нічого.", who: "nobody" }],
  [/invalid_grant|token.*(expired|revoked)|код 190|OAuthException/i, { title: "Злетів доступ до сервісу (Google або Meta)", impact: "Синхронізація з цим сервісом стоїть, поки не перепідключиш.", action: "Налаштування → Конектори → перепідключи Google або Meta.", who: "you" }],
  [/network error|fetch failed|ECONNRESET|socket hang up|ETIMEDOUT|signal timed out|aborted/i, { title: "Обірвався звʼязок", impact: "Запит не дійшов (слабкий інтернет, сплячий ноутбук, сервіс тупив). Зазвичай повторюється сам.", action: "Нічого, якщо це поодинокі випадки. Якщо десятки на день — віддай Claude.", who: "nobody" }],
  [/\b429\b|rate.?limit|too many requests/i, { title: "Сервіс просить менше запитів", impact: "Перевищено ліміт запитів — частина дій виконається пізніше.", action: "Нічого, якщо рідко. Часто — віддай Claude.", who: "nobody" }],
  [/insufficient.?(balance|funds)|баланс|quota|billing/i, { title: "Закінчились гроші або ліміт у сервісі", impact: "Функція, що залежить від цього сервісу, не працює.", action: "Поповни баланс у сервісі з тексту помилки.", who: "you" }],
  [/telegram.*(403|blocked|chat not found|bot was blocked)/i, { title: "Telegram не доставив повідомлення", impact: "Людина заблокувала бота або не натиснула Start — сповіщення до неї не доходять.", action: "Попроси людину відкрити бота і натиснути Start.", who: "you" }],
  [/slow|повільн|took \d+ ?(ms|s)/i, { title: "Щось відкривалось повільно", impact: "Сторінка чи запит довго відповідали — людина чекала.", action: "Поодинокі — нічого. Багато — віддай Claude.", who: "claude" }],
];

const sig = (s: string) => createHash("sha1").update(s.replace(/\s*—\s*×\d+\s*$/, "").replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase()).digest("hex").slice(0, 16);
const cached = (s: string): Plain | null => { try { return JSON.parse(getSetting(`errx.${sig(s)}`) ?? "null"); } catch { return null; } };
export function plainError(summary: string): Plain | null {
  for (const [re, p] of RULES) if (re.test(summary)) return p;
  return cached(summary);
}

export type ErrGroup = { summary: string; n: number; last: string; plain: Plain | null };
// Помилки програми за N днів, однакові разом (цифри в тексті не роблять помилку новою)
export function errorGroups(productId: number, days = 7): ErrGroup[] {
  const since = new Date(Date.now() - days * 864e5).toISOString().replace("T", " ").slice(0, 19);
  const m = new Map<string, ErrGroup>();
  for (const e of productEvents(productId, 1000).filter((x) => x.event === "app.error" && x.received_at >= since)) {
    const k = sig(e.summary);
    const times = Number(e.summary.match(/×(\d+)/)?.[1] ?? 1);
    const g = m.get(k);
    if (g) g.n += times; else m.set(k, { summary: e.summary.replace(/\s*—\s*×\d+\s*$/, ""), n: times, last: e.received_at, plain: plainError(e.summary) });
  }
  return [...m.values()].sort((a, b) => Number(!!b.plain && b.plain.who === "you") - Number(!!a.plain && a.plain.who === "you") || b.n - a.n);
}

// Пояснити незнайомі помилки одним запитом до моделі; відповіді лишаються назавжди
export async function explainErrors(productId: number): Promise<number> {
  const todo = errorGroups(productId, 30).filter((g) => !g.plain).slice(0, 15);
  if (!todo.length) return 0;
  const r = await askJson<{ items: (Plain & { n: number })[] }>(
    "Ти пояснюєш технічні помилки програми власнику бізнесу, який не програміст. Українською, просто, без термінів і англійських слів, по 1 реченню. Для кожної помилки: title — що сталось (до 60 символів), impact — чим це загрожує роботі, action — що конкретно зробити, who — хто має діяти: \"you\" (власник: налаштування, баланс, кабінет сервісу, попросити людину), \"claude\" (помилка в коді — виправить програміст), \"nobody\" (тимчасовий збій, мине сам). Не вигадуй, чого не видно з тексту. Поверни ТІЛЬКИ JSON: {\"items\": [{\"n\": номер, \"title\": \"\", \"impact\": \"\", \"action\": \"\", \"who\": \"you|claude|nobody\"}]}.",
    todo.map((g, i) => `${i + 1}. ${g.summary.slice(0, 400)}`).join("\n"), { maxTokens: 3000, effort: "low" });
  let k = 0;
  for (const it of r.items ?? []) {
    const g = todo[Number(it.n) - 1];
    if (!g || !it.title) continue;
    const who: Who = it.who === "you" || it.who === "nobody" ? it.who : "claude";
    setSetting(`errx.${sig(g.summary)}`, JSON.stringify({ title: String(it.title).slice(0, 100), impact: String(it.impact ?? "").slice(0, 300), action: String(it.action ?? "").slice(0, 300), who }));
    k++;
  }
  return k;
}
