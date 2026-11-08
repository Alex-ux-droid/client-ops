// Конструктор кампаній: ліміти Meta, перевірки (без ШІ), текст для копіювання, звʼязок з живими цифрами і генерація Джері.
import type Anthropic from "@anthropic-ai/sdk";
import { asText, askJson } from "./llmJson";
import {
  AD_FORMATS, adCode, addAd, addAdset, addForm, adsWithForm, campaignOfAd, CARD_LIMITS, FORM_LIMITS, FORM_TYPES, listForms, parseQuestions, cardsOf, cardTextsOf, hasMediaOf, isMotion, PLAN_FIELDS, planOf, adsOfCampaign, clientLessons, CONVERSIONS, CTAS, GENDERS, getAd, getAdset, getCampaign, globalLessons,
  listAdsets, listAds, listCampaigns, OBJECTIVES, updateAd, updateAdset, updateCampaign, variantsOf,
  type Ad, type AdSet, type Campaign, type LeadForm, type Variants,
} from "./repo/campaigns";
import { getFile, readFile } from "./repo/files";
import { creativeTools } from "./aiRadar";
import { stylesFor } from "./repo/creativeCenter";
import { adsForClient, adTotalsForClient, campaignsWithStats, kyivDay, type MetaAd } from "./repo/meta";

// Рекомендовані довжини Meta (далі текст ховається за «Ще» або обрізається на частині плейсментів)
export const LIMITS = { primary: 125, headline: 40, description: 30 } as const;

const lbl = <T extends Record<string, string>>(m: T, k: string) => (m as Record<string, string>)[k] ?? k;
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
export const money2 = (n: number | null | undefined) => (n == null ? "—" : String(Math.round(n * 100) / 100));

// ---------- звʼязок з Meta: код AD-N у назві оголошення → meta_ad_id; кампанія — з першого знайденого оголошення
export function syncCampaign(c: Campaign): void {
  const ads = adsOfCampaign(c.id);
  if (!ads.length) return;
  const live = adsForClient(c.client_id);
  for (const a of ads) {
    if (a.meta_ad_id) continue;
    const m = live.find((x) => new RegExp(`\\b${adCode(a)}\\b`).test(x.name));
    if (!m) continue;
    updateAd(a.id, { meta_ad_id: m.ad_id, status: a.status === "draft" || a.status === "ready" ? "live" : a.status });
    if (!c.meta_campaign_id && m.campaign_id) { updateCampaign(c.id, { meta_campaign_id: m.campaign_id, status: c.status === "live" ? c.status : "live" }); c.meta_campaign_id = m.campaign_id; }
    const s = getAdset(a.adset_id);
    if (s && !s.meta_adset_id && m.adset_id) updateAdset(s.id, { meta_adset_id: m.adset_id });
  }
}

export type LiveNums = { spend: number; leads: number; cpl: number | null; ctr: number | null; impressions: number };
export function campaignLive(c: Campaign): LiveNums | null {
  if (!c.meta_campaign_id) return null;
  const x = campaignsWithStats(c.client_id, kyivDay(29)).find((k) => k.campaign_id === c.meta_campaign_id);
  if (!x) return null;
  return { spend: x.spend, leads: x.leads, cpl: x.leads ? x.spend / x.leads : null, ctr: x.impressions ? (x.clicks / x.impressions) * 100 : null, impressions: x.impressions };
}
export function adLive(a: Ad, metaAds?: MetaAd[]): (LiveNums & { allSpend: number; allLeads: number }) | null {
  if (!a.meta_ad_id) return null;
  const c = getAdset(a.adset_id) && campaignOfAdset(a.adset_id);
  const list = metaAds ?? (c ? adsForClient(c.client_id) : []);
  const m = list.find((x) => x.ad_id === a.meta_ad_id);
  const t = c ? adTotalsForClient(c.client_id).find((x) => x.ad_id === a.meta_ad_id) : undefined;
  if (!m && !t) return null;
  return {
    spend: m?.spend_30d ?? 0, leads: m?.leads_30d ?? 0, cpl: m?.leads_30d ? m.spend_30d / m.leads_30d : null,
    ctr: m?.impressions_30d ? (m.clicks_30d / m.impressions_30d) * 100 : null, impressions: m?.impressions_30d ?? 0,
    allSpend: t?.spend ?? m?.spend_30d ?? 0, allLeads: t?.leads ?? m?.leads_30d ?? 0,
  };
}
const campaignOfAdset = (adsetId: number) => { const s = getAdset(adsetId); return s ? getCampaign(s.campaign_id) : undefined; };

