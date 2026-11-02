import { NextResponse, type NextRequest } from "next/server";
import { parseSession, SESSION_COOKIE } from "@/lib/session";

// Сторінка «живе»: proxy вже продовжив сесію. Повертає, чи сесія з автовиходом (чужий компʼютер).
export function GET(req: NextRequest) {
  const s = parseSession(req.cookies.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ idle: s.ok && s.mode === "i" }, { headers: { "cache-control": "no-store" } });
}
