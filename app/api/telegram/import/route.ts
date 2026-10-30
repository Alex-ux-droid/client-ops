import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/log";
import { getClientRow } from "@/lib/repo/clients";
import { getSetting } from "@/lib/repo/settings";
import { chatsForClient, importMessages, knownChat, linkChat, upsertChat } from "@/lib/repo/telegram";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";
import { parseHtml, parseJson } from "@/lib/telegramImport";

// Імпорт історії чату з Telegram Desktop у картку клієнта
export async function POST(req: NextRequest) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const fd = await req.formData().catch(() => null);
  const clientId = Number(fd?.get("client_id"));
  if (!clientId || !getClientRow(clientId)) return NextResponse.json({ error: "Нема клієнта" }, { status: 400 });
  const files = (fd?.getAll("files") ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return NextResponse.json({ error: "Обери файл експорту" }, { status: 400 });
  if (files.reduce((s, f) => s + f.size, 0) > 60 * 1024 * 1024) return NextResponse.json({ error: "Завеликі файли (до 60 МБ). Експортуй без фото і відео — потрібен тільки текст." }, { status: 400 });

  try {
    const json = files.find((f) => f.name.endsWith(".json"));
    const parsed = json ? parseJson(await json.text())
      : parseHtml(await Promise.all(files.filter((f) => /\.html?$/.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map((f) => f.text())));

    // Куди писати: та сама група, яку вже бачить бот (тоді без дублів), або окремий «архівний» чат клієнта
    const linked = chatsForClient(clientId);
    const chatId = parsed.chatId && (knownChat(parsed.chatId) || !linked.length) ? parsed.chatId
      : linked.length === 1 ? linked[0].chat_id
      : -(900_000_000_000_000 + clientId);
    if (!knownChat(chatId)) upsertChat(chatId, parsed.title, parsed.type, false);
    linkChat(chatId, clientId);

    // У HTML немає id людей — Сашу впізнаємо за іменем з Telegram
    const ownerName = getSetting("tg.owner_name");
    const msgs = parsed.messages.map((m) => ({ ...m, is_owner: m.is_owner || (ownerName && m.from_name === ownerName) ? 1 : 0 }));
    const added = importMessages(chatId, msgs);
    return NextResponse.json({ ok: true, title: parsed.title, total: msgs.length, added, skipped: msgs.length - added });
  } catch (e) {
    logError("telegram-import", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не вдалось прочитати файл" }, { status: 400 });
  }
}