// ---------- перевірки без ШІ: що виправити до запуску
export type Check = { level: "bad" | "warn" | "tip"; text: string; where?: string };
export function campaignChecks(c: Campaign): Check[] {
  const out: Check[] = [];
  const sets = listAdsets(c.id);
  const daily = c.budget == null ? null : c.budget_type === "daily" ? c.budget : null;
  if (c.budget_level === "campaign" && c.budget == null) out.push({ level: "bad", text: "Не вказано бюджет кампанії", where: "Кампанія" });
  if (!sets.length) out.push({ level: "bad", text: "Нема жодної групи оголошень", where: "Кампанія" });
  if (c.target_cpl && daily) {
    const perWeek = (daily * 7) / c.target_cpl;
    if (perWeek < 50 / Math.max(1, sets.length) && perWeek < 30)
      out.push({ level: "warn", text: `Бюджет ${money2(daily)}/день при цілі ${money2(c.target_cpl)} за лід ≈ ${Math.round(perWeek)} лідів на тиждень. Meta виходить з навчання після ~50 конверсій/тиждень на групу — менше груп або більший бюджет`, where: "Кампанія" });
  }
  if (c.budget_level === "campaign" && sets.length > 3 && daily != null && daily < 30) out.push({ level: "warn", text: `${sets.length} групи на ${money2(daily)}/день — бюджет розпорошиться, краще 1–2 групи`, where: "Кампанія" });
  if (c.status === "draft" && c.start_date && c.start_date < kyivDay(0)) out.push({ level: "tip", text: "Дата старту вже минула — онови перед запуском", where: "Кампанія" });
  for (const s of sets) {
    const w = s.name;
    const ads = listAds(s.id);
    if (!s.locations.trim()) out.push({ level: "bad", text: "Не вказано місто / регіон", where: w });
    if (c.budget_level === "adset" && s.budget == null) out.push({ level: "bad", text: "Бюджет групи не вказано (бюджет на рівні груп)", where: w });
    if (s.age_max - s.age_min < 10) out.push({ level: "warn", text: `Вузький вік ${s.age_min}–${s.age_max}: дорожчий показ, Meta гірше вчиться`, where: w });
    if (s.conversion === "site" && !s.url.trim() && !ads.some((a) => a.url)) out.push({ level: "bad", text: "Ціль — сайт, але нема посилання", where: w });
    if (s.conversion === "form") { const nf = ads.filter((x) => !x.form_id); if (nf.length) out.push({ level: "warn", text: `Без лід-форми: ${nf.map(adCode).join(", ")} — вибери з бібліотеки або «Форма від Джері»`, where: w }); }
    if (s.advantage && lines(s.interests).length) out.push({ level: "tip", text: "З Advantage+ аудиторією інтереси — лише підказка для Meta, не жорстке обмеження", where: w });
    if (!ads.length) out.push({ level: "bad", text: "Нема оголошень", where: w });
    else if (ads.length === 1) out.push({ level: "tip", text: "Одне оголошення — додай 2–4 різні концепти (різні кути, не варіації одного), так Meta швидше знайде переможця", where: w });
    else if (ads.length > 6) out.push({ level: "warn", text: `${ads.length} оголошень в одній групі — бюджет розмажеться, залиш 3–6`, where: w });
    if (ads.length > 1 && !ads.some((a) => ["story", "motion", "video"].includes(a.format))) out.push({ level: "tip", text: "Нема вертикального 9:16 — додай фото/моушен для Reels і Stories", where: w });
    for (const a of ads) {
      const an = adCode(a);
      const hasMedia = hasMediaOf(a);
      if (!hasMedia) out.push({ level: "bad", text: a.creative_prompt ? "Креатив ще не завантажено — промпт готовий" : "Нема креативу і промпту для нього", where: an });
      else if (!a.primary_text.trim()) out.push({ level: "bad", text: "Креатив є — напиши тексти («Тексти під цей креатив»)", where: an });
      if (hasMedia && !a.headline.trim() && cardsOf(a).length < 2) out.push({ level: "warn", text: "Нема заголовка", where: an });
      const cids = cardsOf(a);
      if (cids.length > 1) {
        const ct = cardTextsOf(a);
        const empty = cids.map((id, i) => (ct[String(id)]?.headline?.trim() ? 0 : i + 1)).filter(Boolean);
        if (empty.length) out.push({ level: "warn", text: `Картки без заголовка: ${empty.join(", ")}`, where: an });
        const long = cids.map((id, i) => ((ct[String(id)]?.headline ?? "").length > CARD_LIMITS.headline ? i + 1 : 0)).filter(Boolean);
        if (long.length) out.push({ level: "warn", text: `Заголовок картки довший за ${CARD_LIMITS.headline}: ${long.join(", ")}`, where: an });
      }
      if (a.primary_text.length > LIMITS.primary * 3) out.push({ level: "tip", text: `Основний текст ${a.primary_text.length} симв. — довгий; головне має бути в перших ${LIMITS.primary}`, where: an });
      if (a.headline.length > LIMITS.headline) out.push({ level: "warn", text: `Заголовок ${a.headline.length} > ${LIMITS.headline} симв. — обріжеться`, where: an });
      if (a.description.length > LIMITS.description) out.push({ level: "warn", text: `Опис ${a.description.length} > ${LIMITS.description} симв. — обріжеться`, where: an });
      if ((s.conversion === "site" || a.url) && a.url && !/utm_/.test(a.url + a.utm)) out.push({ level: "tip", text: "Посилання без UTM — у CRM/аналітиці не буде видно, з якого оголошення лід", where: an });
    }
  }
  return out;
}

// ---------- текст для копіювання
export const adUrl = (a: Ad, s?: AdSet) => {
  const u = (a.url || s?.url || "").trim();
  if (!u) return "";
  return a.utm.trim() ? `${u}${u.includes("?") ? "&" : "?"}${a.utm.trim().replace(/^[?&]/, "")}` : u;
};
export const defaultUtm = (c: Campaign, a: Ad) =>
  `utm_source=facebook&utm_medium=paid&utm_campaign=${encodeURIComponent(c.name.toLowerCase().replace(/\s+/g, "_").slice(0, 40))}&utm_content=${adCode(a).toLowerCase()}`;

