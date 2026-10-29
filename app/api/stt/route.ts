import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/log";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";
import { transcribe } from "@/lib/voice";

// Аудіо з телефона → текст (ElevenLabs Scribe)
export async function POST(req: NextRequest) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("audio");
  if (!(file instanceof Blob) || !file.size) return NextResponse.json({ error: "Нема запису" }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "Запис задовгий" }, { status: 400 });
  try {
    const name = file.type.includes("mp4") ? "voice.m4a" : file.type.includes("ogg") ? "voice.ogg" : "voice.webm";
    return NextResponse.json({ text: await transcribe(file, name) });
  } catch (e) {
    logError("stt", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не розпізнав" }, { status: 502 });
  }
}
