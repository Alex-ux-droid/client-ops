// Розбір експорту чату з Telegram Desktop (⋮ → «Експорт історії чату»): result.json або messages*.html
import { tgOwner } from "./telegram";

export type ParsedChat = {
  title: string;
  chatId: number | null; // як його бачить бот (для груп — від'ємний), щоб зійтися з уже записаними повідомленнями
  type: string;
  messages: { message_id: number; from_id: number | null; from_name: string; is_owner: number; kind: string; text: string; file_name: string; sent_at: string }[];
};

const kyiv = (d: Date) => d.toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" });

type JsonText = string | { type?: string; text?: string };
type JsonMsg = {
  id: number; type: string; date: string; date_unixtime?: string; from?: string; from_id?: string; text?: string | JsonText[];
  media_type?: string; mime_type?: string; file?: string; file_name?: string; photo?: string; duration_seconds?: number; sticker_emoji?: string;
};

const plain = (t: JsonMsg["text"]) => (typeof t === "string" ? t : (t ?? []).map((x) => (typeof x === "string" ? x : x.text ?? "")).join(""));
const userId = (fromId?: string) => { const m = fromId?.match(/^user(\d+)$/); return m ? Number(m[1]) : null; };

// id чату в експорті — без префікса; бот бачить супергрупи як -100…, групи як -…
function botChatId(type: string, id?: number): number | null {
  if (!id) return null;
  if (type.includes("supergroup") || type.includes("channel")) return Number(`-100${id}`);
  if (type.includes("group")) return -id;
  return id;
}

export function parseJson(raw: string): ParsedChat {
  const d = JSON.parse(raw) as { name?: string; type?: string; id?: number; messages?: JsonMsg[]; chats?: unknown };
  if (!Array.isArray(d.messages)) throw new Error(d.chats ? "Це експорт усього акаунта — треба експорт одного чату (⋮ у чаті → «Експорт історії чату»)" : "Не схоже на експорт чату Telegram");
  const owner = tgOwner();
  const type = d.type ?? "group";
  const messages = d.messages.filter((m) => m.type === "message").map((m) => {
    const text = plain(m.text).trim();
    const voice = m.media_type === "voice_message" || m.media_type === "video_message" || m.media_type === "audio_file";
    const kind = voice ? "voice" : m.photo ? "photo" : m.media_type === "video_file" || m.media_type === "animation" ? "video" : m.file ? "document" : m.media_type === "sticker" ? "other" : "text";
    const uid = userId(m.from_id);
    const when = m.date_unixtime ? new Date(Number(m.date_unixtime) * 1000) : new Date(m.date);
    return {
      message_id: m.id, from_id: uid, from_name: m.from ?? "", is_owner: owner && uid === owner ? 1 : 0, kind,
      text: text || (voice ? `[голосове${m.duration_seconds ? `, ${m.duration_seconds} с` : ""} — з експорту без розшифровки]` : m.sticker_emoji ?? ""),
      file_name: m.file_name ?? "", sent_at: kyiv(when),
    };
  }).filter((m) => m.text || m.kind !== "text");
  return { title: d.name ?? "Чат з Telegram", chatId: botChatId(type, d.id), type, messages };
}

// HTML-експорт: витягуємо автора, дату й текст із блоків повідомлень
const unescape = (s: string) => s.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();

export function parseHtml(files: string[]): ParsedChat {
  let title = "Чат з Telegram";
  const messages: ParsedChat["messages"] = [];
  let lastFrom = "";
  for (const html of files) {
    const t = html.match(/<div class="text bold">\s*([\s\S]*?)\s*<\/div>/);
    if (t) title = unescape(t[1]);
    const re = /<div class="message default clearfix( joined)?" id="message(\d+)">([\s\S]*?)(?=<div class="message (?:default|service)|<\/div>\s*<\/div>\s*<\/div>\s*<\/body>)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const body = m[3];
      const from = body.match(/<div class="from_name">\s*([\s\S]*?)\s*<\/div>/);
      if (from) lastFrom = unescape(from[1]);
      const date = body.match(/class="pull_right date details" title="([^"]+)"/)?.[1] ?? "";
      const dm = date.match(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})(?: UTC([+-]\d{2}):?(\d{2}))?/);
      const when = dm ? new Date(`${dm[3]}-${dm[2]}-${dm[1]}T${dm[4]}:${dm[5]}:${dm[6]}${dm[7] ? `${dm[7]}:${dm[8]}` : "+02:00"}`) : new Date();
      const text = unescape(body.match(/<div class="text">([\s\S]*?)<\/div>/)?.[1] ?? "");
      const voice = /media_voice_message|media_video_message|media_audio_file/.test(body);
      const photo = /class="photo_wrap/.test(body);
      const kind = voice ? "voice" : photo ? "photo" : /media_file/.test(body) ? "document" : "text";
      if (!text && kind === "text") continue;
      messages.push({ message_id: Number(m[2]), from_id: null, from_name: lastFrom, is_owner: 0, kind, text: text || (voice ? "[голосове — з експорту без розшифровки]" : ""), file_name: "", sent_at: kyiv(when) });
    }
  }
  if (!messages.length) throw new Error("У файлі не знайшов повідомлень — експортуй у форматі JSON (так надійніше)");
  return { title, chatId: null, type: "group", messages };
}
