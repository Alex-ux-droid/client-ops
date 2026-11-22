// Автопостинг: пост → рендер (шаблон + слоти, без LLM) → апрув у Telegram (✓ / ✕) → публікація в Instagram за розкладом.
// Медіа лежить у data/content-media, Meta забирає його за публічним підписаним посиланням /m/<id>-<підпис>.jpg.
import fs from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import { autoOn } from "./agent/caps";
import { downloadFile } from "./google";
import { logError } from "./log";
import { metaGet, metaPost } from "./meta";
import { listColors } from "./repo/brand";
import { duePosts, getAsset, getPost, listAssets, updatePost, type Post } from "./repo/content";
import { getClient } from "./repo/clients";
import { getSocial } from "./repo/social";
import { renderCarousel } from "./render/carousel";
import { renderReel } from "./render/reel";
import { PALETTE_DEFAULT, renderStoryFact, type Palette } from "./render/storyFact";

export const MEDIA_DIR = path.join(process.cwd(), "data", "content-media");
const sig = (id: number) => createHmac("sha256", process.env.SESSION_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || "client-ops").update(`content-media:${id}`).digest("hex").slice(0, 16);
export const mediaKey = (id: number) => `${id}-${sig(id)}`;
export function postFromKey(key: string): number | null {
  const m = key.match(/^(\d+)-([0-9a-f]{16})$/);
  return m && sig(Number(m[1])) === m[2] ? Number(m[1]) : null;
}
// Файл слайда: 0 — обкладинка (<id>.jpg), далі <id>_<n>.jpg; посилання /m/<ключ>.jpg і /m/<ключ>_<n>.jpg
export const mediaFile = (id: number, n = 0) => path.join(MEDIA_DIR, n ? `${id}_${n}.jpg` : `${id}.jpg`);
export const mediaUrl = (origin: string, id: number, n = 0) => `${origin}/m/${mediaKey(id)}${n ? `_${n}` : ""}.jpg`;
export const videoFile = (id: number) => path.join(MEDIA_DIR, `${id}.mp4`);
export const videoUrl = (origin: string, id: number) => `${origin}/m/${mediaKey(id)}.mp4`;
export type SlideSpec = { asset_id: number; title?: string; text?: string; pos?: number };
export type StorySpec = { asset_id?: number; kicker?: string; fact?: string; sub?: string; cta?: string; slides?: SlideSpec[]; end_title?: string; end_text?: string; media_n?: number };
export const isCarousel = (p: Pick<Post, "format" | "template_key">) => p.format === "carousel" || p.template_key.startsWith("carousel");
export const isReel = (p: Pick<Post, "format" | "template_key">) => p.format === "reel" || p.template_key.startsWith("reel");
export const slideCount = (p: Post) => (p.media_path ? (isCarousel(p) ? specOf(p).media_n ?? 1 : 1) : 0);
export const specOf = (p: Post): StorySpec => { try { return JSON.parse(p.spec_json || "{}"); } catch { return {}; } };

export function paletteOf(clientId: number): Palette {
  const s = getSocial(clientId);
  try { const p = JSON.parse(s?.palette_json || "{}"); if (p.dark) return { ...PALETTE_DEFAULT, ...p }; } catch {}
  const c = listColors(clientId).map((x) => x.hex);
  return c.length >= 2 ? { ...PALETTE_DEFAULT, dark: c[0], accent: c[1] } : PALETTE_DEFAULT;
}

const fileOf = async (driveId: string) => Buffer.from(await (await downloadFile(driveId)).arrayBuffer());

// Зібрати пост за шаблоном. Повертає помилку для показу або null.
export async function renderPost(id: number): Promise<string | null> {
  const p = getPost(id);
  if (!p) return "Поста нема";
  if (isCarousel(p)) return renderCarouselPost(p);
  if (isReel(p)) return renderReelPost(p);
  if (p.template_key !== "story-fact") return "Поки збираються шаблони «Сторіс «Факт»» і «Карусель «Фішка»»";
  const s = specOf(p);
  if (!s.fact?.trim()) return "Впиши факт — головну фразу сторіс";
  const a = s.asset_id ? getAsset(s.asset_id) : null;
  if (!a || a.client_id !== p.client_id) return "Обери рендер з матеріалів";
  if (!a.mime.startsWith("image/")) return "Для сторіс потрібне зображення";
  const logoA = listAssets(p.client_id).find((x) => x.kind === "logo" && /png|svg|jpeg/.test(x.mime));
  const c = getClient(p.client_id);
  const jpg = await renderStoryFact({
    image: await fileOf(a.drive_id), kicker: s.kicker, fact: s.fact, sub: s.sub, cta: s.cta,
    brand: (c?.name ?? "").replace(/^Тест:\s*/, ""), logo: logoA ? await fileOf(logoA.drive_id).catch(() => null) : null, pal: paletteOf(p.client_id),
  });
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const file = path.join(MEDIA_DIR, `${id}.jpg`);
  fs.writeFileSync(file, jpg);
  updatePost(id, p.client_id, { media_path: file, media_at: new Date().toISOString(), status: p.status === "idea" ? "making" : p.status, publish_error: "" });
  return null;
}

