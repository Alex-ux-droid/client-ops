// Конструктор кампаній: ліміти Meta, перевірки (без ШІ), текст для копіювання, звʼязок з живими цифрами і генерація Джері.
import type Anthropic from "@anthropic-ai/sdk";
import { asText, askJson } from "./llmJson";
import {
  adCode, addAd, addAdset, adsOfCampaign, clientLessons, CONVERSIONS, CTAS, GENDERS, getAd, getAdset, getCampaign, globalLessons,
  listAdsets, listAds, listCampaigns, OBJECTIVES, updateAd, updateAdset, updateCampaign, variantsOf,
  type Ad, type AdSet, type Campaign, type Variants,
} from "./repo/campaigns";
import { getFile, readFile } from "./repo/files";
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
    if (s.conversion === "form" && !s.form.trim()) out.push({ level: "warn", text: "Не описана лід-форма (питання, привітання, дякуємо)", where: w });
    if (s.advantage && lines(s.interests).length) out.push({ level: "tip", text: "З Advantage+ аудиторією інтереси — лише підказка для Meta, не жорстке обмеження", where: w });
    if (!ads.length) out.push({ level: "bad", text: "Нема оголошень", where: w });
    else if (ads.length === 1) out.push({ level: "tip", text: "Одне оголошення — додай 2–4 різні концепти (різні кути, не варіації одного), так Meta швидше знайде переможця", where: w });
    else if (ads.length > 6) out.push({ level: "warn", text: `${ads.length} оголошень в одній групі — бюджет розмажеться, залиш 3–6`, where: w });
    if (ads.length > 1 && new Set(ads.map((a) => a.format)).size === 1) out.push({ level: "tip", text: "Усі оголошення одного формату — додай вертикальне 9:16 відео/фото для Reels і Stories", where: w });
    for (const a of ads) {
      const an = adCode(a);
      if (!a.file_id && !a.media_url) out.push({ level: "bad", text: "Нема креативу (фото/відео)", where: an });
      if (!a.primary_text.trim()) out.push({ level: "bad", text: "Нема основного тексту", where: an });
      if (!a.headline.trim()) out.push({ level: "warn", text: "Нема заголовка", where: an });
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
  ].filter(Boolean) as string[];
  for (const s of sets) {
    out.push("", `## Група: ${s.name}`, `Куди: ${lbl(CONVERSIONS, s.conversion)}${s.url ? ` — ${s.url}` : ""}${s.budget != null ? ` · бюджет ${money2(s.budget)}` : ""}`, adsetTargeting(s));
    if (s.form) out.push(`Лід-форма:\n${s.form}`);
    for (const a of listAds(s.id)) {
      out.push("", `### ${a.name}`, a.angle ? `Кут: ${a.angle}` : "", `Основний текст:\n${a.primary_text || "—"}`, `Заголовок: ${a.headline || "—"}`, a.description ? `Опис: ${a.description}` : "",
        `Кнопка: ${lbl(CTAS, a.cta)}`, adUrl(a, s) ? `Посилання: ${adUrl(a, s)}` : "");
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
    ...cs.map((c) => { const l = campaignLive(c); return `- #${c.id} ${c.name} · ${c.status} · ${lbl(OBJECTIVES, c.objective)} · груп ${c.adsets}, оголошень ${c.ads}${c.budget != null ? ` · бюджет ${money2(c.budget)}/${c.budget_type === "daily" ? "день" : "весь час"}` : ""}${l ? ` · 30 дн.: ${money2(l.spend)} витрачено, ${l.leads} лідів, ціна ${money2(l.cpl)}` : ""}`; }),
    ...(ls.length ? ["Уроки й оцінки:", ...ls.map((n) => `- [${n.kind}] ${n.text} (${n.campaign}, ${n.created_at.slice(0, 10)})`)] : []),
  ].join("\n");
}

