// Другий крок входу: після правильного пароля — підтвердження кнопкою в Telegram від Саші.
// Очікування тримаємо в памʼяті процесу (5 хв). Якщо Telegram недоступний — вхід паролем (і про це пишемо в журнал),
// бо інакше збій Telegram замкнув би Сашу ззовні. Вимкнути — settings auth.tg_confirm = off.
import { randomBytes } from "node:crypto";
import { logError } from "./log";
import { getSetting } from "./repo/settings";
import { tg, tgOwner } from "./telegram";

type Pending = { remember: boolean; ip: string; ua: string; created: number; status: "wait" | "ok" | "no" };
const g = globalThis as unknown as { __loginWait?: Map<string, Pending> };
const store = () => (g.__loginWait ??= new Map());
const TTL = 5 * 60_000;

export const tgConfirmOn = () => getSetting("auth.tg_confirm") !== "off" && !!tgOwner() && !!process.env.TELEGRAM_BOT_TOKEN;

// null — підтвердження недоступне (тоді вхід паролем)
export async function startConfirm(p: { remember: boolean; ip: string; ua: string }): Promise<string | null> {
  if (!tgConfirmOn()) return null;
  const m = store();
  for (const [k, v] of m) if (Date.now() - v.created > TTL) m.delete(k);
  const id = randomBytes(9).toString("base64url");
  m.set(id, { ...p, created: Date.now(), status: "wait" });
  const when = new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", hour: "2-digit", minute: "2-digit" });
  try {
    await tg("sendMessage", {
      chat_id: tgOwner(),
      text: `🔐 Вхід у Client Ops о ${when}\nIP: ${p.ip}\nПристрій: ${p.ua.slice(0, 120) || "—"}\n${p.remember ? "Запамʼятати на 7 днів" : "Без запамʼятовування"}\n\nЦе ти?`,
      reply_markup: { inline_keyboard: [[{ text: "✅ Це я", callback_data: `lg:${id}:y` }, { text: "⛔ Не я", callback_data: `lg:${id}:n` }]] },
    });
    return id;
  } catch (e) {
    m.delete(id);
    logError("login-confirm", e);
    return null;
  }
}

export function confirmState(id: string): Pending | null {
  const p = store().get(id);
  if (!p || Date.now() - p.created > TTL) return null;
  return p;
}
export const finishConfirm = (id: string) => store().delete(id);

// Кнопка в Telegram (тільки від власника)
export async function loginCallback(q: { id: string; data?: string; from?: { id: number }; message?: { chat: { id: number }; message_id: number } }): Promise<void> {
  const [, id, ans] = (q.data ?? "").split(":");
  const p = store().get(id ?? "");
  const owner = q.from?.id === tgOwner();
  let text = "Запит застарів — спробуй увійти ще раз.";
  if (p && owner && Date.now() - p.created <= TTL && p.status === "wait") {
    p.status = ans === "y" ? "ok" : "no";
    text = ans === "y" ? "✅ Вхід підтверджено." : "⛔ Вхід відхилено. Якщо це не ти — зміни пароль (APP_PASSWORD) і натисни «Вийти всюди» в Налаштуваннях.";
  }
  await tg("answerCallbackQuery", { callback_query_id: q.id, text: owner ? text.slice(0, 190) : "Не для тебе" }).catch(() => {});
  if (owner && q.message) await tg("editMessageText", { chat_id: q.message.chat.id, message_id: q.message.message_id, text }).catch(() => {});
}
