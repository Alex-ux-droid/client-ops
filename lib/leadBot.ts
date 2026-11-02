// Власний Telegram-бот клієнта для заявок. Токен — тільки в .env (LEADBOT_TOKEN_<client_id>).
// Вебхук бота → /api/leadbot/<client_id> (секрет = HMAC від SESSION_SECRET). Менеджери клієнта підписуються
// посиланням-запрошенням t.me/<бот>?start=<код>; /stop — відписатись. Кнопки під заявкою працюють і тут.
import { createHmac, randomBytes } from "node:crypto";
import { getClient } from "./repo/clients";
import { addBotUser, getRoute, saveRoute, setBotUserActive } from "./repo/leads";
import { setEnvVar } from "./secrets";
import { tgCall, tgToken } from "./telegram";

export const leadBotEnv = (clientId: number) => `LEADBOT_TOKEN_${clientId}`;
export const leadBotToken = (clientId: number) => process.env[leadBotEnv(clientId)]?.trim() || null;
export const leadBotSecret = (clientId: number) => createHmac("sha256", process.env.SESSION_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || "client-ops").update(`leadbot:${clientId}`).digest("hex").slice(0, 48);
export const inviteLink = (clientId: number) => { const r = getRoute(clientId); return r.bot_username && r.invite_code ? `https://t.me/${r.bot_username}?start=${r.invite_code}` : ""; };

type Me = { id: number; username: string; first_name: string };
type Hook = { url: string };

// Підключити: перевірити токен, попередити, якщо в бота вже є інший вебхук, поставити свій
export async function connectLeadBot(clientId: number, token: string, origin: string, force = false): Promise<{ ok: true; username: string } | { ok: false; error: string; busy?: string }> {
  token = token.trim();
  if (!/^\d+:[\w-]{30,}$/.test(token)) return { ok: false, error: "Це не схоже на токен бота (вигляд 123456:ABC…) — скопіюй з @BotFather" };
  let me: Me;
  try { me = await tgCall<Me>(token, "getMe"); } catch { return { ok: false, error: "Telegram не прийняв токен — перевір, що скопійовано повністю" }; }
  const main = tgToken();
  if (main && main.split(":")[0] === String(me.id)) return { ok: false, error: "Це наш бот Джері — тут потрібен окремий бот клієнта" };
  if (!origin.startsWith("https://") && !/^http:\/\/localhost[:/]/.test(origin)) return { ok: false, error: "Підключати бота можна тільки з робочої адреси системи (https)" };
  const url = `${origin}/api/leadbot/${clientId}`;
  const hook = await tgCall<Hook>(token, "getWebhookInfo").catch(() => ({ url: "" }));
  if (hook.url && hook.url !== url && !force) return { ok: false, busy: hook.url, error: `Цей бот уже під'єднаний до іншого сервісу (${new URL(hook.url).host}). Якщо підключити — той сервіс перестане отримувати повідомлення.` };
  await tgCall(token, "setWebhook", { url, secret_token: leadBotSecret(clientId), allowed_updates: ["message", "callback_query"] });
  setEnvVar(leadBotEnv(clientId), token);
  const r = getRoute(clientId);
  saveRoute(clientId, { to_bot: 1, to_group: 0, bot_username: me.username, bot_name: me.first_name, invite_code: r.invite_code || randomBytes(6).toString("hex") });
  return { ok: true, username: me.username };
}

export async function disconnectLeadBot(clientId: number): Promise<void> {
  const token = leadBotToken(clientId);
  if (token) await tgCall(token, "deleteWebhook").catch(() => {});
  setEnvVar(leadBotEnv(clientId), null);
  saveRoute(clientId, { to_bot: 0 });
}

export function newInvite(clientId: number): void {
  saveRoute(clientId, { invite_code: randomBytes(6).toString("hex") });
}

type Upd = {
  message?: { chat: { id: number; type: string }; from?: { id: number; first_name?: string; last_name?: string; username?: string }; text?: string };
  callback_query?: { id: string; data?: string; from?: { first_name?: string; last_name?: string; username?: string }; message?: { chat: { id: number }; message_id: number } };
};

export async function handleLeadBotUpdate(clientId: number, u: Upd): Promise<void> {
  const token = leadBotToken(clientId);
  if (!token) return;
  if (u.callback_query) {
    const { leadCallback } = await import("./metaLeads");
    return leadCallback(u.callback_query, "client");
  }
  const m = u.message;
  if (!m?.from || m.chat.type !== "private") return;
  const text = m.text?.trim() ?? "";
  const c = getClient(clientId);
  const say = (t: string) => tgCall(token, "sendMessage", { chat_id: m.chat.id, text: t }).catch(() => {});
  const start = text.match(/^\/start(?:\s+(\S+))?/);
  if (start) {
    const r = getRoute(clientId);
    if (start[1] && r.invite_code && start[1] === r.invite_code) {
      addBotUser(clientId, m.from.id, [m.from.first_name, m.from.last_name].filter(Boolean).join(" ") || m.from.username || String(m.from.id));
      await say(`✅ Готово! Сюди будуть приходити нові заявки${c ? ` ${c.name}` : ""} з реклами.\n\nПід кожною заявкою — кнопки: натисніть «Взяли в роботу», коли передзвонили, і оцініть, якісна заявка чи ні. Відписатись — /stop`);
    } else await say("Цей бот надсилає заявки команді. Щоб отримувати їх — попросіть у адміністратора посилання-запрошення.");
    return;
  }
  if (/^\/stop/.test(text)) {
    setBotUserActive(clientId, m.from.id, false);
    await say("Ви відписались від заявок. Повернутись — те саме посилання-запрошення.");
  }
}