// ---------- генерація Джері
async function mediaBlock(a: Ad): Promise<Anthropic.ImageBlockParam | null> {
  try {
    let buf: Buffer | null = null, mime = "";
    if (a.file_id) { const f = getFile(a.file_id); if (f && /^image\//.test(f.mime)) { buf = readFile(f); mime = f.mime; } }
    else if (/^https?:\/\//.test(a.media_url)) {
      const r = await fetch(a.media_url, { signal: AbortSignal.timeout(10_000) });
      mime = r.headers.get("content-type") ?? "";
      if (r.ok && /^image\//.test(mime)) buf = Buffer.from(await r.arrayBuffer());
    }
    if (!buf || buf.length > 4.5 * 1024 * 1024) return null;
    const mt = /png/.test(mime) ? "image/png" : /webp/.test(mime) ? "image/webp" : /gif/.test(mime) ? "image/gif" : "image/jpeg";
    return { type: "image", source: { type: "base64", media_type: mt, data: buf.toString("base64") } };
  } catch { return null; }
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
  const img = await mediaBlock(a);
  const user = [
    await contextFor(c.client_id),
    `КАМПАНІЯ: ${c.name} · ціль ${lbl(OBJECTIVES, c.objective)}${c.idea ? ` · ідея: ${c.idea}` : ""}`,
    `ГРУПА: ${s.name} · куди: ${lbl(CONVERSIONS, s.conversion)}\n${adsetTargeting(s)}`,
    `ОГОЛОШЕННЯ ${adCode(a)}: кут — ${a.angle || "обери сам"}; формат — ${a.format}${a.primary_text ? `\nПоточний текст: ${a.primary_text}` : ""}`,
    img ? "Креатив — на картинці нижче: тексти мають доповнювати її, а не повторювати." : a.format === "video" ? "Креатив — відео (його не видно), спирайся на кут." : "",
    wish && `Побажання Саші: ${wish}`,
    `Поверни ТІЛЬКИ JSON: {"primary":[3 різні основні тексти],"headline":[5 заголовків ≤${LIMITS.headline}],"description":[3 описи ≤${LIMITS.description}],"cta":"одна з ${Object.keys(CTAS).join("|")}","tips":[1-3 коротких поради до цього оголошення]}`,
  ].filter(Boolean).join("\n\n");
  const content: Anthropic.ContentBlockParam[] = img ? [img, { type: "text", text: user }] : [{ type: "text", text: user }];
  const raw = await askJson<Record<string, unknown>>(`Ти — Джері, сильний копірайтер реклами Meta для малого бізнесу в Україні. ${RULES}`, content, { maxTokens: 6000, effort: "medium" });
  const arr = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []).map(asText).map((x) => x.trim()).filter(Boolean);
  const v: Variants = { primary: arr(raw.primary).slice(0, 5), headline: arr(raw.headline).slice(0, 5), description: arr(raw.description).slice(0, 5), tips: arr(raw.tips).slice(0, 3) };
  const cta = asText(raw.cta).trim().toUpperCase();
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

// Зібрати чернетку всієї кампанії з ідеї: групи з таргетингом + 2–4 оголошення з кутами й текстами
export async function genCampaignDraft(campaignId: number): Promise<{ adsets: number; ads: number }> {
  const c = getCampaign(campaignId); if (!c) throw new Error("Нема кампанії");
  const raw = await askJson<{ adsets?: unknown[] }>(
    `Ти — Джері, медіабаєр Meta. Збираєш структуру кампанії для запуску вручну в Ads Manager. Мало груп (1–2, рідко 3), у кожній 2–4 РІЗНІ концепти (різні кути, не варіації). ${RULES}`,
    [await contextFor(c.client_id), `КАМПАНІЯ: ${c.name} · ціль ${lbl(OBJECTIVES, c.objective)} · бюджет ${money2(c.budget)} ${c.budget_type === "daily" ? "на день" : "на весь час"}${c.target_cpl != null ? ` · ціль ціни ліда ${money2(c.target_cpl)}` : ""}`,
      `Ідея / що рекламуємо: ${c.idea || "визнач з контексту клієнта"}`,
      `Поверни ТІЛЬКИ JSON: {"adsets":[{"name":"","conversion":"form|site|messenger|call","form":"питання лід-форми по рядку (якщо form)","locations":"","age_min":25,"age_max":55,"gender":"all","interests":[""],"exclusions":[""],"advantage":true,"ads":[{"angle":"кут одним реченням","format":"image|video|carousel","primary":"основний текст","headline":"≤${LIMITS.headline}","description":"≤${LIMITS.description}","cta":"${Object.keys(CTAS).join("|")}","creative":"що має бути на фото/відео — 1-2 речення"}]}]}`].join("\n\n"),
    { maxTokens: 12000, effort: "medium" });
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
    for (const ra of (Array.isArray(rs.ads) ? rs.ads : []).slice(0, 5) as Record<string, unknown>[]) {
      const f = asText(ra.format), cta = asText(ra.cta).toUpperCase();
      addAd(sid, {
        angle: asText(ra.angle), format: ["image", "video", "carousel"].includes(f) ? f : "image", primary_text: asText(ra.primary), headline: asText(ra.headline),
        description: asText(ra.description), cta: cta in CTAS ? cta : "LEARN_MORE", notes: asText(ra.creative) ? `Креатив: ${asText(ra.creative)}` : "",
      });
      na++;
    }
  }
  if (!ns) throw new Error("Джері не повернув структуру — спробуй ще раз або додай ідею");
  return { adsets: ns, ads: na };
}
