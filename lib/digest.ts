// Ранкове зведення в Telegram Саші — тільки важливе: що горить, що сьогодні, гроші, що не так з рекламою.
// Без ШІ — збирається з бази (безкоштовно). Розклад — instrumentation.ts, час і вимикач — Налаштування → Конектори → Telegram.
import { money } from "./config";
import { logError } from "./log";
import { kyivDay, listAccounts, metaAlerts } from "./repo/meta";
import { listPayments } from "./repo/payments";
import { getSetting, setSetting } from "./repo/settings";
import { listTasks, type TaskRow } from "./repo/tasks";
import { appOrigin, tg, tgOwner, tgToken } from "./telegram";

const kyivNow = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }); // "YYYY-MM-DD HH:MM:SS"
export const digestEnabled = () => getSetting("tg.digest") !== "off";
export const digestTime = () => getSetting("tg.digest_time") || "09:00";

const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const days = (from: string, to: string) => Math.round((+new Date(to) - +new Date(from)) / 86400_000);
const who = (t: TaskRow) => (t.client_name ? ` · ${esc(t.client_name)}` : "");
const prog = (t: TaskRow) => (t.items_total ? ` (${t.items_done}/${t.items_total})` : "");
const more = (n: number) => (n > 0 ? `\n<i>…і ще ${n}</i>` : "");

// Тільки те, що треба зробити або що горить. Нема важливого — коротке «все спокійно».
export function buildDigest(): string {
  const today = kyivDay(0);
  const date = new Date().toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv", weekday: "long", day: "numeric", month: "long" });
  const blocks: string[] = [];

  // Горить: терміново + прострочені (терміново першими, далі найстаріші)
  const byPrio = (a: TaskRow, b: TaskRow) => (a.priority === "high" ? 0 : 1) - (b.priority === "high" ? 0 : 1) || (a.due_date ?? "").localeCompare(b.due_date ?? "");
  const overdue = listTasks("overdue").sort(byPrio);
  const todays = listTasks("today").sort(byPrio);
  if (overdue.length) {
    blocks.push(`<b>🔥 Горить</b>\n${overdue.slice(0, 5).map((t) => `• ${esc(t.title)}${who(t)} — прострочено ${days(t.due_date!, today)} дн.${t.priority === "high" ? " ❗" : ""}`).join("\n")}${more(overdue.length - 5)}`);
  }
  if (todays.length) {
    blocks.push(`<b>📌 Сьогодні</b>\n${todays.slice(0, 6).map((t) => `• ${esc(t.title)}${who(t)}${prog(t)}${t.priority === "high" ? " ❗" : ""}`).join("\n")}${more(todays.length - 6)}`);
  }

  // Гроші: тільки ті, що вже мали прийти, і ті, що сьогодні
  const pays = listPayments({ open: true }).filter((p) => p.due_date <= today);
  if (pays.length) {
    blocks.push(`<b>💸 Гроші</b>\n${pays.slice(0, 5).map((p) => `• ${esc(p.client_name)} — ${money(p.amount)}${p.due_date < today ? `, чекаю ${days(p.due_date, today)} дн.` : ", сьогодні"}`).join("\n")}${more(pays.length - 5)}`);
  }

  // Реклама: тільки проблеми (кабінет, без лідів, ціна ліда різко виросла)
  const ads: string[] = [];
  for (const cid of [...new Set(listAccounts().map((a) => a.client_id).filter(Boolean) as number[])]) {
    const name = listAccounts().find((a) => a.client_id === cid)?.client_name ?? "";
    const alerts = metaAlerts(cid).map((a) => a.text.replace(/^кабінет: /, "кабінет — "));
    if (alerts.length) ads.push(`• ${esc(name)}: ${esc(alerts.join(", "))}`);
  }
  if (ads.length) blocks.push(`<b>📣 Реклама</b>\n${ads.slice(0, 5).join("\n")}`);

  const head = `☀️ <b>${date[0].toUpperCase()}${date.slice(1)}</b>`;
  if (!blocks.length) return `${head}\n\nСьогодні все спокійно: нічого не горить, задач на сьогодні нема 👌`;
  return `${head}\n\n${blocks.join("\n\n")}`;
}

export async function sendDigest(): Promise<void> {
  const owner = tgOwner();
  if (!tgToken() || !owner) throw new Error("Спершу підключи бота і прив'яжи свій Telegram");
  const origin = await appOrigin();
  await tg("sendMessage", {
    chat_id: owner, text: buildDigest(), parse_mode: "HTML", disable_web_page_preview: true,
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
