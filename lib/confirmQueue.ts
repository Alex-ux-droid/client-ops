// Черга «Підтверди»: звіряємо задачі клієнта з перепискою його Telegram-групи (Haiku → JSON).
// Нічого не змінюємо самі — тільки пропозиції з доказом, рішення за Сашею (✓/✕ на Центрі або через Джері).
import Anthropic from "@anthropic-ai/sdk";
import { ai } from "./ai";
import { autoOn } from "./agent/caps";
import { db } from "./db";
import { logError } from "./log";
import { addConfirm, CONFIRM_UA, getConfirm, setConfirmStatus, tidyConfirms, type ConfirmItem, type ConfirmKind } from "./repo/confirm";
import { createTask, getTask, listTasks, updateTask } from "./repo/tasks";
import { getSetting, setSetting } from "./repo/settings";
import { getApiKey } from "./secrets";

const MODEL = "claude-haiku-5-5";
type Msg = { sent_at: string; from_name: string; is_owner: number; text: string };

function messagesSince(clientId: number, since: string): Msg[] {
  return db().prepare(`SELECT m.sent_at, m.from_name, m.is_owner, m.text FROM tg_messages m JOIN tg_chats c ON c.chat_id = m.chat_id
    WHERE c.client_id = ? AND m.sent_at > ? AND m.text <> '' ORDER BY m.sent_at LIMIT 200`).all(clientId, since) as Msg[];
}

