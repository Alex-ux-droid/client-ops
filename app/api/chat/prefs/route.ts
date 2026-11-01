import { NextResponse, type NextRequest } from "next/server";
import { setSetting } from "@/lib/repo/settings";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Тумблери з меню «+» у чаті (ті самі, що в Налаштування → «Можливості»)
const KEYS: Record<string, string> = { web: "cap.web", context: "auto.context" };
export async function POST(req: NextRequest) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const { key, on } = (await req.json().catch(() => ({}))) as { key?: string; on?: boolean };
  const k = KEYS[key ?? ""];
  if (!k) return NextResponse.json({ error: "Невідомий тумблер" }, { status: 400 });
  setSetting(k, on ? "on" : "off");
  return NextResponse.json({ ok: true });
}
