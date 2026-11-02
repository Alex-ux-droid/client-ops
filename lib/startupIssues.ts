// Продукт сам шле сюди помилки і відгуки: POST /api/report/<id> з ключем проєкту (Authorization: Bearer <key>).
// Ключ не зберігаємо — він виводиться з SESSION_SECRET (HMAC), тож його бачить лише Саша в системі.
import { createHash, createHmac } from "node:crypto";
import { autoOn } from "./agent/caps";
import { logError } from "./log";
import { getStartup, KNOWLEDGE_CATS, listItems, type Startup } from "./repo/startups";
import { upsertIssue, type IssueKind, type StartupIssue } from "./repo/startupIssues";

export const reportKey = (id: number) => createHmac("sha256", process.env.SESSION_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || "client-ops").update(`startup-report:${id}`).digest("hex").slice(0, 40);

const hits = new Map<number, { n: number; at: number }>();
// не більше 60 звітів за хвилину на проєкт — щоб зациклена помилка не засмітила базу
function allowed(id: number): boolean {
  const now = Date.now(), h = hits.get(id);
  if (!h || now - h.at > 60_000) { hits.set(id, { n: 1, at: now }); return true; }
  h.n++;
  return h.n <= 60;
}

export async function ingestReport(id: number, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; issue_id?: number }> {
  const s = getStartup(id);
  if (!s) return { ok: false, error: "no project" };
  if (!allowed(id)) return { ok: false, error: "rate limit" };
  const str = (v: unknown, max: number) => (typeof v === "string" ? v : v == null ? "" : JSON.stringify(v)).slice(0, max);
  const kind: IssueKind = body.type === "feedback" ? "feedback" : body.type === "bug" ? "bug" : "error";
  const title = str(body.message ?? body.title, 300).trim() || "Без опису";
  const details = [str(body.details, 4000), body.stack ? `Стек:\n${str(body.stack, 6000)}` : "", body.meta ? `Дані: ${str(body.meta, 3000)}` : ""].filter(Boolean).join("\n\n");
  // відбиток: тип + текст без чисел/id (щоб «Order 123 failed» і «Order 456 failed» були однією проблемою)
  const fp = createHash("sha1").update(`${kind}|${title.replace(/\d+/g, "#").replace(/[a-f0-9]{8,}/gi, "#").toLowerCase()}`).digest("hex").slice(0, 20);
  const r = upsertIssue({ startup_id: id, kind, title, details, url: str(body.url, 500), reporter: str(body.user, 120), fingerprint: fp });
  if ((r.isNew || r.reopened) && autoOn("startup_issues")) {
    try {
      const { tg, tgOwner } = await import("./telegram");
      const owner = tgOwner();
      if (owner) await tg("sendMessage", { chat_id: owner, text: `${kind === "feedback" ? "💬 Відгук" : "🐞 Проблема"} у «${s.name}»${r.reopened ? " (повернулась після виправлення)" : ""}:\n${title}${body.user ? `\nВід: ${str(body.user, 120)}` : ""}\n\nСистема → Стартапи → ${s.name} → Проблеми` });
    } catch (e) { logError("startup-issues", e); }
  }
  return { ok: true, issue_id: r.id };
}

export function knowledgeMd(s: Startup, limit = 40): string {
  const kn = listItems(s.id, "knowledge").slice(-limit);
  if (!kn.length) return "";
  return Object.entries(KNOWLEDGE_CATS).map(([k, label]) => {
    const xs = kn.filter((i) => (i.data.cat || "lesson") === k);
    return xs.length ? `### ${label}\n${xs.map((i) => `- **${i.title}**${i.body ? ` — ${i.body.replace(/\n+/g, " ")}` : ""}${i.data.fix ? ` → Рішення: ${i.data.fix.replace(/\n+/g, " ")}` : ""}`).join("\n")}` : "";
  }).filter(Boolean).join("\n\n");
}

// Промпт для Claude Code: розібрати й виправити одну проблему
export function issuePrompt(s: Startup, i: StartupIssue): string {
  const kn = knowledgeMd(s, 25);
  return `Проєкт «${s.name}»${s.repo ? ` (репозиторій ${s.repo})` : ""}. Користувач натрапив на проблему — знайди причину і виправ.

ПРОБЛЕМА (${i.kind === "feedback" ? "відгук користувача" : i.kind === "bug" ? "щось працює не так" : "помилка"}, траплялась ${i.count} раз(и), остання ${i.last_at}):
${i.title}
${i.url ? `Де: ${i.url}\n` : ""}${i.reporter ? `Хто: ${i.reporter}\n` : ""}${i.details ? `\nДеталі:\n${i.details}\n` : ""}
ЩО ЗРОБИТИ:
1. Відтвори проблему (або поясни, чому не відтворюється).
2. Знайди корінну причину — не латай симптом.
3. Виправ і додай перевірку/тест, щоб не повернулось.
4. Коротко опиши: що було не так, що змінив, що перевірити вручну.
5. Допиши в CLAUDE.md проєкту розділ «Уроки» одним рядком — щоб ця помилка не повторилась.
${kn ? `\nЩО МИ ВЖЕ ЗНАЄМО ПРО ЦЕЙ ПРОЄКТ (база знань — враховуй):\n${kn}\n` : ""}`;
}

// Промпт для Claude Code: підключити звіти про помилки і кнопку «Щось не працює» в продукті
export function integrationPrompt(s: Startup, origin: string): string {
  return `Підключи в проєкті «${s.name}» автоматичні звіти про проблеми в мою систему керування (Client Ops).

Адреса: POST ${origin}/api/report/${s.id}
Заголовки: Content-Type: application/json, Authorization: Bearer ${reportKey(s.id)}
Тіло JSON: { "type": "error" | "bug" | "feedback", "message": "коротко що сталось", "details": "що робив користувач, вхідні дані", "stack": "стек помилки", "url": "сторінка/екран", "user": "хто (імʼя/роль, без паролів і персональних даних клієнтів)", "meta": { будь-які корисні поля } }
Відповідь: { ok: true }. Запит не має ламати роботу продукту: таймаут 5 с, помилки звіту ігнорувати, не більше 1 звіту на однакову помилку за хвилину.

Що зробити:
1. Сервер: глобальний обробник помилок (необроблені винятки, падіння API, помилки інтеграцій — напр. телефонії, CRM, платежів) → type "error" зі стеком.
2. Клієнт (браузер): window.onerror і unhandledrejection → type "error".
3. Кнопка «Щось не працює» (помітна, в кутку/меню): форма «що сталось» → type "bug" або "feedback", url поточної сторінки, user — хто увійшов.
4. Перевірки бізнес-логіки, де помилку не видно (напр. сума не сходиться, дзвінок не привʼязався до угоди) → type "bug" з даними в meta.
5. НЕ надсилай паролі, токени, повні телефони/емейли клієнтів — маскуй.
6. Додай у CLAUDE.md проєкту розділ «Звіти про помилки» з цією адресою (ключ — тільки в .env як CLIENT_OPS_REPORT_KEY).`;
}