export async function scanClient(clientId: number): Promise<number> {
  const key = getApiKey();
  if (!key) return 0;
  const last = getSetting(`confirm.scan_at.${clientId}`) || new Date(Date.now() - 2 * 86400_000).toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" });
  const msgs = messagesSince(clientId, last);
  setSetting(`confirm.scan_at.${clientId}`, new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }));
  if (!msgs.length) return 0;
  const tasks = db().prepare("SELECT id, title, due_date FROM tasks WHERE client_id = ? AND status != 'done' ORDER BY id DESC LIMIT 40").all(clientId) as { id: number; title: string; due_date: string | null }[];
  const client = (db().prepare("SELECT name FROM clients WHERE id = ?").get(clientId) as { name: string } | undefined)?.name ?? "";
  const system = `Ти помічник Саші (маркетолог, веде клієнтів). Звір відкриті задачі клієнта «${client}» з новими повідомленнями його Telegram-групи.
Знайди ТІЛЬКИ те, що прямо видно з повідомлень:
- task_done: задача з списку, яку повідомлення явно показують зробленою (Саша написав «скинув / запустив / готово», клієнт підтвердив). Вкажи task_id.
- task_new: клієнт ПРЯМО просить щось зробити, і цього нема в задачах (не дублюй схожі).
- log: важлива зроблена робота, якої нема в задачах (запустили рекламу, здали сайт) — для історії.
Не вигадуй. Сумнів — не додавай. Розмови, подяки, питання без прохання — ігноруй.
Відповідь — ТІЛЬКИ JSON-масив: [{"kind":"task_done|task_new|log","task_id":число або null,"title":"коротко, з дієслова, до 80 символів","evidence":"дата час · хто: «цитата до 150 символів»"}]. Нічого — [].`;
  const user = `ЗАДАЧІ:\n${tasks.map((t) => `#${t.id} ${t.title}${t.due_date ? ` (до ${t.due_date})` : ""}`).join("\n") || "(нема)"}\n\nПОВІДОМЛЕННЯ:\n${msgs.map((m) => `${m.sent_at.slice(0, 16)} · ${m.is_owner ? "Саша" : m.from_name || "клієнт"}: ${m.text.slice(0, 500)}`).join("\n")}`.slice(0, 24000);
  const r = await ai("Підтверди", { apiKey: key, timeout: 60000, maxRetries: 1 }, clientId).messages.create({ model: MODEL, max_tokens: 1500, system, messages: [{ role: "user", content: user }] });
  const raw = r.content.map((b) => (b.type === "text" ? b.text : "")).join("").replace(/```(json)?/g, "").trim();
  let items: { kind?: string; task_id?: number | null; title?: string; evidence?: string }[] = [];
  try { const j = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1)); if (Array.isArray(j)) items = j; } catch { return 0; }
  const ids = new Set(tasks.map((t) => t.id));
  let n = 0;
  for (const it of items.slice(0, 8)) {
    const kind = String(it.kind) as ConfirmKind;
    if (!["task_done", "task_new", "log"].includes(kind) || !it.title) continue;
    const tid = kind === "task_done" ? Number(it.task_id) : null;
    if (kind === "task_done" && !ids.has(tid!)) continue;
    if (addConfirm({ client_id: clientId, kind, task_id: tid, title: String(it.title), evidence: String(it.evidence ?? "") })) n++;
  }
  return n;
}

// Правила без ШІ (безкоштовно): задача з усіма виконаними пунктами; прострочений наступний крок;
// у стратегії «пауза», а реклама в Meta крутиться
export function ruleScan(clientId: number): number {
  let n = 0;
  const today = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
  const full = db().prepare(`SELECT t.id, t.title, COUNT(i.id) total, SUM(i.done) ok FROM tasks t JOIN task_items i ON i.task_id = t.id
    WHERE t.client_id = ? AND t.status != 'done' GROUP BY t.id HAVING total > 0 AND ok = total`).all(clientId) as { id: number; title: string; total: number }[];
  for (const t of full) if (addConfirm({ client_id: clientId, kind: "task_done", task_id: t.id, title: `Закрити «${t.title}»`, evidence: `усі пункти виконані (${t.total}/${t.total})` })) n++;
  const c = db().prepare("SELECT next_step, next_step_at FROM clients WHERE id = ?").get(clientId) as { next_step: string; next_step_at: string | null } | undefined;
  if (c?.next_step && c.next_step_at && c.next_step_at < today && addConfirm({ client_id: clientId, kind: "next_step", title: `«${c.next_step}» — зроблено?`, evidence: `строк був до ${c.next_step_at.split("-").reverse().join(".")}; ✓ — запишу в історію і очищу крок` })) n++;
  const st = db().prepare("SELECT where_now, focus FROM strategy WHERE client_id = ?").get(clientId) as { where_now: string; focus: string } | undefined;
  const pauseLine = `${st?.where_now ?? ""}\n${st?.focus ?? ""}`.split("\n").find((l) => /пауз|зупин|вимкн/i.test(l) && /реклам|кампан|meta|таргет/i.test(l));
  if (pauseLine) {
    const two = db().prepare(`SELECT COALESCE(SUM(d.spend),0) s FROM meta_daily d JOIN meta_accounts a ON a.account_id = d.account_id WHERE a.client_id = ? AND d.date >= date('now','-1 day')`).get(clientId) as { s: number };
    if (two.s > 0 && addConfirm({ client_id: clientId, kind: "strategy", title: "Реклама активна (у стратегії — пауза)", evidence: `Meta: витрати за 2 дні ${Math.round(two.s)}; у стратегії: «${pauseLine.trim().slice(0, 120)}». ✓ — запис у Хроніку, текст стратегії поправ сам` })) n++;
  }
  return n;
}

// Раз на день о 19:00 Київ — усі активні клієнти з новими повідомленнями;
// «одразу» (тумблер auto.confirm_live) — клієнт, у групі якого 3+ нових повідомлень, тиша 20 хв, не частіше разу на 3 год.
export async function confirmTick(now = new Date()): Promise<void> {
  if (!autoOn("confirm_queue")) return;
  const k = now.toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" });
  const today = k.slice(0, 10), hour = Number(k.slice(11, 13));
  const clients = db().prepare(`SELECT DISTINCT c.id FROM clients c JOIN tg_chats t ON t.client_id = c.id WHERE c.status = 'active'`).all() as { id: number }[];
  const daily = hour >= 19 && getSetting("confirm.daily_last") !== today;
  if (daily) {
    setSetting("confirm.daily_last", today);
    for (const { id } of db().prepare("SELECT id FROM clients WHERE status = 'active'").all() as { id: number }[]) { try { ruleScan(id); } catch (e) { logError("confirm-rules", e); } }
  }
  for (const { id } of clients) {
    try {
      if (daily) { if (getApiKey()) await scanClient(id); continue; }
      if (!autoOn("confirm_live")) continue;
      const last = getSetting(`confirm.scan_at.${id}`) || "";
      if (last && Date.now() - Date.parse(last.replace(" ", "T") + "+02:00") < 3 * 3600_000) continue;
      const msgs = messagesSince(id, last || new Date(Date.now() - 86400_000).toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }));
      const quiet = msgs.length && Date.now() - Date.parse(msgs.at(-1)!.sent_at.replace(" ", "T") + "+02:00") > 20 * 60_000;
      if (msgs.length >= 3 && quiet) await scanClient(id);
    } catch (e) { logError("confirm-queue", e); }
  }
  try { await sendConfirmsToTg(); } catch (e) { logError("confirm-tg", e); }
}

// Нові пропозиції → Саші в Telegram кнопками ✓/✕ (cf:<id>:y|n → confirmCallback). Відправлені — до settings confirm.tg_last.
export async function sendConfirmsToTg(): Promise<void> {
  if (!autoOn("confirm_tg")) return;
  const { tg, tgOwner } = await import("./telegram");
  const owner = tgOwner();
  if (!owner) return;
  if (getSetting("confirm.tg_last") == null) { // перший запуск — не засипаємо старою чергою, тільки нове з цього моменту
    const max = (db().prepare("SELECT MAX(id) m FROM confirm_queue").get() as { m: number | null }).m ?? 0;
    setSetting("confirm.tg_last", String(max));
    return;
  }
  const last = Number(getSetting("confirm.tg_last") || 0);
  const rows = db().prepare("SELECT q.*, c.name client_name FROM confirm_queue q JOIN clients c ON c.id = q.client_id WHERE q.status = 'new' AND q.id > ? ORDER BY q.id LIMIT 6").all(last) as ConfirmItem[];
  for (const q of rows) {
    setSetting("confirm.tg_last", String(q.id));
    const text = `☑️ ${q.client_name} · ${CONFIRM_UA[q.kind] ?? q.kind}\n${q.title}${q.evidence ? `\n— ${q.evidence.replace(/\s+/g, " ").slice(0, 300)}` : ""}`;
    await tg("sendMessage", { chat_id: owner, text, reply_markup: { inline_keyboard: [[{ text: "✓ Так", callback_data: `cf:${q.id}:y` }, { text: "✕ Ні", callback_data: `cf:${q.id}:n` }]] } }).catch((e) => logError("confirm-tg", e));
  }
}

export async function confirmCallback(q: { id: string; data?: string; from?: { id: number }; message?: { chat: { id: number }; message_id: number; text?: string } }): Promise<void> {
  const { tg, tgOwner } = await import("./telegram");
  const owner = q.from?.id === tgOwner();
  const [, id, ans] = (q.data ?? "").split(":");
  const item = owner ? getConfirm(Number(id)) : undefined;
  let note = "Вже розібрано";
  if (item && item.status === "new") {
    if (ans === "y") { const { applyConfirm } = await import("./taskLog"); applyConfirm(item); }
    setConfirmStatus(item.id, ans === "y" ? "ok" : "skip");
    note = ans === "y" ? "✓ Зроблено" : "✕ Відкинуто";
  }
  await tg("answerCallbackQuery", { callback_query_id: q.id, text: owner ? note : "Не для тебе" }).catch(() => {});
  if (owner && q.message) await tg("editMessageText", { chat_id: q.message.chat.id, message_id: q.message.message_id, text: `${q.message.text ?? ""}\n\n${note}`.slice(0, 4000) }).catch(() => {});
}

// Раз на день (housekeeping): дублі геть, старше 3 днів — знято; прохання клієнтів — в одну задачу на клієнта
export function tidyConfirmQueue(): void {
  const r = tidyConfirms();
  const T = "Розібрати прохання клієнта з переписки";
  for (const a of r.asks) {
    const list = a.titles.map((t) => `- [ ] ${t}`).join("\n");
    const open = listTasks("all", a.client_id).find((t) => t.title === T && t.status !== "done");
    if (open) { const t = getTask(open.id); updateTask(open.id, { details: `${t?.details ?? ""}\n${list}`.trim().slice(0, 20000) }); }
    else createTask({ title: T, client_id: a.client_id, details: `Висіли в «Підтверди» понад 3 дні — перевір, що з цього треба зробити.\n\n${list}` });
  }
}
