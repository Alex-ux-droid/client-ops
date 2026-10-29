// Telegram-бот без бібліотек: Bot API через fetch, оновлення приходять на вебхук /api/telegram/webhook.
// Групи з клієнтами — бот мовчки записує все в картку. Особисті від Саші — це помічник.
import { randomBytes } from "node:crypto";
import { runAgent } from "./agent/run";
import { logError } from "./log";
import { getSetting, setSetting } from "./repo/settings";
import { addMessage, editMessage, knownChat, setMessageText, upsertChat } from "./repo/telegram";
import { setEnvVar } from "./secrets";
import { transcribe, voiceKey } from "./voice";

const API = () => process.env.TELEGRAM_API_BASE || "https://api.telegram.org";
export const tgToken = () => process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
export const tgSecret = () => process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;
export const tgOwner = () => Number(getSetting("tg.owner_id")) || null;

type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
type TgChatRaw = { id: number; type: string; title?: string; first_name?: string; last_name?: string };
type TgMsg = {
  message_id: number; date: number; chat: TgChatRaw; from?: TgUser; text?: string; caption?: string;
  voice?: { file_id: string; duration?: number }; audio?: { file_id: string; duration?: number; file_name?: string }; video_note?: { file_id: string; duration?: number };
  photo?: unknown[]; document?: { file_name?: string }; video?: unknown; sticker?: { emoji?: string };
  new_chat_title?: string;
};
export type TgUpdate = {
  update_id: number; message?: TgMsg; edited_message?: TgMsg;
  my_chat_member?: { chat: TgChatRaw; from?: TgUser; new_chat_member: { status: string } };
};

