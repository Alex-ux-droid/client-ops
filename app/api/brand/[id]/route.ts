import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/log";
import { addAsset, ASSET_KINDS } from "@/lib/repo/brand";
import { getClientRow } from "@/lib/repo/clients";
import { saveFile } from "@/lib/repo/files";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Завантажити файли бренду (логотипи, шрифти, гайдлайни, фото) — до 20 МБ кожен
const MAX = 20 * 1024 * 1024;
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const clientId = Number((await ctx.params).id);
  if (!clientId || !getClientRow(clientId)) return NextResponse.json({ error: "Нема клієнта" }, { status: 400 });
  const fd = await req.formData().catch(() => null);
  const kind = String(fd?.get("kind") ?? "other");
  const files = (fd?.getAll("files") ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return NextResponse.json({ error: "Обери файл" }, { status: 400 });
  const big = files.find((f) => f.size > MAX);
  if (big) return NextResponse.json({ error: `«${big.name}» більший за 20 МБ — поклади на Диск і додай посиланням` }, { status: 400 });
  try {
    let n = 0;
    for (const f of files) {
      const saved = saveFile({ name: f.name, mime: f.type || "application/octet-stream", data: Buffer.from(await f.arrayBuffer()), client_id: clientId, source: "brand" });
      const k = kind in ASSET_KINDS ? kind : /font|\.(ttf|otf|woff2?)$/i.test(f.name) ? "font" : /logo|лого/i.test(f.name) ? "logo" : "other";
      addAsset(clientId, { kind: k, title: f.name.replace(/\.[^.]+$/, ""), file_id: saved.id });
      n++;
    }
    return NextResponse.json({ ok: true, added: n });
  } catch (e) {
    logError("brand-upload", e);
    return NextResponse.json({ error: "Не вдалось зберегти файл" }, { status: 500 });
  }
}
