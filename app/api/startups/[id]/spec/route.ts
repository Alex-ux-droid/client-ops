import { NextResponse, type NextRequest } from "next/server";
import { money } from "@/lib/config";
import { markdownToPdf } from "@/lib/pdf";
import { getStartup, listItems, PILLARS, STAGES, type Startup } from "@/lib/repo/startups";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";
import { financeSummary, hasFinance } from "@/lib/startupFinance";

// Увесь проєкт одним документом: опори, фінанси, рішення, план, ТЗ
function projectMd(s: Startup): string {
  const items = listItems(s.id);
  const out: string[] = [];
  out.push(`${s.one_liner ? `**${s.one_liner}**\n\n` : ""}Стадія: ${STAGES.find((x) => x.k === s.stage)?.label ?? s.stage}${s.north_star ? ` · Метрика: ${s.north_star}` : ""}`);
  PILLARS.forEach((p, i) => {
    out.push(`## ${i + 1}. ${p.label}`);
    for (const b of p.blocks) {
      const v = s.canvas[b.k as keyof Startup["canvas"]]?.trim();
      out.push(`### ${b.label}\n${v || "_ще не заповнено_"}`);
    }
    if (p.k === "finance" && hasFinance(s.finance)) out.push(`### Калькулятор\n${financeSummary(s.finance, money).split("\n").map((l) => `- ${l}`).join("\n")}`);
  });
  const dec = items.filter((x) => x.kind === "decision");
  if (dec.length) out.push(`## Рішення\n${dec.map((d) => `- **${d.title}**${d.body ? ` — ${d.body.replace(/\n+/g, " ")}` : ""}`).join("\n")}`);
  const ms = items.filter((x) => x.kind === "milestone");
  if (ms.length) out.push(`## План\n${ms.map((m) => `- ${m.title}${m.status === "done" ? " ✓" : ""}${m.body ? ` — ${m.body.replace(/\n+/g, " ")}` : ""}`).join("\n")}`);
  const ex = items.filter((x) => x.kind === "experiment");
  if (ex.length) out.push(`## Гіпотези\n${ex.map((e) => `- ${e.title}${e.data.result ? ` → ${e.data.result}` : ""}`).join("\n")}`);
  if (s.spec_md) out.push(`## ТЗ для Claude Code\n${s.spec_md}`);
  return out.join("\n\n");
}

// ?format=md|pdf; ?what=all — увесь проєкт, інакше тільки ТЗ
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const s = getStartup(Number((await ctx.params).id));
  if (!s) return NextResponse.json({ error: "Нема такого проєкту" }, { status: 404 });
  const all = req.nextUrl.searchParams.get("what") === "all";
  if (!all && !s.spec_md) return NextResponse.json({ error: "ТЗ ще нема" }, { status: 404 });
  const name = all ? `Проєкт — ${s.name}` : `ТЗ — ${s.name}`;
  const body = all ? projectMd(s) : s.spec_md;
  if (req.nextUrl.searchParams.get("format") === "pdf") {
    const pdf = await markdownToPdf(name, body);
    return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}.pdf` } });
  }
  return new Response(`# ${s.name}\n\n${body}\n`, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.md` } });
}
