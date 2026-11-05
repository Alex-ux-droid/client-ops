// Обіцянки клієнтам → задачі-нагадування. Джерела: повідомлення Саші в групі клієнта (сам, тумблер auto.promises)
// і чернетка з вікна «Повідомлення клієнту» (Саша підтверджує галочками).
import Anthropic from "@anthropic-ai/sdk";
import { autoOn } from "./agent/caps";
import { addDays, ymd } from "./dates";
import { logError } from "./log";
import { getClient } from "./repo/clients";
import { addPromise, promiseExists } from "./repo/comm";
import { createTask } from "./repo/tasks";
import { getApiKey } from "./secrets";

const MODEL = "claude-haiku-5-5";
// Дешевий фільтр: без слів про час/дію модель навіть не питаємо
const HINT = /(завтра|післязавтра|сьогодні|через\s|до кінця|понеділ|вівтор|середу|середи|четвер|п.ятниц|субот|неділ|наступн|на тижні|скину|надішлю|відправлю|зроблю|підготую|перевір|подивлюс|зателефон|наберу|зв.яжус|покажу|розкажу|запущу|налаштую|оновлю|\d{1,2}[./]\d{1,2}|\d{1,2}:\d{2})/i;

export type Found = { what: string; due: string | null };

export async function extractPromises(text: string): Promise<Found[]> {
  const key = getApiKey();
  const t = text.trim();
  if (!key || t.length < 12 || !HINT.test(t)) return [];
  const now = new Date();
  const today = ymd(now);
  const wd = now.toLocaleDateString("uk-UA", { weekday: "long", timeZone: "Europe/Kyiv" });
  const system = `Знайди в повідомленні Саші клієнту ОБІЦЯНКИ: що Саша (або «ми») пообіцяв зробити, надіслати, перевірити, показати, зателефонувати — до певного часу.
НЕ обіцянки: що вже зроблено; що має зробити клієнт; загальні фрази без дії («будемо на звʼязку»); прохання.
Сьогодні ${today} (${wd}). Перетвори строк на дату YYYY-MM-DD: «завтра», «у четвер» (найближчий), «через 3–4 дні» (бери більше число), «на наступному тижні» (понеділок). Якщо строк не названий, але обіцянка явна — через 2 дні.
Відповідь — ТІЛЬКИ JSON-масив: [{"what":"коротко, що зробити (до 80 символів, з дієслова)","due":"YYYY-MM-DD"}]. Нема обіцянок — [].`;
  try {
    const r = await new Anthropic({ apiKey: key, timeout: 20000, maxRetries: 0 }).messages.create({ model: MODEL, max_tokens: 500, system, messages: [{ role: "user", content: t.slice(0, 4000) }] });
    const out = r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    // Модель інколи відповідає словами без списку — це означає «обіцянок нема», а не помилка
    const a = out.indexOf("["), z = out.lastIndexOf("]");
    if (a < 0 || z <= a) return [];
    let arr: { what?: unknown; due?: unknown }[];
    try { arr = JSON.parse(out.slice(a, z + 1)); } catch { return []; }
    if (!Array.isArray(arr)) return [];
    const max = addDays(60);
    return arr.filter((x) => x && typeof x.what === "string" && x.what.trim()).slice(0, 5).map((x) => {
      const due = typeof x.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.due) && x.due >= today && x.due <= max ? x.due : addDays(2);
      return { what: String(x.what).trim().slice(0, 120), due };
    });
  } catch (e) {
    logError("promises", e);
    return [];
  }
}

export function savePromiseTask(clientId: number | null, f: Found, quote: string, source: "group" | "draft", where = ""): number | null {
  if (source === "group" && promiseExists(clientId, f.due)) return null;
  const c = clientId ? getClient(clientId) : undefined;
  const taskId = createTask({
    title: `Обіцяв${c ? ` ${c.name}` : ""}: ${f.what}`,
    client_id: clientId, due_date: f.due, priority: "high",
    details: `> ${quote.trim().replace(/\n+/g, "\n> ").slice(0, 1500)}\n\nОбіцянка клієнту${where ? ` (${where})` : ""} — система записала нагадування сама. Не те — просто видали задачу.`,
  });
  addPromise({ client_id: clientId, what: f.what, due_date: f.due, quote: quote.slice(0, 2000), source, task_id: taskId });
  return taskId;
}

// Повідомлення Саші в групі клієнта → задачі (викликається з вебхука Telegram)
export async function promisesFromGroup(clientId: number | null, text: string, chatTitle: string): Promise<void> {
  if (!clientId || !autoOn("promises")) return;
  const found = await extractPromises(text);
  if (!found.length) return;
  const made = found.map((f) => ({ f, id: savePromiseTask(clientId, f, text, "group", `група «${chatTitle}»`) })).filter((x) => x.id);
  if (!made.length) return;
  const { tg, tgOwner } = await import("./telegram");
  const owner = tgOwner();
  if (owner) await tg("sendMessage", { chat_id: owner, text: `📌 Ти пообіцяв у «${chatTitle}»:\n${made.map((x) => `• ${x.f.what} — до ${x.f.due}`).join("\n")}\n\nПоставив задачі-нагадування. Не те — видали в задачах.` }).catch(() => {});
}