const brandOf = (clientId: number) => (getClient(clientId)?.name ?? "").replace(/^Тест:\s*/, "");
const logoOf = async (clientId: number) => {
  const a = listAssets(clientId).find((x) => x.kind === "logo" && /png|svg|jpeg/.test(x.mime));
  return a ? fileOf(a.drive_id).catch(() => null) : null;
};

// Карусель: перший обраний кадр — обкладинка, решта — слайди з тезами, останній слайд — CTA
async function renderCarouselPost(p: Post): Promise<string | null> {
  const s = specOf(p);
  const sl = [...(s.slides ?? [])].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  if (sl.length < 3) return "Обери щонайменше 3 кадри: обкладинка + 2 слайди";
  if (!s.fact?.trim()) return "Впиши заголовок обкладинки";
  const assets = sl.map((x) => getAsset(x.asset_id));
  if (assets.some((a) => !a || a.client_id !== p.client_id || !a.mime.startsWith("image/"))) return "Один із кадрів не знайдено в матеріалах — обери ще раз";
  const empty = sl.slice(1).findIndex((x) => !x.title?.trim());
  if (empty >= 0) return `Слайд ${empty + 2}: впиши тезу (або «Джері, заповни тексти»)`;
  const files = await Promise.all(assets.map((a) => fileOf(a!.drive_id)));
  const jpgs = await renderCarousel({
    brand: brandOf(p.client_id), logo: await logoOf(p.client_id), pal: paletteOf(p.client_id),
    cover: { image: files[0], kicker: s.kicker, title: s.fact, sub: s.sub },
    slides: sl.slice(1).map((x, i) => ({ image: files[i + 1], plan: assets[i + 1]!.kind === "plan", title: x.title!, text: x.text })),
    end: { title: s.end_title?.trim() || "Хочете побачити наживо?", text: s.end_text, cta: s.cta },
  });
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  for (const f of fs.readdirSync(MEDIA_DIR)) if (f.startsWith(`${p.id}_`)) fs.rmSync(path.join(MEDIA_DIR, f));
  jpgs.forEach((b, n) => fs.writeFileSync(mediaFile(p.id, n), b));
  updatePost(p.id, p.client_id, { spec_json: JSON.stringify({ ...s, media_n: jpgs.length }), media_path: mediaFile(p.id), media_at: new Date().toISOString(), status: p.status === "idea" ? "making" : p.status, publish_error: "" });
  return null;
}

// Reels: 3–5 кадрів з наїздом камери, рядок тексту на кожному, фінал з CTA; звук — свій трек з матеріалів або тиша
async function renderReelPost(p: Post): Promise<string | null> {
  const s = specOf(p) as StorySpec & { audio_id?: number };
  const sl = [...(s.slides ?? [])].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  if (sl.length < 2) return "Обери щонайменше 2 кадри (краще 3–5)";
  const assets = sl.map((x) => getAsset(x.asset_id));
  if (assets.some((a) => !a || a.client_id !== p.client_id || !a.mime.startsWith("image/"))) return "Один із кадрів не знайдено в матеріалах — обери ще раз";
  const empty = sl.findIndex((x) => !x.title?.trim());
  if (empty >= 0) return `Кадр ${empty + 1}: впиши рядок тексту (або «Джері, заповни тексти»)`;
  const audioA = s.audio_id ? getAsset(s.audio_id) : null;
  const files = await Promise.all(assets.map((a) => fileOf(a!.drive_id)));
  const mp4 = await renderReel({
    brand: brandOf(p.client_id), logo: await logoOf(p.client_id), pal: paletteOf(p.client_id),
    shots: sl.map((x, i) => ({ image: files[i], plan: assets[i]!.kind === "plan", line: x.title!, kicker: i === 0 ? s.kicker : undefined })),
    end: { title: s.end_title?.trim() || "Подивіться наживо", cta: s.cta },
    audio: audioA && audioA.client_id === p.client_id && audioA.mime.startsWith("audio/") ? await fileOf(audioA.drive_id) : null,
  });
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  fs.writeFileSync(videoFile(p.id), mp4);
  // Обкладинка-прев'ю для дошки і Telegram — кадр 1,5 с
  const { spawnSync } = await import("node:child_process");
  const { FFMPEG } = await import("./render/reel");
  spawnSync(/*turbopackIgnore: true*/ FFMPEG, ["-v", "error", "-y", "-ss", "1.5", "-i", videoFile(p.id), "-frames:v", "1", "-q:v", "3", mediaFile(p.id)]);
  updatePost(p.id, p.client_id, { media_path: videoFile(p.id), media_at: new Date().toISOString(), status: p.status === "idea" ? "making" : p.status, publish_error: "" });
  return null;
}

