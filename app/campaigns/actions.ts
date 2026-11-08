"use server";
// Конструктор кампаній Meta: кампанії, групи, оголошення, журнал навчання, генерація Джері
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { capOn } from "@/lib/agent/caps";
import { adLive, campaignLive, defaultUtm, genAdCopy, genCampaignDraft, genTargeting, money2 } from "@/lib/campaigns";
import { generateCreativePrompt, type CreativeFormat } from "@/lib/creativeLab";
import { llmErrorText } from "@/lib/llmJson";
import {
  adCode, addAd, addAdset, addCampaign, addNote, campaignOfAd, deleteAd, deleteAdset, deleteCampaign, deleteNote, getAd, getAdset, getCampaign,
  listAds, NOTE_KINDS, updateAd, updateAdset, updateCampaign, type Ad, type AdSet, type Campaign, type NoteKind,
} from "@/lib/repo/campaigns";
import { adsForClient } from "@/lib/repo/meta";
import { getPrompt } from "@/lib/repo/creatives";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const numOrNull = (fd: FormData, k: string) => { const s = str(fd, k).replace(",", "."); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const href = (clientId: number, cmp?: number, sel?: string) => `/clients/${clientId}?tab=meta_ads&mv=campaigns${cmp ? `&cmp=${cmp}` : ""}${sel ? `&sel=${sel}` : ""}`;
const back = (clientId: number) => revalidatePath(`/clients/${clientId}`);
const off = () => (!capOn("campaigns") ? "Вимкнено: Налаштування → Можливості → «Кампанії»" : "");

// Поля з форми — тільки ті, що прийшли (часткові форми в попапах)
function pick<T extends string>(fd: FormData, text: readonly T[], nums: readonly T[] = [], ints: readonly T[] = [], bools: readonly T[] = []) {
  const p: Record<string, unknown> = {};
  for (const k of text) if (fd.has(k)) p[k] = str(fd, k);
  for (const k of nums) if (fd.has(k)) p[k] = numOrNull(fd, k);
  for (const k of ints) if (fd.has(k)) { const n = parseInt(str(fd, k), 10); if (Number.isFinite(n)) p[k] = n; }
  for (const k of bools) if (fd.has(`${k}_present`)) p[k] = fd.get(k) ? 1 : 0;
  return p;
}

export async function createCampaignAction(fd: FormData) {
  await requireUser();
  const cid = Number(fd.get("client_id"));
  const id = addCampaign(cid, pick(fd, ["name", "objective", "budget_type", "budget_level", "idea", "start_date"] as const, ["budget", "target_cpl"] as const) as Partial<Campaign>);
  let err = "";
  if (fd.get("auto") && !off()) { try { await genCampaignDraft(id); } catch (e) { err = llmErrorText(e); } }
  else addAdset(id);
  back(cid);
  redirect(`${href(cid, id)}${err ? `&err=${encodeURIComponent(err)}` : ""}`);
}

export async function saveCampaignAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get("campaign_id")); const c = getCampaign(id); if (!c) return;
  const p = pick(fd, ["name", "objective", "status", "budget_level", "budget_type", "start_date", "end_date", "idea", "special_category", "notes", "meta_campaign_id"] as const, ["budget", "target_cpl"] as const) as Partial<Campaign>;
  if (p.status && p.status !== c.status) addNote(id, "change", `Стан: ${c.status} → ${p.status}`);
  if ("budget" in p && p.budget !== c.budget) addNote(id, "budget", `Бюджет: ${money2(c.budget)} → ${money2(p.budget)}${c.budget_type === "daily" ? "/день" : ""}`);
  updateCampaign(id, p);
  back(c.client_id);
}
export async function deleteCampaignAction(fd: FormData) {
  await requireUser();
  const c = getCampaign(Number(fd.get("campaign_id"))); if (!c) return;
  deleteCampaign(c.id); back(c.client_id); redirect(href(c.client_id));
}
// Дублювати кампанію з усіма групами й оголошеннями (без звʼязку з Meta)
export async function duplicateCampaignAction(fd: FormData) {
  await requireUser();
  const c = getCampaign(Number(fd.get("campaign_id"))); if (!c) return;
  const { id: _i, client_id: _c, created_at: _a, updated_at: _u, meta_campaign_id: _m, ...rest } = c;
  const nid = addCampaign(c.client_id, { ...rest, name: `${c.name} (копія)`, status: "draft" });
  const { listAdsets } = await import("@/lib/repo/campaigns");
  for (const s of listAdsets(c.id)) copyAdset(s, nid);
  back(c.client_id); redirect(href(c.client_id, nid));
}
function copyAdset(s: AdSet, campaignId: number, name?: string) {
  const { id: _i, campaign_id: _c, created_at: _a, meta_adset_id: _m, sort: _s, ...rest } = s;
  const nid = addAdset(campaignId, { ...rest, name: name ?? s.name });
  for (const a of listAds(s.id)) copyAd(a, nid);
  return nid;
}
function copyAd(a: Ad, adsetId: number) {
  const { id: _i, adset_id: _s, created_at: _c, meta_ad_id: _m, sort: _o, name, ...rest } = a;
  return addAd(adsetId, { ...rest, name: name.replace(/^AD-\d+\s*·?\s*/, ""), status: "draft" });
}

