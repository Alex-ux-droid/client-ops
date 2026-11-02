import { NextResponse, type NextRequest } from "next/server";
import { proposalMd, proposalTitle } from "@/lib/labPrompt";
import { proposalPdf } from "@/lib/proposalPdf";
import { getLab } from "@/lib/repo/lab";
import { getSetting } from "@/lib/repo/settings";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Пропозиція клієнту: PDF A4 (за замовчуванням) або .md
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const l = getLab(Number((await ctx.params).id));
  if (!l) return NextResponse.json({ error: "Нема такої сесії" }, { status: 404 });
  const title = proposalTitle(l);
  const md = `${l.proposal.subtitle ? `**${l.proposal.subtitle}**\n\n` : ""}${proposalMd(l)}`;
  if (req.nextUrl.searchParams.get("format") === "md") {
    return new Response(`# ${title}\n\n${md}\n`, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(title)}.md` } });
  }
  const pdf = await proposalPdf(l, { from: getSetting("proposal.from") || "" });
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(title)}.pdf` } });
}