// ---- Апрув у Telegram: фото + ✓ / ✕ (cp:<id>:y|n)
export async function sendForApproval(id: number, origin: string): Promise<string | null> {
  const p = getPost(id);
  if (!p?.media_path) return "Спершу збери пост";
  const { tg, tgOwner } = await import("./telegram");
  const owner = tgOwner();
  if (!owner) return "Telegram не привʼязаний (Налаштування → Конектори → Telegram)";
  const c = getClient(p.client_id);
  const when = p.scheduled_at ? `вийде ${p.scheduled_at.slice(8, 10)}.${p.scheduled_at.slice(5, 7)} о ${p.scheduled_at.slice(11)}` : "вийде одразу після ✓";
  const v = `?v=${Date.parse(p.media_at ?? "") || 0}`;
  const keyboard = { inline_keyboard: [[{ text: "✓ Публікувати", callback_data: `cp:${id}:y` }, { text: "✕ Ні", callback_data: `cp:${id}:n` }], [{ text: "Відкрити в системі", url: `${origin}/clients/${p.client_id}?tab=content&cv=posts` }]] };
  let r: { message_id: number };
  if (isReel(p)) {
    const text = `📣 ${c?.name ?? ""} · Reels\n${p.topic}\n${when}${p.caption ? `\n\nПідпис:\n${p.caption}` : "\n\n⚠️ Підпису нема"}`;
    r = await tg<{ message_id: number }>("sendVideo", { chat_id: owner, video: videoUrl(origin, id) + v, supports_streaming: true, caption: text.slice(0, 1000), reply_markup: keyboard });
  } else if (isCarousel(p)) {
    const n = slideCount(p);
    await tg("sendMediaGroup", { chat_id: owner, media: Array.from({ length: Math.min(n, 10) }, (_, i) => ({ type: "photo", media: mediaUrl(origin, id, i) + v })) });
    const text = `📣 ${c?.name ?? ""} · карусель, ${n} слайдів\n${p.topic}\n${when}${p.caption ? `\n\nПідпис:\n${p.caption}` : "\n\n⚠️ Підпису нема"}`;
    r = await tg<{ message_id: number }>("sendMessage", { chat_id: owner, text: text.slice(0, 4000), reply_markup: keyboard });
  } else {
    const caption = `📣 ${c?.name ?? ""} · сторіс\n${p.topic}\n${when}`;
    r = await tg<{ message_id: number }>("sendPhoto", { chat_id: owner, photo: mediaUrl(origin, id) + v, caption: caption.slice(0, 1000), reply_markup: keyboard });
  }
  updatePost(id, p.client_id, { status: "review", tg_msg_id: r.message_id });
  return null;
}

export async function approvalCallback(q: { id: string; data?: string; from?: { id: number }; message?: { chat: { id: number }; message_id: number } }): Promise<void> {
  const { tg, tgOwner } = await import("./telegram");
  const owner = q.from?.id === tgOwner();
  const [, id, ans] = (q.data ?? "").split(":");
  const p = owner ? getPost(Number(id)) : undefined;
  let note = "Вже розібрано";
  if (p && p.status === "review") {
    if (ans === "y") { updatePost(p.id, p.client_id, { status: "scheduled" }); note = p.scheduled_at ? `✓ Вийде ${p.scheduled_at.slice(8, 10)}.${p.scheduled_at.slice(5, 7)} о ${p.scheduled_at.slice(11)}` : "✓ Публікую зараз"; }
    else { updatePost(p.id, p.client_id, { status: "making" }); note = "✕ Повернув у «Готується» — поправ у системі"; }
  }
  await tg("answerCallbackQuery", { callback_query_id: q.id, text: owner ? note : "Не для тебе" }).catch(() => {});
  if (owner && q.message) await tg("editMessageReplyMarkup", { chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: note, callback_data: "noop" }]] } }).catch(() => {});
}