export async function tg<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = tgToken();
  if (!token) throw new Error("Telegram-бот не підключений");
  const r = await fetch(`${API()}/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  const d = (await r.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!d.ok) throw new Error(`Telegram: ${d.description ?? r.status}`);
  return d.result as T;
}

export type BotInfo = { id: number; username: string; first_name: string; can_read_all_group_messages?: boolean };
export type WebhookInfo = { url: string; pending_update_count: number; last_error_message?: string; last_error_date?: number };

// Підключити бота: зберегти токен, перевірити, поставити вебхук на адресу системи
export async function connectBot(token: string, origin: string): Promise<BotInfo> {
  setEnvVar("TELEGRAM_BOT_TOKEN", token);
  if (!tgSecret()) setEnvVar("TELEGRAM_WEBHOOK_SECRET", randomBytes(24).toString("hex"));
  const me = await tg<BotInfo>("getMe");
  await tg("setWebhook", {
    url: `${origin}/api/telegram/webhook`,
    secret_token: tgSecret(),
    allowed_updates: ["message", "edited_message", "my_chat_member"],
  });
  setSetting("tg.username", me.username);
  return me;
}

export async function disconnectBot(): Promise<void> {
  try { await tg("deleteWebhook"); } catch {}
  setEnvVar("TELEGRAM_BOT_TOKEN", null);
}

// Код для прив'язки Саші: він відкриває t.me/<бот>?start=<код>
export function ownerLinkCode(): string {
  let code = getSetting("tg.owner_code");
  if (!code) { code = randomBytes(9).toString("hex"); setSetting("tg.owner_code", code); }
  return code;
}

const userName = (u?: TgUser) => (u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || String(u.id) : "");
const chatTitle = (c: TgChatRaw) => c.title || [c.first_name, c.last_name].filter(Boolean).join(" ") || String(c.id);
// Час повідомлення — київський, як усе в системі ("YYYY-MM-DD HH:MM:SS")
const iso = (unix: number) => new Date(unix * 1000).toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" });

async function fileBlob(fileId: string): Promise<Blob> {
  const f = await tg<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
  if (!f.file_path) throw new Error("Файл недоступний (бот бачить файли до 20 МБ)");
  const r = await fetch(`${API()}/file/bot${tgToken()}/${f.file_path}`, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`Не скачав файл: ${r.status}`);
  return r.blob();
}

async function voiceToText(fileId: string): Promise<string> {
  if (!voiceKey()) return "";
  return transcribe(await fileBlob(fileId), "voice.ogg");
}

// Що в повідомленні: тип, текст, чи треба розшифрувати голос
function parse(m: TgMsg): { kind: string; text: string; fileName: string; voiceId?: string; duration?: number } {
  const v = m.voice ?? m.video_note ?? m.audio;
  if (v) return { kind: "voice", text: "", fileName: m.audio?.file_name ?? "", voiceId: v.file_id, duration: v.duration };
  if (m.photo) return { kind: "photo", text: m.caption ?? "", fileName: "" };
  if (m.document) return { kind: "document", text: m.caption ?? "", fileName: m.document.file_name ?? "" };
  if (m.video) return { kind: "video", text: m.caption ?? "", fileName: "" };
  if (m.sticker) return { kind: "other", text: m.sticker.emoji ?? "", fileName: "" };
  return { kind: m.text ? "text" : "other", text: m.text ?? m.caption ?? "", fileName: "" };
}

export async function handleUpdate(u: TgUpdate): Promise<void> {
  if (u.my_chat_member) {
    const { chat, from, new_chat_member } = u.my_chat_member;
    if (chat.type === "private") return;
    const active = !["left", "kicked"].includes(new_chat_member.status);
    // Записуємо тільки групи, куди бота додав Саша; з чужих — виходимо
    const owner = tgOwner();
    if (active && owner && from?.id !== owner && !knownChat(chat.id)) {
      await tg("leaveChat", { chat_id: chat.id }).catch(() => {});
      return;
    }
    upsertChat(chat.id, chatTitle(chat), chat.type, active);
    return;
  }
  if (u.edited_message) {
    const p = parse(u.edited_message);
    if (p.text) editMessage(u.edited_message.chat.id, u.edited_message.message_id, p.text);
    return;
  }
  const m = u.message;
  if (!m) return;
  const owner = tgOwner();
  const fromOwner = !!owner && m.from?.id === owner;

  if (m.chat.type === "private") return handlePrivate(m, fromOwner);

  // Група: мовчки записуємо — тільки ті, куди бота додав Саша (поки Саша не прив'язаний — приймаємо всі)
  if (owner && !knownChat(m.chat.id)) return;
  upsertChat(m.chat.id, m.new_chat_title ?? chatTitle(m.chat), m.chat.type);
  const p = parse(m);
  const rowId = addMessage({
    chat_id: m.chat.id, message_id: m.message_id, from_id: m.from?.id ?? null, from_name: userName(m.from),
    is_owner: fromOwner ? 1 : 0, kind: p.kind, text: p.text, file_name: p.fileName, sent_at: iso(m.date),
  });
  if (p.voiceId && rowId) {
    try {
      const t = await voiceToText(p.voiceId);
      setMessageText(rowId, t || `[голосове${p.duration ? `, ${p.duration} с` : ""} — розшифровка вимкнена: підключи ElevenLabs]`);
    } catch (e) {
      logError("telegram-voice", e);
      setMessageText(rowId, `[голосове${p.duration ? `, ${p.duration} с` : ""} — не вдалось розшифрувати]`);
    }
  }
}

async function handlePrivate(m: TgMsg, fromOwner: boolean): Promise<void> {
  const text = m.text?.trim() ?? "";
  // Прив'язка Саші: /start <код> з налаштувань
  const start = text.match(/^\/start(?:\s+(\S+))?/);
  if (start) {
    if (start[1] && start[1] === getSetting("tg.owner_code")) {
      setSetting("tg.owner_id", String(m.from?.id ?? ""));
      setSetting("tg.owner_name", userName(m.from));
      setSetting("tg.owner_code", ""); // одноразовий
      await tg("sendMessage", { chat_id: m.chat.id, text: "Привіт, Саша! Тепер я твій помічник і тут 🙌 Пиши або надиктовуй голосові — я все зроблю в системі." });
    } else if (!fromOwner) {
      await tg("sendMessage", { chat_id: m.chat.id, text: "Це особистий бот, вибач 🙂" });
    }
    return;
  }
  if (!fromOwner) return; // чужим мовчимо

  try {
    await tg("sendChatAction", { chat_id: m.chat.id, action: "typing" });
    const p = parse(m);
    let msg = p.text;
    if (p.voiceId) {
      msg = await voiceToText(p.voiceId);
      if (!msg) { await tg("sendMessage", { chat_id: m.chat.id, text: "Голосові поки не розбираю — підключи ElevenLabs у Налаштуваннях 🙏" }); return; }
    }
    if (!msg) return;
    const { reply } = await runAgent(null, msg, "Telegram, особистий чат з ботом (відповідь іде в Telegram — без markdown)");
    for (let i = 0; i < reply.length; i += 4000) await tg("sendMessage", { chat_id: m.chat.id, text: reply.slice(i, i + 4000) });
  } catch (e) {
    logError("telegram-private", e);
    await tg("sendMessage", { chat_id: m.chat.id, text: `Щось не вийшло: ${e instanceof Error ? e.message : "помилка"}` }).catch(() => {});
  }
}
