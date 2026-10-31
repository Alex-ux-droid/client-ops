import { NextResponse, type NextRequest } from "next/server";
import { reactTip, REACTIONS, type Reaction } from "@/lib/repo/tips";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Реакція Саші на пораду: knew | new | boring | more
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const id = Number((await ctx.params).id);
  const { reaction } = (await req.json().catch(() => ({}))) as { reaction?: string };
  if (!id || !reaction || !(reaction in REACTIONS)) return NextResponse.json({ error: "Погана реакція" }, { status: 400 });
  reactTip(id, reaction as Reaction);
  return NextResponse.json({ ok: true });
}
