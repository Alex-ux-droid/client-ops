import { NextResponse, type NextRequest } from "next/server";
import { fixDictation } from "@/lib/dictFix";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Надиктований текст → з розділовими знаками і правильними назвами
export async function POST(req: NextRequest) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ text: "" });
  return NextResponse.json({ text: await fixDictation(text.slice(0, 8000)) });
}