export async function addAdsetAction(fd: FormData) {
  await requireUser();
  const c = getCampaign(Number(fd.get("campaign_id"))); if (!c) return;
  const sid = addAdset(c.id);
  back(c.client_id); redirect(href(c.client_id, c.id, `s${sid}`));
}
export async function saveAdsetAction(fd: FormData) {
  await requireUser();
  const s = getAdset(Number(fd.get("adset_id"))); if (!s) return;
  updateAdset(s.id, pick(fd, ["name", "conversion", "form", "url", "locations", "gender", "languages", "interests", "exclusions", "audiences", "placements", "notes", "meta_adset_id"] as const, ["budget"] as const, ["age_min", "age_max"] as const, ["advantage"] as const) as Partial<AdSet>);
  back(getCampaign(s.campaign_id)!.client_id);
}
export async function adsetOpAction(fd: FormData) {
  await requireUser();
  const s = getAdset(Number(fd.get("adset_id"))); if (!s) return;
  const c = getCampaign(s.campaign_id)!;
  const op = str(fd, "op");
  if (op === "delete") { deleteAdset(s.id); back(c.client_id); redirect(href(c.client_id, c.id)); }
  if (op === "duplicate") { const nid = copyAdset(s, c.id, `${s.name} (копія)`); back(c.client_id); redirect(href(c.client_id, c.id, `s${nid}`)); }
  if (op === "add_ad") { const aid = addAd(s.id, { url: s.conversion === "site" ? s.url : "" }); back(c.client_id); redirect(href(c.client_id, c.id, `a${aid}`)); }
}

export async function saveAdAction(fd: FormData) {
  await requireUser();
  const a = getAd(Number(fd.get("ad_id"))); if (!a) return;
  const p = pick(fd, ["name", "angle", "format", "media_url", "primary_text", "headline", "description", "cta", "url", "utm", "status", "notes", "meta_ad_id"] as const) as Partial<Ad>;
  if (fd.get("utm_auto")) { const c = campaignOfAd(a.id); if (c) p.utm = defaultUtm(c, a); }
  updateAd(a.id, p);
  back(campaignOfAd(a.id)!.client_id);
}
export async function adOpAction(fd: FormData) {
  await requireUser();
  const a = getAd(Number(fd.get("ad_id"))); if (!a) return;
  const c = campaignOfAd(a.id)!;
  const op = str(fd, "op");
  if (op === "delete") { deleteAd(a.id); back(c.client_id); redirect(href(c.client_id, c.id, `s${a.adset_id}`)); }
  if (op === "duplicate") { const nid = copyAd(a, a.adset_id); back(c.client_id); redirect(href(c.client_id, c.id, `a${nid}`)); }
  if (op === "clear_media") { updateAd(a.id, { file_id: null, media_url: "" }); back(c.client_id); }
}
// Взяти креатив з робочого оголошення Meta (картинка) — переможця не треба малювати заново
export async function mediaFromMetaAction(fd: FormData) {
  await requireUser();
  const a = getAd(Number(fd.get("ad_id"))); if (!a) return;
  const c = campaignOfAd(a.id)!;
  const m = adsForClient(c.client_id).find((x) => x.ad_id === str(fd, "meta_ad_id"));
  if (!m) return;
  const url = m.image_url || m.thumbnail_url;
  updateAd(a.id, { media_url: url, file_id: null, format: m.kind === "video" ? "video" : "image", ...(a.primary_text ? {} : { primary_text: m.body }) });
  back(c.client_id);
}
// Взяти один з варіантів Джері як основний
export async function useVariantAction(adId: number, field: "primary_text" | "headline" | "description", value: string) {
  await requireUser();
  const a = getAd(adId); if (!a) return;
  updateAd(a.id, { [field]: value });
  back(campaignOfAd(a.id)!.client_id);
}

