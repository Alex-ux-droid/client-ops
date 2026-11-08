import { NextResponse, type NextRequest } from "next/server";
import { downloadFile, googleConnected } from "@/lib/google";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Файл з Google Диску Саші через сервер (для перегляду/обробки великих файлів, які не тягнуться конекторами). Тільки після входу.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  if (!googleConnected()) return NextResponse.json({ error: "Google не підключено" }, { status: 400 });
  const id = (await ctx.params).id;
  if (!/^[\w-]{10,}$/.test(id)) return NextResponse.json({ error: "Невірний id" }, { status: 400 });
  try {
    const r = await downloadFile(id);
    if (!r.ok) return NextResponse.json({ error: `Диск відповів ${r.status} — можливо, нема доступу (Налаштування → Конектори → Google: повний перегляд Диску)` }, { status: r.status });
    return new Response(r.body, { headers: { "content-type": r.headers.get("content-type") ?? "application/octet-stream", "cache-control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
