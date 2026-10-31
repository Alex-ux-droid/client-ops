// Картинки для Джері: фото з Telegram-груп клієнта і креативи Meta → блоки image (base64) у відповідь інструмента.
// Модель бачить їх як звичайні зображення. Ліміт API — 5 МБ на картинку, тому великі пропускаємо.
import { downloadFile, googleConnected } from "../google";
import { adsForClient } from "../repo/meta";
import { clientMessages, getTgFile } from "../repo/telegram";
import { fileBlob, TG_FILE_LIMIT } from "../telegram";

export type ImageBlock = { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } };
export type ToolImages = { __images: { label: string; image: ImageBlock | null; error?: string }[]; note?: string };
export const isToolImages = (v: unknown): v is ToolImages => !!v && typeof v === "object" && Array.isArray((v as ToolImages).__images);

const MAX_BYTES = 4_500_000, MAX_IMAGES = 8;
const TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

function sniff(b: Uint8Array): ImageBlock["source"]["media_type"] | null {
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49) return "image/gif";
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
async function toBlock(buf: ArrayBuffer, mime?: string): Promise<ImageBlock> {
  const b = new Uint8Array(buf);
  if (b.length > MAX_BYTES) throw new Error("завелика картинка (понад 4.5 МБ)");
  const t = sniff(b) ?? (TYPES as readonly string[]).find((x) => x === mime);
  if (!t) throw new Error("не картинка (або формат, який я не бачу)");
  return { type: "image", source: { type: "base64", media_type: t as ImageBlock["source"]["media_type"], data: Buffer.from(b).toString("base64") } };
}

async function tgImage(id: number, clientId?: number | null): Promise<ImageBlock> {
  const f = getTgFile(id);
  if (!f || !f.tg_file_id) throw new Error("нема такого файлу");
  if (clientId && f.client_id !== clientId) throw new Error("файл з групи іншого клієнта");
  if (f.kind !== "photo" && !/^image\//.test(f.mime)) throw new Error(`це ${f.kind}, не картинка`);
  if (f.file_size > TG_FILE_LIMIT) throw new Error("понад 20 МБ — бот не скачає");
  if (f.drive_id && googleConnected()) {
    const r = await downloadFile(f.drive_id).catch(() => null);
    if (r) return toBlock(await r.arrayBuffer(), f.mime);
  }
  return toBlock(await (await fileBlob(f.tg_file_id)).arrayBuffer(), f.mime);
}

async function urlImage(url: string): Promise<ImageBlock> {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`не відкрилась (${r.status})`);
  return toBlock(await r.arrayBuffer(), r.headers.get("content-type") ?? undefined);
}

export async function viewImages(input: { client_id?: number | null; tg_message_ids?: number[]; last_photos?: number; meta_ad_ids?: string[] }): Promise<ToolImages> {
  const out: ToolImages["__images"] = [];
  const add = async (label: string, get: () => Promise<ImageBlock>) => {
    if (out.length >= MAX_IMAGES) return;
    try { out.push({ label, image: await get() }); } catch (e) { out.push({ label, image: null, error: e instanceof Error ? e.message : String(e) }); }
  };
  const ids = [...(input.tg_message_ids ?? [])];
  if (input.last_photos && input.client_id) {
    const photos = clientMessages(input.client_id, { limit: 400 }).filter((m) => m.tg_file_id && (m.kind === "photo" || /^image\//.test(m.mime ?? ""))).slice(-Math.min(MAX_IMAGES, input.last_photos));
    for (const m of photos) if (!ids.includes(m.id)) ids.push(m.id);
  }
  for (const id of ids) {
    const f = getTgFile(id);
    await add(`Telegram file_id=${id}${f ? ` · ${f.sent_at.slice(0, 16)} · ${f.from_name}` : ""}`, () => tgImage(id, input.client_id));
  }
  if (input.meta_ad_ids?.length) {
    if (!input.client_id) throw new Error("для креативів Meta потрібен client_id");
    const ads = adsForClient(input.client_id);
    for (const adId of input.meta_ad_ids) {
      const a = ads.find((x) => x.ad_id === adId);
      const url = a?.image_url || a?.thumbnail_url;
      await add(`Meta ad_id=${adId}${a ? ` «${a.name}»${a.kind === "video" ? " (обкладинка відео)" : ""}` : ""}`, async () => { if (!url) throw new Error("нема картинки креативу"); return urlImage(url); });
    }
  }
  if (!out.length) return { __images: [], note: "Нема картинок за цим запитом. Візьми file_id з telegram_messages або ad_id з meta_ads." };
  return { __images: out };
}