export async function genCopyAction(adId: number, wish: string) {
  await requireUser();
  if (off()) return { ok: false as const, error: off() };
  const a = getAd(adId); if (!a) return { ok: false as const, error: "Нема оголошення" };
  try { await genAdCopy(adId, wish); back(campaignOfAd(adId)!.client_id); return { ok: true as const }; }
  catch (e) { return { ok: false as const, error: llmErrorText(e) }; }
}
export async function genTargetingAction(adsetId: number, wish: string) {
  await requireUser();
  if (off()) return { ok: false as const, error: off() };
  const s = getAdset(adsetId); if (!s) return { ok: false as const, error: "Нема групи" };
  try { const why = await genTargeting(adsetId, wish); back(getCampaign(s.campaign_id)!.client_id); return { ok: true as const, why }; }
  catch (e) { return { ok: false as const, error: llmErrorText(e) }; }
}
export async function genDraftAction(campaignId: number) {
  await requireUser();
  if (off()) return { ok: false as const, error: off() };
  const c = getCampaign(campaignId); if (!c) return { ok: false as const, error: "Нема кампанії" };
  try { const r = await genCampaignDraft(campaignId); back(c.client_id); return { ok: true as const, ...r }; }
  catch (e) { return { ok: false as const, error: llmErrorText(e) }; }
}
// Промпт для Claude, щоб намалювати креатив під це оголошення (код CR-N, витяжка — як у студії креативів)
const FMT: Record<string, CreativeFormat> = { image: "feed", video: "video", carousel: "carousel" };
export async function creativePromptAction(adId: number) {
  await requireUser();
  if (!capOn("creatives")) return { ok: false as const, error: "Вимкнено: Можливості → «Креативи»" };
  const a = getAd(adId); if (!a) return { ok: false as const, error: "Нема оголошення" };
  const c = campaignOfAd(a.id)!;
  const existing = a.creative_id ? getPrompt(a.creative_id) : undefined;
  if (existing) return { ok: true as const, prompt: existing.prompt, code: `CR-${existing.id}` };
  const r = await generateCreativePrompt(c.client_id, { format: FMT[a.format] ?? "feed", angle: a.angle, note: [a.notes, a.primary_text && `Текст оголошення: ${a.primary_text.slice(0, 300)}`].filter(Boolean).join("\n") });
  if (!r.ok) return r;
  updateAd(a.id, { creative_id: r.id });
  back(c.client_id);
  return { ok: true as const, prompt: r.prompt, code: `CR-${r.id}` };
}

// Журнал навчання: нотатка / зміна / бюджет / зайшло / не зайшло / урок. До оцінки сам дописує цифри з Meta на цей момент.
export async function noteAction(fd: FormData) {
  await requireUser();
  const c = getCampaign(Number(fd.get("campaign_id"))); if (!c) return;
  const kind = (str(fd, "kind") in NOTE_KINDS ? str(fd, "kind") : "note") as NoteKind;
  const adId = Number(fd.get("ad_id")) || null, adsetId = Number(fd.get("adset_id")) || null;
  let text = str(fd, "text");
  if (kind === "win" || kind === "lose" || kind === "result") {
    const a = adId ? getAd(adId) : undefined;
    const l = a ? adLive(a) : campaignLive(c);
    if (l) text = `${text}${text ? " " : ""}(${a ? adCode(a) : "кампанія"}: 30 дн. ${money2(l.spend)} витрачено, ${l.leads} лідів, ціна ${money2(l.cpl)}${l.ctr != null ? `, CTR ${l.ctr.toFixed(2)}%` : ""})`;
    else if (a) text = `${text}${text ? " " : ""}(${adCode(a)})`;
  }
  if (!text) return;
  addNote(c.id, kind, text, { ad_id: adId, adset_id: adsetId });
  back(c.client_id);
}
export async function deleteNoteAction(fd: FormData) {
  await requireUser();
  const c = getCampaign(Number(fd.get("campaign_id"))); if (!c) return;
  deleteNote(Number(fd.get("note_id"))); back(c.client_id);
}
