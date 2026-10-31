import { NextResponse, type NextRequest } from "next/server";
import { markdownToPdf } from "@/lib/pdf";
import { getStartup } from "@/lib/repo/startups";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// ТЗ стартапу файлом: ?format=md (для Claude Code) або pdf
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const s = getStartup(Number((await ctx.params).id));
  if (!s?.spec_md) return NextResponse.json({ error: "ТЗ ще нема" }, { status: 404 });
  const name = `ТЗ — ${s.name}`;
  if (req.nextUrl.searchParams.get("format") === "pdf") {
    const pdf = await markdownToPdf(name, s.spec_md);
    return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}.pdf` } });
  }
  return new Response(`# ${s.name}\n\n${s.spec_md}\n`, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.md` } });
}
