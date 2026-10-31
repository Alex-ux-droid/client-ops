import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/log";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";
import { liveSttToken } from "@/lib/voice";

// Токен для живого диктування (браузер → ElevenLabs Realtime напряму)
export async function POST(req: NextRequest) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  try {
    return NextResponse.json({ token: await liveSttToken() });
  } catch (e) {
    logError("stt-live", e);
    return NextResponse.json({ error: "Не вдалось" }, { status: 502 });
  }
}
