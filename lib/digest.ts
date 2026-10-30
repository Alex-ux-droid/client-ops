// Ранкове зведення в Telegram Саші: задачі на сьогодні і прострочені, оплати, реклама, хто потребує уваги.
// Без ШІ — збирається з бази (безкоштовно). Розклад — instrumentation.ts, час і вимикач — Налаштування → Конектори → Telegram.
import { money } from "./config";
import { logError } from "./log";
import { clientFlags, listClients } from "./repo/clients";
import { accountTotals, kyivDay, listAccounts } from "./repo/meta";
import { listPayments } from "./repo/payments";
import { getSetting, setSetting } from "./repo/settings";
import { listTasks, type TaskRow } from "./repo/tasks";
import { appOrigin, tg, tgOwner, tgToken } from "./telegram";

const kyivNow = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }); // "YYYY-MM-DD HH:MM:SS"
export const digestEnabled = () => getSetting("tg.digest") !== "off";
export const digestTime = () => getSetting("tg.digest_time") || "09:00";

const line = (t: TaskRow) => `• ${t.title}${t.client_name ? ` — ${t.client_name}` : ""}${t.items_total ? ` (${t.items_done}/${t.items_total})` : ""}${t.priority === "high" ? " 🔥" : ""}`;
const n = (x: number) => Math.round(x).toLocaleString("uk-UA");

export function buildDigest(): string {
  const today = kyivDay(0), yesterday = kyivDay(1);
  const date = new Date().toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv", weekday: "long", day: "numeric", month: "long" });
  const out: string[] = [`Доброго ранку, Саша ☀️ ${date[0].toUpperCase()}${date.slice(1)}`];

  const overdue = listTasks("overdue"), todays = listTasks("today");
  if (overdue.length) out.push(`⏰ Прострочено (${overdue.length}):\n${overdue.slice(0, 8).map(line).join("\n")}${overdue.length > 8 ? `\n…і ще ${overdue.length - 8}` : ""}`);
  out.push(todays.length ? `📌 Сьогодні (${todays.length}):\n${todays.slice(0, 10).map(line).join("\n")}` : "📌 На сьогодні задач нема — можна взяти щось із тижня.");
  const week = listTasks("week");
  if (week.length) out.push(`📅 Далі цього тижня: ${week.length} задач(і)`);

  const pays = listPayments({ open: true });
  const late = pays.filter((p) => p.due_date < today), due = pays.filter((p) => p.due_date === today);
  if (late.length || due.length) {
    out.push(`💸 Оплати:\n${[...late.map((p) => `• ${p.client_name}: ${money(p.amount)} — прострочено з ${p.due_date.slice(8, 10)}.${p.due_date.slice(5, 7)}`), ...due.map((p) => `• ${p.client_name}: ${money(p.amount)} — сьогодні`)].slice(0, 8).join("\n")}`);
  }

  // Реклама за вчора по кожному кабінету клієнта
  const ads = listAccounts().filter((a) => a.client_id).map((a) => ({ a, t: accountTotals(a.account_id, yesterday, yesterday) })).filter((x) => x.t.spend > 0);
  if (ads.length) {
    out.push(`📣 Реклама вчора:\n${ads.map(({ a, t }) => `• ${a.client_name}: ${n(t.spend)} ${a.currency}, лідів ${t.leads}${t.leads ? `, по ${(t.spend / t.leads).toFixed(2)}` : ""}`).join("\n")}`);
  }

  // Хто потребує уваги (без «нема задач»/«без руху» для лідів — тільки важливе)
  const flags = listClients().filter((c) => c.status !== "archived").map((c) => ({ c, f: clientFlags(c).filter((x) => x.level === "bad" || /реклама|ліда|кабінет/.test(x.text)) })).filter((x) => x.f.length);
  if (flags.length) out.push(`⚠️ Увага:\n${flags.slice(0, 8).map(({ c, f }) => `• ${c.name}: ${f.map((x) => x.text).join(", ")}`).join("\n")}`);

  return out.join("\n\n");
}

export async function sendDigest(): Promise<void> {
  const owner = tgOwner();
  if (!tgToken() || !owner) throw new Error("Спершу підключи бота і прив'яжи свій Telegram");
  const origin = await appOrigin();
  await tg("sendMessage", {
    chat_id: owner, text: buildDigest(), disable_web_page_preview: true,
    ...(origin ? { reply_markup: { inline_keyboard: [[{ text: "Задачі", url: `${origin}/tasks` }, { text: "Реклама", url: `${origin}/ads` }]] } } : {}),
  });
  setSetting("tg.digest_last", kyivDay(0));
}

// Викликається щохвилини: якщо настав час і сьогодні ще не надсилали — надіслати
export async function digestTick(): Promise<void> {
  if (!digestEnabled() || !tgToken() || !tgOwner()) return;
  const now = kyivNow();
  if (now.slice(11, 16) < digestTime() || getSetting("tg.digest_last") === now.slice(0, 10)) return;
  // після 12:00 не надсилаємо «ранкове» (сервер міг лежати зранку)
  if (now.slice(11, 13) >= "12" && digestTime() < "12:00") { setSetting("tg.digest_last", now.slice(0, 10)); return; }
  try { await sendDigest(); } catch (e) { setSetting("tg.digest_last", now.slice(0, 10)); logError("digest", e); }
}
