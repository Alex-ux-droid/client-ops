import { NextResponse, type NextRequest } from "next/server";
import { clientSnapshot } from "@/lib/agent/context";
import { getClientRow } from "@/lib/repo/clients";
import { listPrompts } from "@/lib/repo/creatives";
import { getComm } from "@/lib/repo/comm";
import { getStartup } from "@/lib/repo/startups";
import { listIssues } from "@/lib/repo/startupIssues";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";
import { projectMd } from "@/lib/startupExport";
import { extractPrompt } from "@/components/extractPrompt";

// Промпт «почати розмову в іншому чаті з повним контекстом»: усе, що система знає про клієнта/стартап,
// + як працювати + наприкінці видати витяжку з міткою [CLIENT-OPS:ВИТЯЖКА] для Джері.
export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string; id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const { kind, id: raw } = await ctx.params;
  const id = Number(raw);
  let title = "", body = "", scope = "";
  if (kind === "client") {
    const c = getClientRow(id);
    if (!c) return NextResponse.json({ error: "Клієнта нема" }, { status: 404 });
    title = c.name;
    scope = `клієнт «${c.name}» (client_id ${id})`;
    const comm = getComm(id);
    const prompts = listPrompts(id, 10);
    body = [
      clientSnapshot(id),
      comm?.profile ? `Як спілкуватись з клієнтом:\n${comm.profile}` : "",
      prompts.length ? `Промпти креативів, які вже робили:\n${prompts.map((p) => `- «${p.title}» (${p.format})${p.verdict ? ` — ${p.verdict === "win" ? "спрацював" : "не спрацював"}` : ""}${p.angle ? `: ${p.angle}` : ""}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n");
  } else if (kind === "startup") {
    const s = getStartup(id);
    if (!s) return NextResponse.json({ error: "Проєкту нема" }, { status: 404 });
    title = s.name;
    scope = `стартап / продукт «${s.name}» (startup_id ${id})`;
    const issues = listIssues(id, { open: true, limit: 15 });
    body = [projectMd(s), issues.length ? `Відкриті проблеми продукту:\n${issues.map((i) => `- ${i.title} (×${i.count})`).join("\n")}` : ""].filter(Boolean).join("\n\n");
  } else return NextResponse.json({ error: "kind: client | startup" }, { status: 400 });

  const text = `Ти — мій робочий партнер. Я Саша: веду рекламу (Meta), будую відділи продажу (CRM, телефонія, боти заявок) і власні продукти. Нижче — ВСЕ, що моя система Client Ops знає про ${kind === "client" ? "цього клієнта" : "цей проєкт"} на ${new Date().toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv" })}. Спирайся на це: не починай з нуля, не перепитуй те, що тут є, і не дублюй уже зроблене. Пиши українською, коротко і по суті.

<context name="${title.replace(/"/g, "")}">
${body}
</context>

Зараз я напишу, над чим працюємо. Коли я напишу «витяжка» (або наприкінці розмови) — видай підсумок СТРОГО за інструкцією нижче, щоб я передав його в систему.

---
${extractPrompt(scope)}`;
  return NextResponse.json({ text, title }, { headers: { "cache-control": "no-store" } });
}
