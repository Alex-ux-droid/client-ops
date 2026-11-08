import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/log";
import { campaignOfAd, cardsOf, getAd, isMotion, updateAd } from "@/lib/repo/campaigns";
import { saveFile } from "@/lib/repo/files";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

// Креатив оголошення: фото/відео до 200 МБ; кілька файлів (або формат «Карусель») — картки каруселі, до 10.
// PATCH {op: "remove"|"left"|"right", file_id} — керування картками.
const MAX = 200 * 1024 * 1024, MAX_CARDS = 10;
const auth = (req: NextRequest) => isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"));

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!auth(req)) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const a = getAd(Number((await ctx.params).id));
  const c = a && campaignOfAd(a.id);
  if (!a || !c) return NextResponse.json({ error: "Нема оголошення" }, { status: 404 });
  const fd = await req.formData().catch(() => null);
  const files = (fd?.getAll("file") ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return NextResponse.json({ error: "Обери фото або відео" }, { status: 400 });
  const bad = files.find((f) => !/^(image|video)\//.test(f.type));
  if (bad) return NextResponse.json({ error: `«${bad.name}» — не фото і не відео. Якщо Claude дав HTML — збережи як PNG` }, { status: 400 });
  const big = files.find((f) => f.size > MAX);
  if (big) return NextResponse.json({ error: `«${big.name}» більше 200 МБ — поклади на Диск і встав посилання` }, { status: 400 });
  try {
    const carousel = a.format === "carousel" || files.length > 1;
    const ids: number[] = [];
    for (const f of files.slice(0, MAX_CARDS)) ids.push(saveFile({ name: f.name, mime: f.type, data: Buffer.from(await f.arrayBuffer()), client_id: c.client_id, source: "campaign" }).id);
    if (carousel) {
      const all = [...(a.format === "carousel" ? cardsOf(a) : []), ...ids].slice(0, MAX_CARDS);
      updateAd(a.id, { format: "carousel", files_json: JSON.stringify(all), file_id: all[0], media_url: "" });
      return NextResponse.json({ ok: true, cards: all.length, skipped: Math.max(0, files.length - MAX_CARDS) });
    }
    const v = files[0].type.startsWith("video/");
    updateAd(a.id, { file_id: ids[0], files_json: "[]", media_url: "", ...(v && !isMotion(a.format) ? { format: "video" } : !v && isMotion(a.format) ? { format: "story" } : {}) });
    return NextResponse.json({ ok: true, src: `/api/files/${ids[0]}` });
  } catch (e) {
    logError("campaign-media", e);
    return NextResponse.json({ error: "Не вдалось зберегти файл" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!auth(req)) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const a = getAd(Number((await ctx.params).id));
  if (!a) return NextResponse.json({ error: "Нема оголошення" }, { status: 404 });
  const { op, file_id } = (await req.json().catch(() => ({}))) as { op?: string; file_id?: number };
  const cards = cardsOf(a);
  const i = cards.indexOf(Number(file_id));
  if (i < 0) return NextResponse.json({ error: "Нема такої картки" }, { status: 400 });
  if (op === "remove") cards.splice(i, 1);
  else if (op === "left" && i > 0) [cards[i - 1], cards[i]] = [cards[i], cards[i - 1]];
  else if (op === "right" && i < cards.length - 1) [cards[i + 1], cards[i]] = [cards[i], cards[i + 1]];
  updateAd(a.id, { files_json: JSON.stringify(cards), file_id: cards[0] ?? null });
  return NextResponse.json({ ok: true });
}
