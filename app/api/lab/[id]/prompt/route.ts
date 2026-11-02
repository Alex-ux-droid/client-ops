import { NextResponse, type NextRequest } from "next/server";
import { labPrompt, PROMPT_KINDS, type PromptKind } from "@/lib/labPrompt";
import { getLab } from "@/lib/repo/lab";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Готовий промпт з даних сесії — скопіювати і зібрати презентацію деінде
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const l = getLab(Number((await ctx.params).id));
  if (!l) return NextResponse.json({ error: "Нема такої сесії" }, { status: 404 });
  const k = req.nextUrl.searchParams.get("kind") ?? "proposal";
  const kind = (k in PROMPT_KINDS ? k : "proposal") as PromptKind;
  return NextResponse.json({ kind, title: PROMPT_KINDS[kind], text: labPrompt(l, kind) }, { headers: { "cache-control": "no-store" } });
}