// ---- Публікація в Instagram (сторіс): контейнер → чекаємо FINISHED → media_publish
async function waitReady(container: string, tries = 20): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const s = await metaGet<{ status_code?: string; status?: string }>(container, { fields: "status_code,status" });
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Instagram не прийняв файл: ${s.status ?? s.status_code}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Instagram довго обробляє файл — спробую наступної хвилини");
}
export async function igContainer(igId: string, imageUrl: string, kind: "STORIES" | "IMAGE"): Promise<string> {
  const r = await metaPost<{ id: string }>(`${igId}/media`, kind === "STORIES" ? { media_type: "STORIES", image_url: imageUrl } : { image_url: imageUrl });
  return r.id;
}
export async function publishPost(p: Post, origin: string): Promise<void> {
  const s = getSocial(p.client_id);
  if (!s?.ig_id) throw new Error("У клієнта не обрано Instagram (Контент → Налаштування)");
  let container: string;
  if (isReel(p)) {
    // Reels: Instagram сам завантажує відео за посиланням і обробляє до кількох хвилин
    container = (await metaPost<{ id: string }>(`${s.ig_id}/media`, { media_type: "REELS", video_url: videoUrl(origin, p.id), caption: p.caption.slice(0, 2200), share_to_feed: "true", thumb_offset: "1500" })).id;
    await waitReady(container, 60);
  } else if (isCarousel(p)) {
    // Карусель: контейнер на кожен слайд (is_carousel_item) → батьківський CAROUSEL з підписом → публікація
    const kids: string[] = [];
    for (let i = 0; i < Math.min(slideCount(p), 10); i++) {
      const k = await metaPost<{ id: string }>(`${s.ig_id}/media`, { image_url: mediaUrl(origin, p.id, i), is_carousel_item: "true" });
      await waitReady(k.id);
      kids.push(k.id);
    }
    if (kids.length < 2) throw new Error("У каруселі менше 2 слайдів — збери ще раз");
    container = (await metaPost<{ id: string }>(`${s.ig_id}/media`, { media_type: "CAROUSEL", children: kids.join(","), caption: p.caption.slice(0, 2200) })).id;
  } else container = (await metaPost<{ id: string }>(`${s.ig_id}/media`, p.format === "story" ? { media_type: "STORIES", image_url: mediaUrl(origin, p.id) } : { image_url: mediaUrl(origin, p.id), caption: p.caption.slice(0, 2200) })).id;
  await waitReady(container);
  const done = await metaPost<{ id: string }>(`${s.ig_id}/media_publish`, { creation_id: container });
  updatePost(p.id, p.client_id, { status: "published", ig_media_id: done.id, published_at: new Date().toISOString(), publish_error: "" });
}

// Щохвилини: заплановані й схвалені пости, час яких настав
let publishing = false; // публікація Reels може йти кілька хвилин — наступні хвилинні тіки не дублюють
export async function contentTick(): Promise<void> {
  if (!autoOn("content_publish") || publishing) return;
  publishing = true;
  try { await publishDue(); } finally { publishing = false; }
}
async function publishDue(): Promise<void> {
  const nowK = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 16);
  const due = duePosts(nowK);
  if (!due.length) return;
  const { appOrigin, tg, tgOwner } = await import("./telegram");
  const origin = await appOrigin();
  if (!origin) return;
  for (const p of due) {
    try { await publishPost(p, origin); await tg("sendMessage", { chat_id: tgOwner(), text: `✅ Вийшло в Instagram: ${p.topic}` }).catch(() => {}); }
    catch (e) {
      const msg = e instanceof Error ? e.message : "помилка";
      updatePost(p.id, p.client_id, { status: "failed", publish_error: msg.slice(0, 500) });
      logError("content-publish", e);
      await tg("sendMessage", { chat_id: tgOwner(), text: `⚠️ Не вийшло в Instagram: ${p.topic}\n${msg.slice(0, 300)}` }).catch(() => {});
    }
  }
}

// Перевірка доступу: готуємо контейнер (нічого не публікуємо — без media_publish він сам зникне за добу)
export async function checkPublishAccess(clientId: number, origin: string): Promise<string> {
  const s = getSocial(clientId);
  if (!s?.ig_id) return "Спершу обери сторінку з Instagram у Налаштуваннях студії";
  const p = fs.existsSync(MEDIA_DIR) ? fs.readdirSync(MEDIA_DIR).find((f) => /^\d+\.jpg$/.test(f)) : null;
  let id: number;
  if (p) id = Number(p.split(".")[0]);
  else {
    const sharp = (await import("sharp")).default;
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    id = 0;
    fs.writeFileSync(path.join(MEDIA_DIR, "0.jpg"), await sharp({ create: { width: 1080, height: 1920, channels: 3, background: "#0f5a3f" } }).jpeg().toBuffer());
  }
  try {
    const c = await igContainer(s.ig_id, `${origin}/m/${mediaKey(id)}.jpg`, "STORIES");
    return `✓ Доступ є: Instagram @${s.ig_username} прийняв тестову сторіс на підготовку (контейнер ${c}). Нічого не опубліковано.`;
  } catch (e) { return `✕ ${e instanceof Error ? e.message : "помилка"}`; }
}
