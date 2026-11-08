import { NextResponse, type NextRequest } from "next/server";
import { getFile, readFile } from "@/lib/repo/files";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Файл, зроблений системою (PDF від Джері, креативи кампаній тощо) — тільки для Саші.
// Підтримує Range: без цього Safari/iPhone не програє відео.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const f = getFile(Number((await ctx.params).id));
  const data = f && readFile(f);
  if (!f || !data) return NextResponse.json({ error: "Файлу нема" }, { status: 404 });
  const headers: Record<string, string> = { "content-type": f.mime, "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`, "cache-control": "private, no-store", "accept-ranges": "bytes" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (m && (m[1] || m[2])) {
    const size = data.length;
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start); end = Math.min(size - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    return new Response(new Uint8Array(data.subarray(start, end + 1)), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) } });
  }
  return new Response(new Uint8Array(data), { headers: { ...headers, "content-length": String(data.length) } });
}
