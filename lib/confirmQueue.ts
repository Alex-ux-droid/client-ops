// Черга «Підтверди»: звіряємо задачі клієнта з перепискою його Telegram-групи (Haiku → JSON).
// Нічого не змінюємо самі — тільки пропозиції з доказом, рішення за Сашею (✓/✕ на Центрі або через Джері).
import Anthropic from "@anthropic-ai/sdk";
import { ai } from "./ai";
import { autoOn } from "./agent/caps";
import { db } from "./db";
import { logError } from "./log";
import { addConfirm, type ConfirmKind } from "./repo/confirm";
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

// Раз на день о 19:00 Київ — усі активні клієнти з новими повідомленнями;
// «одразу» (тумблер auto.confirm_live) — клієнт, у групі якого 3+ нових повідомлень, тиша 20 хв, не частіше разу на 3 год.
export async function confirmTick(now = new Date()): Promise<void> {
  if (!autoOn("confirm_queue") || !getApiKey()) return;
  const k = now.toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" });
  const today = k.slice(0, 10), hour = Number(k.slice(11, 13));
  const clients = db().prepare(`SELECT DISTINCT c.id FROM clients c JOIN tg_chats t ON t.client_id = c.id WHERE c.status = 'active'`).all() as { id: number }[];
  const daily = hour >= 19 && getSetting("confirm.daily_last") !== today;
  if (daily) setSetting("confirm.daily_last", today);
  for (const { id } of clients) {
    try {
      if (daily) { await scanClient(id); continue; }
      if (!autoOn("confirm_live")) continue;
      const last = getSetting(`confirm.scan_at.${id}`) || "";
      if (last && Date.now() - Date.parse(last.replace(" ", "T") + "+02:00") < 3 * 3600_000) continue;
      const msgs = messagesSince(id, last || new Date(Date.now() - 86400_000).toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }));
      const quiet = msgs.length && Date.now() - Date.parse(msgs.at(-1)!.sent_at.replace(" ", "T") + "+02:00") > 20 * 60_000;
      if (msgs.length >= 3 && quiet) await scanClient(id);
    } catch (e) { logError("confirm-queue", e); }
  }
}
