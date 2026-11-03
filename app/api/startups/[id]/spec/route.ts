import { NextResponse, type NextRequest } from "next/server";
import { markdownToPdf } from "@/lib/pdf";
import { getStartup } from "@/lib/repo/startups";
import { projectMd } from "@/lib/startupExport";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// ?format=md|pdf; ?what=all — увесь проєкт, інакше тільки ТЗ
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const s = getStartup(Number((await ctx.params).id));
  if (!s) return NextResponse.json({ error: "Нема такого проєкту" }, { status: 404 });
  const all = req.nextUrl.searchParams.get("what") === "all";
  if (!all && !s.spec_md) return NextResponse.json({ error: "ТЗ ще нема" }, { status: 404 });
  const name = all ? `Проєкт — ${s.name}` : `CLAUDE.md — ${s.name}`;
  const body = all ? projectMd(s) : s.spec_md;
  if (req.nextUrl.searchParams.get("format") === "pdf") {
    const pdf = await markdownToPdf(name, body);
    return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}.pdf` } });
  }
  return new Response(`# ${s.name}\n\n${body}\n`, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.md` } });
}
