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
import { PALETTE_DEFAULT, renderStoryFact, type Palette } from "./render/storyFact";

export const MEDIA_DIR = path.join(process.cwd(), "data", "content-media");
const sig = (id: number) => createHmac("sha256", process.env.SESSION_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || "client-ops").update(`content-media:${id}`).digest("hex").slice(0, 16);
export const mediaKey = (id: number) => `${id}-${sig(id)}`;
export function postFromKey(key: string): number | null {
  const m = key.match(/^(\d+)-([0-9a-f]{16})$/);
  return m && sig(Number(m[1])) === m[2] ? Number(m[1]) : null;
}
export type StorySpec = { asset_id?: number; kicker?: string; fact?: string; sub?: string; cta?: string };
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
  if (p.template_key !== "story-fact") return "Поки збирається тільки шаблон «Сторіс «Факт»»";
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

// ---- Апрув у Telegram: фото + ✓ / ✕ (cp:<id>:y|n)
export async function sendForApproval(id: number, origin: string): Promise<string | null> {
  const p = getPost(id);
  if (!p?.media_path) return "Спершу збери пост";
  const { tg, tgOwner } = await import("./telegram");
  const owner = tgOwner();
  if (!owner) return "Telegram не привʼязаний (Налаштування → Конектори → Telegram)";
  const c = getClient(p.client_id);
  const when = p.scheduled_at ? `вийде ${p.scheduled_at.slice(8, 10)}.${p.scheduled_at.slice(5, 7)} о ${p.scheduled_at.slice(11)}` : "вийде одразу після ✓";
  const caption = `📣 ${c?.name ?? ""} · сторіс\n${p.topic}\n${when}`;
  const photo = `${origin}/m/${mediaKey(id)}.jpg?v=${Date.parse(p.media_at ?? "") || 0}`;
  const r = await tg<{ message_id: number }>("sendPhoto", { chat_id: owner, photo, caption: caption.slice(0, 1000), reply_markup: { inline_keyboard: [[{ text: "✓ Публікувати", callback_data: `cp:${id}:y` }, { text: "✕ Ні", callback_data: `cp:${id}:n` }], [{ text: "Відкрити в системі", url: `${origin}/clients/${p.client_id}?tab=content&cv=posts` }]] } });
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
async function waitReady(container: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
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
  const url = `${origin}/m/${mediaKey(p.id)}.jpg`;
  const container = await igContainer(s.ig_id, url, p.format === "story" ? "STORIES" : "IMAGE");
  await waitReady(container);
  const done = await metaPost<{ id: string }>(`${s.ig_id}/media_publish`, { creation_id: container });
  updatePost(p.id, p.client_id, { status: "published", ig_media_id: done.id, published_at: new Date().toISOString(), publish_error: "" });
}

// Щохвилини: заплановані й схвалені пости, час яких настав
export async function contentTick(): Promise<void> {
  if (!autoOn("content_publish")) return;
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
