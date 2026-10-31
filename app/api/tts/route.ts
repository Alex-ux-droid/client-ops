import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/log";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";
import { synthesize, voiceConfig } from "@/lib/voice";
import { autoOn } from "@/lib/agent/caps";

const authed = (req: NextRequest) => isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"));

// Чи є голос ElevenLabs (інакше браузер говорить сам)
export function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const c = voiceConfig();
  return NextResponse.json({ eleven: c.configured && !!c.voiceId, stt: c.configured, live: c.configured && autoOn("live_dictation") });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const t = String(text ?? "").trim().slice(0, 2500);
  if (!t) return NextResponse.json({ error: "Порожньо" }, { status: 400 });
  try {
    const mp3 = await synthesize(t);
    return new Response(mp3, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
  } catch (e) {
    logError("tts", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Голос не вийшов" }, { status: 502 });
  }
}
