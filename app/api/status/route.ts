// Стан системи для діагностики (тільки з ключем Claude або після входу). Без даних клієнтів.
import { NextResponse, type NextRequest } from "next/server";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";
import { systemInfo } from "@/lib/system";

export async function GET(req: NextRequest) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  return NextResponse.json(systemInfo());
}
