import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/log";
import { campaignOfAd, getAd, updateAd } from "@/lib/repo/campaigns";
import { saveFile } from "@/lib/repo/files";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Креатив оголошення в конструкторі кампаній: фото або відео до 200 МБ (зберігається на сервері, поруч з базою)
const MAX = 200 * 1024 * 1024;
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const a = getAd(Number((await ctx.params).id));
  const c = a && campaignOfAd(a.id);
  if (!a || !c) return NextResponse.json({ error: "Нема оголошення" }, { status: 404 });
  const fd = await req.formData().catch(() => null);
  const f = fd?.get("file");
  if (!(f instanceof File) || !f.size) return NextResponse.json({ error: "Обери фото або відео" }, { status: 400 });
  if (!/^(image|video)\//.test(f.type)) return NextResponse.json({ error: "Потрібне фото або відео" }, { status: 400 });
  if (f.size > MAX) return NextResponse.json({ error: "Більше 200 МБ — поклади на Диск і встав посилання" }, { status: 400 });
  try {
    const saved = saveFile({ name: f.name, mime: f.type, data: Buffer.from(await f.arrayBuffer()), client_id: c.client_id, source: "campaign" });
    updateAd(a.id, { file_id: saved.id, media_url: "", format: f.type.startsWith("video/") ? "video" : a.format === "carousel" ? "carousel" : "image" });
    return NextResponse.json({ ok: true, src: `/api/files/${saved.id}` });
  } catch (e) {
    logError("campaign-media", e);
    return NextResponse.json({ error: "Не вдалось зберегти файл" }, { status: 500 });
  }
}
