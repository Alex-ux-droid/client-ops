import { NextResponse, type NextRequest } from "next/server";
import { importCompetitors } from "@/lib/competitors";
import { logError } from "@/lib/log";
import { getClientRow } from "@/lib/repo/clients";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Імпорт конкурентів з Excel (.xlsx) у клієнта: колонки знаходяться за назвами, повтори оновлюються
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const clientId = Number((await ctx.params).id);
  if (!clientId || !getClientRow(clientId)) return NextResponse.json({ error: "Нема клієнта" }, { status: 400 });
  const fd = await req.formData().catch(() => null);
  const f = fd?.get("file");
  if (!(f instanceof File) || !f.size) return NextResponse.json({ error: "Обери файл .xlsx" }, { status: 400 });
  if (f.size > 15 * 1024 * 1024) return NextResponse.json({ error: "Файл завеликий (до 15 МБ)" }, { status: 400 });
  try {
    const r = importCompetitors(clientId, Buffer.from(await f.arrayBuffer()));
    if (!r.added && !r.updated) return NextResponse.json({ error: "Не знайшов таблиці з колонкою «Компанія» — перевір заголовки" }, { status: 400 });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    logError("competitors-import", e);
    return NextResponse.json({ error: `Не вдалось прочитати: ${String((e as Error).message).slice(0, 120)}` }, { status: 400 });
  }
}
