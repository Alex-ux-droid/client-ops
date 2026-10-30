import { NextResponse, type NextRequest } from "next/server";
import { getFile, readFile } from "@/lib/repo/files";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Файл, зроблений системою (PDF від Джері тощо) — тільки для Саші
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const f = getFile(Number((await ctx.params).id));
  const data = f && readFile(f);
  if (!f || !data) return NextResponse.json({ error: "Файлу нема" }, { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "content-type": f.mime, "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`, "cache-control": "private, no-store" },
  });
}
