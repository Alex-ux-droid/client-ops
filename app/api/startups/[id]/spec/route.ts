import { NextResponse, type NextRequest } from "next/server";
import { money } from "@/lib/config";
import { markdownToPdf } from "@/lib/pdf";
import { CANVAS, getStartup, listItems, STAGES, type Startup } from "@/lib/repo/startups";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";
import { effectiveFinance, financeSummary, hasFinance } from "@/lib/startupFinance";
import { calcFunnel, finLinks, formulaText, STRESS, stressScore } from "@/lib/startupSystem";

// Увесь проєкт одним документом: опори, фінанси, рішення, план, ТЗ
function projectMd(s: Startup): string {
  const items = listItems(s.id);
  const out: string[] = [];
  out.push(`${s.one_liner ? `**${s.one_liner}**\n\n` : ""}Стадія: ${STAGES.find((x) => x.k === s.stage)?.label ?? s.stage}${s.north_star ? ` · Метрика: ${s.north_star}` : ""}`);
  const of = (k: string) => items.filter((x) => x.kind === k);
  const li = (arr: string[]) => arr.filter(Boolean).map((l) => `- ${l}`).join("\n");
  // 1. Ідея
  const st = stressScore(s.idea);
  out.push(`## 1. Ідея\n${formulaText(s.idea.formula) || "_формула ще не заповнена_"}`);
  if (of("competitor").length) out.push(`### Альтернативи\n${li(of("competitor").map((c) => `**${c.title}**${c.data.price ? ` (${c.data.price})` : ""}${c.data.strong ? ` + ${c.data.strong}` : ""}${c.data.weak ? ` − ${c.data.weak}` : ""}`))}`);
  if (st.scored) out.push(`### Стрес-тест: ${st.pct}%\n${li(STRESS.map((x) => s.idea.stress[x.k] ? `${x.label}: ${s.idea.stress[x.k]!.score}/5${s.idea.stress[x.k]!.why ? ` — ${s.idea.stress[x.k]!.why}` : ""}` : ""))}${s.idea.verdict ? `\n\n**Вердикт:** ${s.idea.verdict}` : ""}`);
  if (of("interview").length) out.push(`### Розмови з клієнтами (${of("interview").length})\n${li(of("interview").map((i) => `${i.title}: «${i.body.replace(/\n+/g, " ")}»${i.data.pain ? ` · біль: ${i.data.pain}` : ""}${i.data.pay ? ` · платити: ${i.data.pay}` : ""}${i.data.price ? ` · ціна: ${i.data.price}` : ""}`))}`);
  // 2. Маркетинг
  out.push("## 2. Маркетинг");
  for (const g of of("segment")) out.push(`### Сегмент: ${g.title}\n${li([g.data.pain && `Біль: ${g.data.pain}`, g.data.where && `Де: ${g.data.where}`, g.data.trigger && `Коли шукають: ${g.data.trigger}`, g.data.objections && `Заперечення: ${g.data.objections}`, g.data.offer_result && `Оффер: ${g.data.offer_result}${g.data.offer_time ? ` за ${g.data.offer_time}` : ""}${g.data.offer_guarantee ? `. ${g.data.offer_guarantee}` : ""}${g.data.offer_price ? `. ${g.data.offer_price}` : ""}`])}`);
  if (of("angle").length) out.push(`### Кути\n${li(of("angle").map((a) => `«${a.title}» [${a.status || "idea"}]${a.data.result ? ` — ${a.data.result}` : ""}`))}`);
  if (of("channel").length) out.push(`### Канали\n${li(of("channel").map((c) => `${c.title}: бюджет ${money(Number(c.data.budget) || 0)}/міс, ліди по ${money(Number(c.data.cpl) || 0)}`))}`);
  const chs = of("channel").map((c) => ({ budget: Number(c.data.budget) || 0, cpl: Number(c.data.cpl) || 0, active: c.status !== "stopped" }));
  const fu = calcFunnel(s.mkt, chs);
  out.push(`### Воронка\nЛід → ${s.mkt.stages.map((x) => `${x.name} (${x.conv}%)`).join(" → ")} = ${Math.round(fu.conv * 1000) / 10}% лідів стають клієнтами.${s.mkt.target ? ` Ціль ${s.mkt.target} клієнтів/міс → ${Math.ceil(fu.leadsNeeded ?? 0)} лідів, бюджет ${money(Math.round(fu.budgetNeeded ?? 0))}, CAC ${money(Math.round(fu.cac ?? 0))}.` : ""}`);
  // 3. Технічна
  out.push("## 3. Технічна");
  if (of("module").length) out.push(`### Модулі\n${li(of("module").map((m) => `**${m.title}** [${m.status || "plan"}] — ${m.body}${m.data.entities ? ` (дані: ${m.data.entities})` : ""}`))}`);
  if (of("infra").length) out.push(`### Інфраструктура\n${li(of("infra").map((x) => `${x.title}: ${x.data.choice || "—"}${Number(x.data.cost) ? ` · ${money(Number(x.data.cost))}/міс` : ""}${x.status === "done" ? " ✓" : ""}`))}`);
  for (const r of of("release")) out.push(`### Реліз ${r.title} [${r.status || "plan"}]\n${r.data.goal ? `Мета: ${r.data.goal}\n\n` : ""}${r.body}`);
  // 4. Фінанси
  if (hasFinance(s.finance)) out.push(`## 4. Фінанси\n${li(financeSummary(effectiveFinance(s.finance, finLinks(s.mkt, items)), (n) => money(Math.round(n))).split("\n"))}`);
  const old = CANVAS.filter((b) => s.canvas[b.k as keyof Startup["canvas"]]?.trim());
  if (old.length) out.push(`## Нотатки\n${old.map((b) => `### ${b.label}\n${s.canvas[b.k as keyof Startup["canvas"]]}`).join("\n\n")}`);
  const dec = items.filter((x) => x.kind === "decision");
  if (dec.length) out.push(`## Рішення\n${dec.map((d) => `- **${d.title}**${d.body ? ` — ${d.body.replace(/\n+/g, " ")}` : ""}`).join("\n")}`);
  const ms = items.filter((x) => x.kind === "milestone");
  if (ms.length) out.push(`## План\n${ms.map((m) => `- ${m.title}${m.status === "done" ? " ✓" : ""}${m.body ? ` — ${m.body.replace(/\n+/g, " ")}` : ""}`).join("\n")}`);
  const ex = items.filter((x) => x.kind === "experiment");
  if (ex.length) out.push(`## Гіпотези\n${ex.map((e) => `- ${e.title}${e.data.result ? ` → ${e.data.result}` : ""}`).join("\n")}`);
  for (const r of of("release").filter((x) => x.data.prompt)) out.push(`## Промпт для Claude Code: ${r.title}\n\n${r.data.prompt}`);
  if (s.spec_md) out.push(`## CLAUDE.md\n${s.spec_md}`);
  return out.join("\n\n");
}

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