export function adsetTargeting(s: AdSet): string {
  return [
    `Локації: ${s.locations || "—"}`, `Вік: ${s.age_min}–${s.age_max === 65 ? "65+" : s.age_max}`, `Стать: ${lbl(GENDERS, s.gender)}`,
    s.languages && `Мови: ${s.languages}`, lines(s.interests).length ? `Детальний таргетинг: ${lines(s.interests).join(", ")}` : "",
    lines(s.exclusions).length ? `Виключити: ${lines(s.exclusions).join(", ")}` : "", s.audiences && `Власні аудиторії: ${s.audiences}`,
    `Advantage+ аудиторія: ${s.advantage ? "так" : "ні"}`, `Плейсменти: ${s.placements === "advantage" ? "Advantage+ (автоматично)" : s.placements}`,
  ].filter(Boolean).join("\n");
}

export function campaignMd(c: Campaign): string {
  const sets = listAdsets(c.id);
  const out = [
    `# ${c.name}`,
    `Ціль: ${lbl(OBJECTIVES, c.objective)} · Бюджет: ${c.budget == null ? "—" : `${money2(c.budget)} ${c.budget_type === "daily" ? "на день" : "на весь час"}`} (${c.budget_level === "campaign" ? "на кампанію, Advantage+" : "на групи"})`,
    c.start_date && `Старт: ${c.start_date}${c.end_date ? ` → ${c.end_date}` : ""}`, c.target_cpl != null && `Ціль ціни ліда: ${money2(c.target_cpl)}`,
    c.special_category && `Спецкатегорія: ${c.special_category}`, c.idea && `Ідея: ${c.idea}`,
    ...Object.entries(planOf(c)).filter(([, v]) => v).map(([k, v]) => `${PLAN_FIELDS[k as keyof typeof PLAN_FIELDS]?.label ?? k}: ${v}`),
  ].filter(Boolean) as string[];
  for (const s of sets) {
    out.push("", `## Група: ${s.name}`, `Куди: ${lbl(CONVERSIONS, s.conversion)}${s.url ? ` — ${s.url}` : ""}${s.budget != null ? ` · бюджет ${money2(s.budget)}` : ""}`, adsetTargeting(s));
    if (s.form) out.push(`Лід-форма:\n${s.form}`);
    for (const a of listAds(s.id)) {
      out.push("", `### ${a.name}`, a.angle ? `Кут: ${a.angle}` : "", `Креатив: ${lbl(AD_FORMATS, a.format)}${a.tool ? ` · ${a.tool}` : ""}`, a.overlay ? `Текст на креативі:\n${a.overlay}` : "", a.creative_prompt ? `Промпт креативу:\n${a.creative_prompt}` : "", `Основний текст:\n${a.primary_text || "—"}`, `Заголовок: ${a.headline || "—"}`, a.description ? `Опис: ${a.description}` : "",
        `Кнопка: ${lbl(CTAS, a.cta)}`, adUrl(a, s) ? `Посилання: ${adUrl(a, s)}` : "");
      const cids = cardsOf(a), ct = cardTextsOf(a);
      if (cids.length > 1) out.push(`Картки каруселі:\n${cids.map((id, i) => { const t = ct[String(id)] ?? {}; return `${i + 1}. ${t.headline || "—"}${t.description ? ` · ${t.description}` : ""}${t.url ? ` · ${t.url}` : ""}`; }).join("\n")}`);
      const v = variantsOf(a);
      if ((v.primary?.length ?? 0) > 1) out.push(`Варіанти тексту:\n${v.primary!.map((x, i) => `${i + 1}. ${x}`).join("\n")}`);
      if ((v.headline?.length ?? 0) > 1) out.push(`Варіанти заголовка: ${v.headline!.join(" | ")}`);
    }
  }
  return out.filter(Boolean).join("\n");
}

// Коротко для Джері / знімка клієнта
export function campaignsSnapshot(clientId: number): string {
  const cs = listCampaigns(clientId).slice(0, 6);
  if (!cs.length) return "";
  const ls = clientLessons(clientId, 10);
  return [
    "КАМПАНІЇ (конструктор):",
    ...cs.map((c) => { const l = campaignLive(c); const g = planOf(c).goal; return `- #${c.id} ${c.name}${g ? ` (ціль: ${g.slice(0, 120)})` : ""} · ${c.status} · ${lbl(OBJECTIVES, c.objective)} · груп ${c.adsets}, оголошень ${c.ads}${c.budget != null ? ` · бюджет ${money2(c.budget)}/${c.budget_type === "daily" ? "день" : "весь час"}` : ""}${l ? ` · 30 дн.: ${money2(l.spend)} витрачено, ${l.leads} лідів, ціна ${money2(l.cpl)}` : ""}`; }),
    ...(ls.length ? ["Уроки й оцінки:", ...ls.map((n) => `- [${n.kind}] ${n.text} (${n.campaign}, ${n.created_at.slice(0, 10)})`)] : []),
  ].join("\n");
}

// ---------- генерація Джері
async function imageOf(buf: Buffer | null, mime: string): Promise<Anthropic.ImageBlockParam | null> {
  if (!buf || buf.length > 4.5 * 1024 * 1024 || !/^image\//.test(mime)) return null;
  const mt = /png/.test(mime) ? "image/png" : /webp/.test(mime) ? "image/webp" : /gif/.test(mime) ? "image/gif" : "image/jpeg";
  return { type: "image", source: { type: "base64", media_type: mt, data: buf.toString("base64") } };
}
// Картинки креативу для Джері: одна або до 5 карток каруселі
async function mediaBlocks(a: Ad): Promise<Anthropic.ImageBlockParam[]> {
  const out: Anthropic.ImageBlockParam[] = [];
  try {
    for (const id of cardsOf(a).slice(0, 5)) { const f = getFile(id); const b = f ? await imageOf(readFile(f), f.mime) : null; if (b) out.push(b); }
    if (!out.length && /^https?:\/\//.test(a.media_url)) {
      const r = await fetch(a.media_url, { signal: AbortSignal.timeout(10_000) });
      const b = r.ok ? await imageOf(Buffer.from(await r.arrayBuffer()), r.headers.get("content-type") ?? "") : null;
      if (b) out.push(b);
    }
  } catch { /* без картинки */ }
  return out;
}

async function contextFor(clientId: number): Promise<string> {
  const { clientSnapshot } = await import("./agent/context");
  const ls = clientLessons(clientId, 20), gl = globalLessons(clientId, 8);
  const best = adTotalsForClient(clientId).filter((x) => x.leads > 0).sort((x, y) => x.spend / x.leads - y.spend / y.leads).slice(0, 5);
  const bodies = adsForClient(clientId);
  return [
    clientSnapshot(clientId).slice(0, 14000),
    best.length ? `НАЙДЕШЕВШІ ОГОЛОШЕННЯ ЗА ВЕСЬ ЧАС:\n${best.map((b) => `- ${b.ad_name}: ${money2(b.spend / b.leads)} за лід (${b.leads} лідів)${(() => { const m = bodies.find((x) => x.ad_id === b.ad_id); return m?.body ? `\n  текст: ${m.body.slice(0, 300)}` : ""; })()}`).join("\n")}` : "",
    ls.length ? `УРОКИ Й ОЦІНКИ ЦЬОГО КЛІЄНТА (враховуй обовʼязково):\n${ls.map((n) => `- [${n.kind}] ${n.text}`).join("\n")}` : "",
    gl.length ? `УРОКИ З ІНШИХ КЛІЄНТІВ:\n${gl.map((n) => `- ${n.text}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

const RULES = `Пиши українською (якщо в контексті не сказано іншу мову реклами). Правила Meta: основний текст — головне в перших ${LIMITS.primary} символах (далі ховається за «Ще»), заголовок до ${LIMITS.headline}, опис до ${LIMITS.description} символів. Без обіцянок, які порушують правила Meta (гарантії результату, звертання до особистих ознак «ти маєш борги?», «ти хворий?»). Конкретика, цифри, вигода, заклик. Емодзі — помірно. Дотримуйся брендбуку і правил клієнта з контексту.`;

export async function genAdCopy(adId: number, wish = ""): Promise<Variants> {
  const a = getAd(adId); if (!a) throw new Error("Нема оголошення");
  const s = getAdset(a.adset_id)!, c = getCampaign(s.campaign_id)!;
  const imgs = await mediaBlocks(a);
  const img = imgs[0];
  const user = [
    await contextFor(c.client_id),
    `КАМПАНІЯ: ${c.name} · ціль ${lbl(OBJECTIVES, c.objective)}${c.idea ? ` · ідея: ${c.idea}` : ""}`,
    `ГРУПА: ${s.name} · куди: ${lbl(CONVERSIONS, s.conversion)}\n${adsetTargeting(s)}`,
    `ОГОЛОШЕННЯ ${adCode(a)}: кут — ${a.angle || "обери сам"}; формат — ${lbl(AD_FORMATS, a.format)}${a.overlay ? `\nТекст на креативі: ${a.overlay}` : ""}${a.primary_text ? `\nПоточний текст: ${a.primary_text}` : ""}`,
    imgs.length > 1 ? `Креатив — карусель з ${imgs.length} карток (картинки нижче по порядку). Подивись кожну; основний текст — про всю історію каруселі, заголовки — такі, що пасують до карток.` : img ? "Креатив — на картинці нижче. Спершу подивись, що на ній (сцена, текст, емоція), і пиши тексти, що доповнюють її, а не повторюють текст з картинки." : isMotion(a.format) ? `Креатив — відео/моушен (його не видно), спирайся на бриф: ${a.creative_prompt.slice(0, 800)}` : a.creative_prompt ? `Креатив ще не завантажено, спирайся на бриф: ${a.creative_prompt.slice(0, 800)}` : "",
    wish && `Побажання Саші: ${wish}`,
    `Поверни ТІЛЬКИ JSON: {${imgs.length > 1 ? `"cards":[для КОЖНОЇ з ${imgs.length} карток по порядку: {"headline":"≤${CARD_LIMITS.headline}","description":"≤${CARD_LIMITS.description}"}],` : ""}"primary":[3 різні основні тексти],"headline":[5 заголовків ≤${LIMITS.headline}],"description":[3 описи ≤${LIMITS.description}],"cta":"одна з ${Object.keys(CTAS).join("|")}","tips":[1-3 коротких поради до цього оголошення]}`,
  ].filter(Boolean).join("\n\n");
  const content: Anthropic.ContentBlockParam[] = [...imgs, { type: "text", text: user }];
  const raw = await askJson<Record<string, unknown>>(`Ти — Джері, сильний копірайтер реклами Meta для малого бізнесу в Україні. ${RULES}`, content, { maxTokens: 6000, effort: "medium" });
  const arr = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []).map(asText).map((x) => x.trim()).filter(Boolean);
  const v: Variants = { primary: arr(raw.primary).slice(0, 5), headline: arr(raw.headline).slice(0, 5), description: arr(raw.description).slice(0, 5), tips: arr(raw.tips).slice(0, 3) };
  const cta = asText(raw.cta).trim().toUpperCase();
  const ids = cardsOf(a);
  if (ids.length > 1 && Array.isArray(raw.cards)) {
    const all = cardTextsOf(a);
    (raw.cards as unknown[]).slice(0, ids.length).forEach((rc, i) => {
      const r = (rc && typeof rc === "object" ? rc : {}) as Record<string, unknown>;
      const k = String(ids[i]); const cur = all[k] ?? {};
      all[k] = { ...cur, headline: cur.headline || asText(r.headline).trim(), description: cur.description || asText(r.description).trim() };
    });
    updateAd(a.id, { cards_json: JSON.stringify(all) });
  }
  updateAd(a.id, {
    variants_json: JSON.stringify(v),
    primary_text: a.primary_text || v.primary?.[0] || "", headline: a.headline || v.headline?.[0] || "", description: a.description || v.description?.[0] || "",
    ...(cta in CTAS && a.cta === "LEARN_MORE" ? { cta } : {}),
  });
  return v;
}

export async function genTargeting(adsetId: number, wish = ""): Promise<string> {
  const s = getAdset(adsetId); if (!s) throw new Error("Нема групи");
  const c = getCampaign(s.campaign_id)!;
  const raw = await askJson<Record<string, unknown>>(
    `Ти — Джері, таргетолог Meta. Пропонуй реалістичний таргетинг для малого бізнесу в Україні з урахуванням Advantage+ (широкі аудиторії часто кращі за вузькі інтереси). ${RULES}`,
    [await contextFor(c.client_id), `КАМПАНІЯ: ${c.name} · ${lbl(OBJECTIVES, c.objective)}${c.idea ? ` · ${c.idea}` : ""}`, `ГРУПА ЗАРАЗ:\n${adsetTargeting(s)}`, wish && `Побажання Саші: ${wish}`,
      `Поверни ТІЛЬКИ JSON: {"locations":"міста/радіус","age_min":число,"age_max":число,"gender":"all|male|female","languages":"","interests":["інтерес як у Meta"],"exclusions":["кого виключити"],"advantage":true,"why":"1-2 речення чому так"}`].filter(Boolean).join("\n\n"),
    { maxTokens: 3000, effort: "medium" });
  const arr = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []).map(asText).filter(Boolean);
  const num = (v: unknown, d: number) => { const n = Number(v); return Number.isFinite(n) && n >= 13 && n <= 65 ? Math.round(n) : d; };
  const g = asText(raw.gender);
  updateAdset(s.id, {
    locations: asText(raw.locations) || s.locations, age_min: num(raw.age_min, s.age_min), age_max: num(raw.age_max, s.age_max),
    gender: g in GENDERS ? g : s.gender, languages: asText(raw.languages) || s.languages,
    interests: arr(raw.interests).join("\n") || s.interests, exclusions: arr(raw.exclusions).join("\n") || s.exclusions, advantage: raw.advantage === false ? 0 : 1,
  });
  return asText(raw.why);
}

// Що Джері знає про створення креативів: інструменти Саші + його шаблони стилю для формату
const STYLE_KIND: Record<string, string> = { feed: "feed", square: "square", story: "story", motion: "motion", video: "video", carousel: "carousel", wide: "square" };
function creativeKnowhow(format?: string): string {
  const st = stylesFor(format ? STYLE_KIND[format] : undefined).slice(0, 6);
  return [
    "Саша робить креативи ТІЛЬКИ в Claude (без Midjourney, Higgsfield, CapCut та інших) — промпт = завдання для Claude українською.",
    "Як Claude робить кожен формат: статика 4:5 / 1:1 / 9:16 / 16:9 — одна HTML/CSS-сторінка рівно під розмір (1080×1350, 1080×1080, 1080×1920, 1920×1080), щоб зберегти PNG; карусель — 3–5 таких сторінок 1080×1080 (перша — хук, остання — CTA); моушен — HTML/CSS/SVG-анімація 1080×1920 на 6–10 с з таймлайном по секундах. Реальне відео Claude не знімає — формат «Відео» не пропонуй.",
    "Фото Claude не генерує: якщо потрібна людина чи обʼєкт — напиши, яке СПРАВЖНЄ фото/рендер клієнта взяти (з брендбуку чи папки клієнта) і як Claude робить дизайн поверх; інакше — графічний креатив (типографіка, іконки, інфографіка, кольори бренду).",
    "Текст НА креативі (overlay) — коротко: заголовок до 6–7 слів + 1 рядок підзаголовка/ціни/заклику. Для 9:16 — без тексту у верхніх 250 і нижніх 340 px (безпечні зони).",
    st.length ? `Шаблони стилю Саші (дотримуйся):\n${st.map((x) => `- ${x.title}: ${x.body.replace(/\s+/g, " ").slice(0, 600)}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}
const FORMAT_KEYS = Object.keys(AD_FORMATS);
const briefShape = `{"angle":"кут одним реченням","format":"${FORMAT_KEYS.filter((f) => f !== "video").join("|")}","overlay":"текст на креативі: заголовок\\nпідзаголовок/ціна (порожньо, якщо без тексту)","prompt":"готове завдання для Claude українською: розмір у px, композиція, яке фото клієнта взяти (якщо треба), шрифти й кольори бренду, де текст, CTA; для моушену — таймлайн по секундах"}`;
function applyBrief(r: Record<string, unknown>) {
  const f = asText(r.format);
  return { angle: asText(r.angle), format: f in AD_FORMATS && f !== "video" ? f : "feed", tool: "Claude", overlay: asText(r.overlay), creative_prompt: asText(r.prompt) };
}

// Зібрати чернетку всієї кампанії з ідеї: групи з таргетингом + по 4 креативи-брифи (формат, інструмент, текст на креативі, промпт).
// Тексти оголошення НЕ пишемо — вони пишуться потім, під готовий креатив.
export async function genCampaignDraft(campaignId: number): Promise<{ adsets: number; ads: number }> {
  const c = getCampaign(campaignId); if (!c) throw new Error("Нема кампанії");
  const raw = await askJson<{ adsets?: unknown[] }>(
    `Ти — Джері, медіабаєр і креативний директор Meta-реклами. Збираєш структуру кампанії для ручного запуску в Ads Manager: мало груп (1–2, рідко 3), у кожній РІВНО 4 креативи з РІЗНИМИ кутами (не варіації одного) і різними форматами (обовʼязково хоча б один 9:16 — статика або моушен; плюс 4:5). На цьому етапі тексти оголошення НЕ пишеш — тільки бриф і промпт креативу. ${RULES}`,
    [await contextFor(c.client_id), creativeKnowhow(),
      `КАМПАНІЯ: ${c.name} · ціль ${lbl(OBJECTIVES, c.objective)} · бюджет ${money2(c.budget)} ${c.budget_type === "daily" ? "на день" : "на весь час"}${c.target_cpl != null ? ` · ціль ціни ліда ${money2(c.target_cpl)}` : ""}`,
      `Ідея / що рекламуємо: ${c.idea || "визнач з контексту клієнта"}`,
      `${FORM_RULES}\nПоверни ТІЛЬКИ JSON: {"plan":${planShape},"adsets":[{"name":"","conversion":"form|site|messenger|call","lead_form":${formShape} (тільки якщо form),"locations":"","age_min":25,"age_max":55,"gender":"all","interests":[""],"exclusions":[""],"advantage":true,"creatives":[${briefShape}]}]}`].join("\n\n"),
    { maxTokens: 16000, effort: "medium" });
  if ((raw as Record<string, unknown>).plan) savePlan(c, (raw as Record<string, unknown>).plan);
  let ns = 0, na = 0;
  for (const rs of (Array.isArray(raw.adsets) ? raw.adsets : []).slice(0, 3) as Record<string, unknown>[]) {
    const arr = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []).map(asText).filter(Boolean);
    const conv = asText(rs.conversion), g = asText(rs.gender);
    const age = (v: unknown, d: number) => { const n = Number(v); return Number.isFinite(n) && n >= 13 && n <= 65 ? Math.round(n) : d; };
    const sid = addAdset(c.id, {
      name: asText(rs.name) || undefined, conversion: conv in CONVERSIONS ? conv : "form", form: asText(rs.form), locations: asText(rs.locations),
      age_min: age(rs.age_min, 18), age_max: age(rs.age_max, 65), gender: g in GENDERS ? g : "all", interests: arr(rs.interests).join("\n"), exclusions: arr(rs.exclusions).join("\n"), advantage: rs.advantage === false ? 0 : 1,
    });
    ns++;
    const lf = rs.lead_form && typeof rs.lead_form === "object" ? addForm(c.client_id, formFromRaw(rs.lead_form as Record<string, unknown>)) : null;
    const cr = (Array.isArray(rs.creatives) ? rs.creatives : Array.isArray(rs.ads) ? rs.ads : []) as Record<string, unknown>[];
    for (const ra of cr.slice(0, 6)) { addAd(sid, { ...applyBrief(ra), form_id: lf }); na++; }
  }
  if (!ns) throw new Error("Джері не повернув структуру — спробуй ще раз або додай ідею");
  return { adsets: ns, ads: na };
}

// ---------- задум кампанії (думка Джері)
const planShape = `{${Object.entries(PLAN_FIELDS).map(([k, v]) => `"${k}":"${v.label} — ${v.hint}; 2–4 речення, конкретно, з цифрами з контексту"`).join(",")}}`;
function savePlan(c: Campaign, raw: unknown) {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const cur = planOf(c);
  const next: Record<string, string> = { ...cur } as Record<string, string>;
  for (const k of Object.keys(PLAN_FIELDS)) { const v = asText(r[k]).trim(); if (v) next[k] = v; }
  updateCampaign(c.id, { plan_json: JSON.stringify(next) });
}
export async function genCampaignPlan(campaignId: number, wish = ""): Promise<void> {
  const c = getCampaign(campaignId); if (!c) throw new Error("Нема кампанії");
  const sets = listAdsets(c.id);
  const raw = await askJson<Record<string, unknown>>(
    `Ти — Джері, стратег реклами для малого бізнесу. Даєш чесну загальну картину кампанії: ціль, чому людям цікаво, навіщо нам, потенціал, ризики, як міряти. Без води і без підлизування — якщо ідея слабка, скажи. ${RULES}`,
    [await contextFor(c.client_id), campaignMd(c).slice(0, 6000), sets.length ? "" : "Груп ще нема.", wish && `Побажання Саші: ${wish}`, `Поверни ТІЛЬКИ JSON: ${planShape}`].filter(Boolean).join("\n\n"),
    { maxTokens: 5000, effort: "medium" });
  savePlan(c, raw);
}

// Бриф і промпт для одного креативу (новий або перегенерувати з побажанням)
export async function genCreativeBrief(adId: number, wish = ""): Promise<void> {
  const a = getAd(adId); if (!a) throw new Error("Нема оголошення");
  const s = getAdset(a.adset_id)!, c = getCampaign(s.campaign_id)!;
  const others = listAds(s.id).filter((x) => x.id !== a.id).map((x) => `- ${lbl(AD_FORMATS, x.format)}: ${x.angle}`).join("\n");
  const raw = await askJson<Record<string, unknown>>(
    `Ти — Джері, креативний директор Meta-реклами. Пишеш бриф і готовий промпт для ОДНОГО креативу. Тексти оголошення не пишеш. ${RULES}`,
    [await contextFor(c.client_id), creativeKnowhow(a.format),
      `КАМПАНІЯ: ${c.name} · ${lbl(OBJECTIVES, c.objective)}${c.idea ? ` · ${c.idea}` : ""}`, `ГРУПА: ${s.name}\n${adsetTargeting(s)}`,
      others && `Інші креативи в групі (не повторюй кут):\n${others}`,
      `ЦЕЙ КРЕАТИВ ЗАРАЗ: формат ${lbl(AD_FORMATS, a.format)}${a.angle ? `, кут: ${a.angle}` : ""}${a.creative_prompt ? `\nПопередній промпт: ${a.creative_prompt.slice(0, 1500)}` : ""}`,
      wish ? `Побажання Саші: ${wish}` : "Збережи формат, якщо Саша не просить інший.",
      `Поверни ТІЛЬКИ JSON: ${briefShape}`].filter(Boolean).join("\n\n"),
    { maxTokens: 4000, effort: "medium" });
  updateAd(a.id, applyBrief(raw));
}

// ---------- папка кампанії на Google Диску: Клієнт → Креативи → «дата · назва кампанії»
const FMT_TAG: Record<string, string> = { feed: "4x5", square: "1x1", story: "9x16", motion: "9x16-motion", video: "9x16-video", carousel: "1x1-carousel", wide: "16x9" };
export const campaignFolderName = (c: Campaign) => c.drive_folder_name || `${c.created_at.slice(0, 10)} · ${c.name.replace(/[\\/:*?"<>|]+/g, " ").trim()}`.slice(0, 120);
export const fileNameFor = (a: Ad) => `${adCode(a)}_${FMT_TAG[a.format] ?? a.format}_v1.${isMotion(a.format) ? "mp4" : "png"}`;

export async function ensureCampaignFolder(c: Campaign): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { googleConnected, folderUrl } = await import("./google");
  if (c.drive_folder_id) return { ok: true, url: folderUrl(c.drive_folder_id) };
  if (!googleConnected()) return { ok: false, error: "Google не підключено (Налаштування → Конектори → Google)" };
  try {
    const { targetFolder } = await import("./driveSave");
    const name = campaignFolderName(c);
    const f = await targetFolder(c.client_id, "creatives", name);
    updateCampaign(c.id, { drive_folder_id: f.id, drive_folder_name: name });
    return { ok: true, url: f.url };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

// Блок «куди зберегти» — дописується до кожного промпту креативу і до промпту для Claude-чату
export function saveBlock(c: Campaign, clientName: string, ads?: Ad[]): string {
  const url = c.drive_folder_id ? `https://drive.google.com/drive/folders/${c.drive_folder_id}` : "";
  const path = `Google Диск → Client Ops — клієнти → ${clientName.replace(/^Тест:\s*/, "")} → Креативи → ${campaignFolderName(c)}`;
  return [
    "ЗБЕРЕЖЕННЯ ФАЙЛІВ (порядок важливий):",
    `- Папка: ${path}${url ? `\n  Посилання: ${url}` : " (якщо її ще нема — створи саме з такою назвою)"}`,
    `- Назви файлів: код оголошення + формат + версія${ads?.length ? `, напр.: ${ads.slice(0, 4).map(fileNameFor).join(", ")}` : ", напр. AD-12_4x5_v1.png"}. Нова версія — v2, v3, старі не видаляй.`,
    "- Наприкінці, коли креативи готові, САМ спитай мене: «Завантажити всі фінальні файли в папку … ?» — після мого «так» збережи їх туди (створи папку, якщо нема). В інші місця нічого не клади.",
  ].join("\n");
}
export function adPromptFull(c: Campaign, a: Ad, clientName: string): string {
  if (!a.creative_prompt.trim()) return "";
  return [
    `КРЕАТИВ ${adCode(a)} · ${lbl(AD_FORMATS, a.format)}${a.tool ? ` · ${a.tool}` : ""}`,
    a.angle && `Кут: ${a.angle}`,
    a.overlay && `Текст на креативі:\n${a.overlay}`,
    `Промпт:\n${a.creative_prompt}`,
    "", saveBlock(c, clientName, [a]),
  ].filter(Boolean).join("\n");
}
// Усі креативи кампанії одним повідомленням у новий чат Claude (після «Контексту клієнта»)
export function campaignChatPrompt(c: Campaign, clientName: string): string {
  const ads = adsOfCampaign(c.id).filter((a) => a.creative_prompt.trim());
  return [
    `Робимо креативи для кампанії «${c.name}» (${lbl(OBJECTIVES, c.objective)}).${c.idea ? ` Ідея: ${c.idea}` : ""}`,
    "Йдемо по черзі: для кожного креативу — уточни, якщо треба, і дай мені готовий файл або готовий промпт для інструменту. Дотримуйся формату і безпечних зон.",
    "",
    ...ads.map((a) => [`### ${adCode(a)} · ${lbl(AD_FORMATS, a.format)}${a.tool ? ` · ${a.tool}` : ""}`, a.angle && `Кут: ${a.angle}`, a.overlay && `Текст на креативі:\n${a.overlay}`, `Промпт:\n${a.creative_prompt}`].filter(Boolean).join("\n") + "\n"),
    saveBlock(c, clientName, ads),
  ].join("\n");
}

// ---------- лід-форми
export function formMd(f: LeadForm): string {
  const qs = parseQuestions(f.questions);
  return [
    `Форма: ${f.name} (v${f.version})`, `Тип: ${lbl(FORM_TYPES, f.form_type)}`,
    `Вступ — заголовок: ${f.intro_headline || "—"}`, f.intro_text && `Вступ — опис:\n${f.intro_text}`,
    `Питання:\n${qs.map((q, i) => `${i + 1}. ${q.label}${q.kind === "prefill" ? " (стандартне поле Meta)" : q.kind === "choice" ? ` — варіанти: ${q.options.join(" / ")}` : " (коротка відповідь)"}`).join("\n") || "—"}`,
    `Політика конфіденційності: ${f.privacy_text || "—"}${f.privacy_url ? ` — ${f.privacy_url}` : ""}`,
    `Дякуємо — заголовок: ${f.thanks_headline || "—"}`, f.thanks_text && `Дякуємо — опис:\n${f.thanks_text}`,
    f.thanks_button && `Кнопка: ${f.thanks_button}${f.thanks_url ? ` → ${f.thanks_url}` : ""}`,
  ].filter(Boolean).join("\n");
}
// Результат версії: сума по оголошеннях, де вона стоїть (з Meta, 30 днів і за весь час)
export function formStats(f: LeadForm): { ads: number; live: number; spend: number; leads: number; cpl: number | null } {
  const ads = adsWithForm(f.id);
  const metaAds = adsForClient(f.client_id);
  let spend = 0, leads = 0, live = 0;
  for (const a of ads) { const l = adLive(a, metaAds); if (l) { live++; spend += l.allSpend; leads += l.allLeads; } }
  return { ads: ads.length, live, spend, leads, cpl: leads ? spend / leads : null };
}

const formShape = `{"name":"коротка назва форми","form_type":"volume|intent","intro_headline":"≤${FORM_LIMITS.intro_headline}","intro_text":"2–4 рядки: що людина отримає, без води","questions":["Імʼя","Телефон","? Питання з варіантами | варіант 1 | варіант 2 | варіант 3","? Коротке питання"],"privacy_text":"текст посилання на політику","thanks_headline":"≤${FORM_LIMITS.thanks_headline}","thanks_text":"що буде далі і коли передзвонимо","thanks_button":"≤${FORM_LIMITS.thanks_button}","thanks_url":"сайт клієнта або порожньо"}`;
function formFromRaw(r: Record<string, unknown>): Partial<LeadForm> {
  const qs = (Array.isArray(r.questions) ? r.questions : asText(r.questions).split("\n")).map(asText).map((x) => x.trim()).filter(Boolean);
  const t = asText(r.form_type);
  return {
    name: asText(r.name) || "Форма", form_type: t in FORM_TYPES ? t : "volume", intro_headline: asText(r.intro_headline), intro_text: asText(r.intro_text),
    questions: qs.join("\n"), privacy_text: asText(r.privacy_text) || "Політика конфіденційності", thanks_headline: asText(r.thanks_headline),
    thanks_text: asText(r.thanks_text), thanks_button: asText(r.thanks_button), thanks_url: asText(r.thanks_url),
  };
}
const FORM_RULES = `Лід-форма Meta (Instant Form): 3–5 питань максимум; спершу кваліфікаційні питання з варіантами (бюджет, терміни, що цікавить), потім імʼя і телефон (стандартні поля Meta — Facebook підставляє сам). «Більше заявок» — для дешевих лідів, «Вища якість» — коли важлива якість (додає екран перевірки). Питання — конкретні, без слова «будь ласка», варіанти — короткі. Екран «Дякуємо» — що буде далі і коли.`;

// Нова форма від Джері під оголошення / групу / кампанію; повертає id
export async function genForm(input: { clientId: number; campaignId?: number; adId?: number; wish?: string }): Promise<number> {
  const c = input.campaignId ? getCampaign(input.campaignId) : input.adId ? campaignOfAd(input.adId) : undefined;
  const a = input.adId ? getAd(input.adId) : undefined;
  const s = a ? getAdset(a.adset_id) : undefined;
  const past = listForms(input.clientId, true).slice(0, 8).map((f) => { const st = formStats(f); return `- «${f.name}» v${f.version}: ${parseQuestions(f.questions).map((q) => q.label).join("; ")}${st.leads ? ` → ${st.leads} лідів по ${money2(st.cpl)}` : ""}${f.changes ? ` (зміни: ${f.changes})` : ""}`; }).join("\n");
  const raw = await askJson<Record<string, unknown>>(
    `Ти — Джері, медіабаєр Meta. Складаєш лід-форму з готовими значеннями — Саша просто скопіює в конструктор. ${FORM_RULES} ${RULES}`,
    [await contextFor(input.clientId), c && `КАМПАНІЯ: ${c.name} · ${lbl(OBJECTIVES, c.objective)}${c.idea ? ` · ${c.idea}` : ""}`, s && `ГРУПА: ${s.name}\n${adsetTargeting(s)}`,
      a && `ОГОЛОШЕННЯ ${adCode(a)}: кут — ${a.angle}${a.overlay ? `; на креативі: ${a.overlay}` : ""}`,
      past && `ФОРМИ, ЯКІ ВЖЕ БУЛИ (враховуй, що спрацювало):\n${past}`, input.wish && `Побажання Саші: ${input.wish}`,
      `Поверни ТІЛЬКИ JSON: ${formShape}`].filter(Boolean).join("\n\n"),
    { maxTokens: 3000, effort: "medium" });
  const id = addForm(input.clientId, formFromRaw(raw));
  if (a) updateAd(a.id, { form_id: id });
  return id;
}
