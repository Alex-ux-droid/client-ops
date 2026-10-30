// Meta Ads — тільки читання (Marketing API, без бібліотек). Токен системного користувача з Business Manager (ads_read).
// Цифри тягнемо самі за розкладом (вебхуків на витрати в Meta нема).
import { logError } from "./log";
import { autoOn } from "./agent/caps";
import { autoLinkFromServices, getAnalysis, kyivDay, totals, saveSync, setSyncResult, upsertAccount, listAccounts, type Breakdown, type MetaAd, type MetaAdset, type MetaCampaign } from "./repo/meta";
import { getSetting, setSetting } from "./repo/settings";
import { enableService, getService } from "./repo/services";
import { linkAccount } from "./repo/meta";
import { setEnvVar } from "./secrets";

const VERSION = () => process.env.META_API_VERSION || "v26.0";
const BASE = () => process.env.META_API_BASE || "https://graph.facebook.com";
export const metaToken = () => process.env.META_ACCESS_TOKEN?.trim() || null;

type Paged<T> = { data?: T[]; paging?: { next?: string }; error?: { message: string; code?: number } };

async function get<T>(path: string, params: Record<string, string> = {}, tokenOverride?: string): Promise<T> {
  const token = tokenOverride ?? metaToken();
  if (!token) throw new Error("Meta не підключена");
  const url = path.startsWith("http") ? path : `${BASE()}/${VERSION()}/${path}?${new URLSearchParams({ ...params, access_token: token })}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const d = (await r.json().catch(() => ({}))) as T & { error?: { message: string; code?: number; error_subcode?: number } };
  if (!r.ok || d.error) {
    const e = d.error;
    // 190 — токен не працює; підкод каже чому (463 — закінчився строк, 460 — змінили пароль, 467 — сесію скинули)
    if (e?.code === 190) {
      const why = e.error_subcode === 463 ? "закінчився строк дії (схоже, вставили короткий токен, а не продовжений)"
        : e.error_subcode === 460 ? "змінено пароль Facebook"
        : e.error_subcode === 467 || e.error_subcode === 458 ? "сесію Facebook скинуто або доступ застосунку відкликано"
        : e.message;
      throw new Error(`Токен Meta не працює: ${why}. Онови токен у Налаштування → Конектори → Meta Ads`);
    }
    if (e?.code === 17 || e?.code === 80004 || e?.code === 4) throw new Error("Meta просить зачекати (ліміт запитів) — спробую пізніше");
    if (/API access blocked/i.test(e?.message ?? "")) {
      // пауза: не довбати Meta кожні 2 год, поки доступ заблокований (кнопка «Оновити зараз» пробує все одно)
      setSetting("meta.blocked_until", new Date(Date.now() + 6 * 3600_000).toISOString());
      throw new Error("Meta заблокувала доступ застосунку до API (не токен — сам застосунок). Відкрий developers.facebook.com → свій застосунок: чи нема плашок «Restricted» / «Required actions» / перевірки; і в Graph API Explorer з тим самим токеном спробуй запит me/adaccounts. Якщо там теж блок — треба вирішити в Meta (або новий застосунок і новий токен).");
    }
    if (e?.code === 10 || e?.code === 200) throw new Error(`Нема доступу: ${e.message} (код ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""})`);
    throw new Error(`Meta: ${e?.message ?? r.status}`);
  }
  return d;
}

// Усі сторінки результату (Meta віддає порціями)
async function all<T>(path: string, params: Record<string, string>, token?: string): Promise<T[]> {
  const out: T[] = [];
  let page = await get<Paged<T>>(path, params, token);
  for (let i = 0; i < 50; i++) {
    out.push(...(page.data ?? []));
    if (!page.paging?.next) break;
    page = await get<Paged<T>>(page.paging.next, {}, token);
  }
  return out;
}

type Action = { action_type: string; value: string };
// Ліди: «lead» (зведений), інакше сума ліда з форм і з пікселя
function leadsOf(actions?: Action[]): number {
  if (!actions?.length) return 0;
  const v = (t: string) => Number(actions.find((a) => a.action_type === t)?.value ?? 0);
  return v("lead") || v("onsite_conversion.lead_grouped") + v("offsite_conversion.fb_pixel_lead");
}
const num = (v: unknown) => Number(v ?? 0) || 0;
const budget = (v: unknown) => (v == null || v === "" ? null : Number(v) / 100); // Meta віддає бюджети в центах

// Спершу перевіряємо токен запитом, зберігаємо тільки робочий
export async function connectMeta(token: string): Promise<number> {
  const n = await refreshAccounts(token);
  setEnvVar("META_ACCESS_TOKEN", token);
  setSetting("meta.connected_at", new Date().toISOString());
  return n;
}

export function disconnectMeta(): void {
  setEnvVar("META_ACCESS_TOKEN", null);
}

export async function refreshAccounts(token?: string): Promise<number> {
  type A = { id: string; name: string; currency: string; account_status: number; disable_reason?: number; business_name?: string };
  const list = await all<A>("me/adaccounts", { fields: "id,name,currency,account_status,disable_reason,business_name", limit: "200" }, token);
  for (const a of list) {
    upsertAccount({ account_id: a.id, name: a.name ?? a.id, currency: a.currency ?? "", account_status: a.account_status ?? null, disable_reason: a.disable_reason ?? null, business_name: a.business_name ?? "" });
  }
  autoLinkFromServices();
  setSetting("meta.blocked_until", "");
  return list.length;
}

// ---------- Креативи в нормальній якості ----------
// thumbnail_url за замовчуванням 64×64 — тому: повні картинки за image_hash (ребро /adimages),
// обкладинки відео (video_data.image_url або thumbnails відео), усі картки каруселі, посилання на перегляд.
type Story = {
  link_data?: { image_hash?: string; picture?: string; name?: string; message?: string; child_attachments?: { image_hash?: string; picture?: string; name?: string }[] };
  video_data?: { image_url?: string; image_hash?: string; video_id?: string; title?: string; message?: string };
  photo_data?: { image_hash?: string; url?: string; caption?: string };
};
type Creative = {
  thumbnail_url?: string; image_url?: string; image_hash?: string; video_id?: string; title?: string; body?: string;
  object_story_spec?: Story; asset_feed_spec?: { images?: { hash?: string; url?: string }[]; videos?: { video_id?: string; thumbnail_url?: string }[]; bodies?: { text?: string }[]; titles?: { text?: string }[] };
};
type AdInfo = { id: string; name?: string; effective_status?: string; campaign_id?: string; preview_shareable_link?: string; creative?: Creative };
export type CreativeOut = Pick<MetaAd, "campaign_id" | "name" | "status" | "thumbnail_url" | "body" | "image_url" | "kind" | "video_id" | "images_json" | "preview_url">;
export const EMPTY_CREATIVE: CreativeOut = { campaign_id: "", name: "", status: "", thumbnail_url: "", body: "", image_url: "", kind: "", video_id: "", images_json: "[]", preview_url: "" };

const CREATIVE_FIELDS = "thumbnail_url,image_url,image_hash,video_id,title,body,object_story_spec,asset_feed_spec";

async function fetchAds(accountId: string, ids: string[], fields: string): Promise<AdInfo[]> {
  const out: AdInfo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    out.push(...(await all<AdInfo>(`${accountId}/ads`, {
      fields, filtering: JSON.stringify([{ field: "id", operator: "IN", value: ids.slice(i, i + 50) }]), limit: "50",
    })));
  }
  return out;
}

async function loadCreatives(accountId: string, adIds: string[]): Promise<Record<string, CreativeOut>> {
  if (!adIds.length) return {};
  let list: AdInfo[] = [];
  // Спершу з більшою мініатюрою (модифікатор поля), якщо Meta не прийме — звичайний запит
  for (const creative of [`creative.thumbnail_width(600).thumbnail_height(600){${CREATIVE_FIELDS}}`, `creative{${CREATIVE_FIELDS}}`, "creative{thumbnail_url,title,body}"]) {
    try {
      list = await fetchAds(accountId, adIds, `id,name,effective_status,campaign_id,${creative}`);
      break;
    } catch (e) {
      logError(`meta-creatives ${accountId}`, e);
    }
  }
  // Посилання на перегляд оголошення — окремо, щоб збій не зачепив картинки
  const preview: Record<string, string> = {};
  try {
    for (const a of await fetchAds(accountId, adIds, "id,preview_shareable_link")) if (a.preview_shareable_link) preview[a.id] = a.preview_shareable_link;
  } catch { /* не критично */ }

  // Хеші картинок → повні URL
  const hashesOf = (c?: Creative): string[] => {
    const st = c?.object_story_spec;
    return [c?.image_hash, st?.link_data?.image_hash, st?.video_data?.image_hash, st?.photo_data?.image_hash,
      ...(st?.link_data?.child_attachments ?? []).map((x) => x.image_hash), ...(c?.asset_feed_spec?.images ?? []).map((x) => x.hash)]
      .filter(Boolean) as string[];
  };
  const full: Record<string, string> = {};
  const hashes = [...new Set(list.flatMap((a) => hashesOf(a.creative)))];
  try {
    for (let i = 0; i < hashes.length; i += 50) {
      const imgs = await all<{ hash: string; url?: string; permalink_url?: string }>(`${accountId}/adimages`, { hashes: JSON.stringify(hashes.slice(i, i + 50)), fields: "hash,url,permalink_url", limit: "50" });
      for (const x of imgs) if (x.url || x.permalink_url) full[x.hash] = (x.url || x.permalink_url)!;
    }
  } catch (e) {
    logError(`meta-adimages ${accountId}`, e);
  }

  // Відео без обкладинки — беремо найбільший кадр-мініатюру самого відео
  const videoCover: Record<string, string> = {};
  const needVideo = [...new Set(list.map((a) => {
    const c = a.creative, v = c?.object_story_spec?.video_data;
    const vid = v?.video_id || c?.video_id || c?.asset_feed_spec?.videos?.[0]?.video_id;
    return vid && !v?.image_url && !(v?.image_hash && full[v.image_hash]) ? vid : null;
  }).filter(Boolean) as string[])].slice(0, 30);
  for (const vid of needVideo) {
    try {
      const v = await get<{ picture?: string; thumbnails?: { data?: { uri: string; width?: number; is_preferred?: boolean }[] } }>(vid, { fields: "picture,thumbnails{uri,width,is_preferred}" });
      const th = v.thumbnails?.data ?? [];
      const best = th.find((t) => t.is_preferred) ?? th.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
      if (best?.uri || v.picture) videoCover[vid] = best?.uri || v.picture!;
    } catch { /* немає доступу до відео — лишиться мініатюра */ }
  }

  const out: Record<string, CreativeOut> = {};
  for (const a of list) {
    const c = a.creative ?? {}, st = c.object_story_spec ?? {};
    const img = (hash?: string, fallback?: string) => (hash && full[hash]) || fallback || "";
    const cards = (st.link_data?.child_attachments ?? []).map((x) => img(x.image_hash, x.picture)).filter(Boolean);
    const feedImgs = (c.asset_feed_spec?.images ?? []).map((x) => img(x.hash, x.url)).filter(Boolean);
    const vid = st.video_data?.video_id || c.video_id || c.asset_feed_spec?.videos?.[0]?.video_id || "";
    const kind = cards.length > 1 ? "carousel" : vid ? "video" : "image";
    const main = kind === "carousel" ? cards[0]
      : kind === "video" ? img(st.video_data?.image_hash, st.video_data?.image_url) || videoCover[vid] || c.asset_feed_spec?.videos?.[0]?.thumbnail_url || ""
      : img(c.image_hash, c.image_url) || img(st.link_data?.image_hash, st.link_data?.picture) || img(st.photo_data?.image_hash, st.photo_data?.url) || feedImgs[0] || "";
    const title = c.title || st.link_data?.name || st.video_data?.title || c.asset_feed_spec?.titles?.[0]?.text;
    const body = c.body || st.link_data?.message || st.video_data?.message || st.photo_data?.caption || c.asset_feed_spec?.bodies?.[0]?.text;
    out[a.id] = {
      campaign_id: a.campaign_id ?? "", name: a.name ?? "", status: a.effective_status ?? "",
      thumbnail_url: c.thumbnail_url ?? "", body: [title, body].filter(Boolean).join(" — ").slice(0, 500),
      image_url: main || c.thumbnail_url || "", kind, video_id: vid,
      images_json: JSON.stringify(kind === "carousel" ? cards.slice(0, 10) : feedImgs.length > 1 ? feedImgs.slice(0, 10) : []),
      preview_url: preview[a.id] ?? "",
    };
  }
  return out;
}

// Один кабінет: кампанії з бюджетами, цифри по днях за 30 днів, оголошення з креативами
export async function syncAccount(accountId: string): Promise<void> {
  const since = kyivDay(29), until = kyivDay(0);
  const range = JSON.stringify({ since, until });
  try {
    type C = { id: string; name: string; effective_status: string; objective?: string; daily_budget?: string; lifetime_budget?: string };
    const camps = await all<C>(`${accountId}/campaigns`, { fields: "id,name,effective_status,objective,daily_budget,lifetime_budget", limit: "200" });

    type I = { campaign_id?: string; adset_id?: string; ad_id?: string; date_start: string; spend?: string; impressions?: string; clicks?: string; reach?: string; actions?: Action[] } & Record<string, string | Action[] | undefined>;
    const daily = await all<I>(`${accountId}/insights`, {
      level: "campaign", fields: "campaign_id,spend,impressions,clicks,actions", time_range: range, time_increment: "1", limit: "500",
    });
    const adStats = await all<I>(`${accountId}/insights`, {
      level: "ad", fields: "ad_id,adset_id,campaign_id,spend,impressions,clicks,reach,actions", time_range: range, limit: "500",
    });

    // Групи оголошень (аудиторії) з цифрами за 30 днів — не критично: збій не зупиняє синхронізацію
    let adsets: Omit<MetaAdset, "account_id">[] | undefined;
    try {
      type S = { id: string; name: string; campaign_id: string; effective_status: string; daily_budget?: string; lifetime_budget?: string; optimization_goal?: string };
      const list = await all<S>(`${accountId}/adsets`, { fields: "id,name,campaign_id,effective_status,daily_budget,lifetime_budget,optimization_goal", limit: "200" });
      const st = await all<I>(`${accountId}/insights`, { level: "adset", fields: "adset_id,spend,impressions,clicks,reach,actions", time_range: range, limit: "500" });
      const by = new Map(st.map((x) => [x.adset_id, x]));
      adsets = list.map((a) => {
        const x = by.get(a.id);
        return {
          adset_id: a.id, campaign_id: a.campaign_id, name: a.name, status: a.effective_status, daily_budget: budget(a.daily_budget), lifetime_budget: budget(a.lifetime_budget),
          optimization_goal: a.optimization_goal ?? "", spend_30d: num(x?.spend), impressions_30d: num(x?.impressions), clicks_30d: num(x?.clicks), leads_30d: leadsOf(x?.actions), reach_30d: num(x?.reach),
        };
      });
    } catch (e) {
      logError(`meta-adsets ${accountId}`, e);
    }

    // Загальні цифри за 30 днів (охоплення не можна скласти з днів) і розрізи: де показується, кому, звідки, з чого
    const breakdowns: Breakdown[] = [];
    const cuts: { kind: string; by: string; key: (x: I) => string }[] = [
      { kind: "total", by: "", key: () => "30d" },
      { kind: "placement", by: "publisher_platform,platform_position", key: (x) => `${x.publisher_platform ?? ""} · ${x.platform_position ?? ""}` },
      { kind: "age_gender", by: "age,gender", key: (x) => `${x.age ?? ""} · ${x.gender ?? ""}` },
      { kind: "region", by: "region", key: (x) => String(x.region ?? "") },
      { kind: "device", by: "impression_device", key: (x) => String(x.impression_device ?? "") },
    ];
    for (const c of cuts) {
      try {
        const rows = await all<I>(`${accountId}/insights`, { level: "account", fields: "spend,impressions,clicks,reach,actions", time_range: range, limit: "500", ...(c.by ? { breakdowns: c.by } : {}) });
        for (const x of rows) breakdowns.push({ kind: c.kind, key: c.key(x), spend: num(x.spend), impressions: num(x.impressions), clicks: num(x.clicks), leads: leadsOf(x.actions), reach: num(x.reach) });
      } catch (e) {
        logError(`meta-breakdown ${c.kind} ${accountId}`, e);
      }
    }

    // Креативи тільки для оголошень з витратами. Через ребро /ads з фільтром по id
    // (параметр ?ids= у v26 прибрали). Якщо не вийде — цифри все одно зберігаємо, просто без картинок.
    const spent = adStats.filter((x) => num(x.spend) > 0).sort((a, b) => num(b.spend) - num(a.spend)).slice(0, 60);
    const adIds = spent.map((x) => x.ad_id).filter(Boolean) as string[];
    const creatives = await loadCreatives(accountId, adIds);

    const campaigns: Omit<MetaCampaign, "account_id">[] = camps.map((c) => ({
      campaign_id: c.id, name: c.name, status: c.effective_status, objective: c.objective ?? "", daily_budget: budget(c.daily_budget), lifetime_budget: budget(c.lifetime_budget),
    }));
    const ads: Omit<MetaAd, "account_id">[] = spent.map((x) => {
      const a = creatives[x.ad_id ?? ""] ?? EMPTY_CREATIVE;
      return {
        ad_id: x.ad_id ?? "", ...a, campaign_id: x.campaign_id || a.campaign_id, adset_id: x.adset_id ?? "", reach_30d: num(x.reach),
        spend_30d: num(x.spend), impressions_30d: num(x.impressions), clicks_30d: num(x.clicks), leads_30d: leadsOf(x.actions),
      };
    });
    saveSync(accountId, {
      since, campaigns, ads, adsets, breakdowns,
      daily: daily.map((x) => ({ campaign_id: x.campaign_id ?? "", date: x.date_start, spend: num(x.spend), impressions: num(x.impressions), clicks: num(x.clicks), leads: leadsOf(x.actions) })),
    });
    setSyncResult(accountId, "");
  } catch (e) {
    setSyncResult(accountId, e instanceof Error ? e.message : "помилка");
    throw e;
  }
}

// Усі прив'язані до клієнтів кабінети. Помилка одного не зупиняє інші.
export const metaBlockedUntil = () => { const t = getSetting("meta.blocked_until"); return t && +new Date(t) > Date.now() ? t : null; };

export async function syncAll(opts: { manual?: boolean } = {}): Promise<{ ok: number; failed: number }> {
  if (!metaToken()) return { ok: 0, failed: 0 };
  if (!opts.manual && metaBlockedUntil()) return { ok: 0, failed: 0 };
  if (opts.manual) setSetting("meta.blocked_until", "");
  await refreshAccounts().catch((e) => logError("meta-accounts", e));
  let ok = 0, failed = 0;
  for (const a of listAccounts().filter((x) => x.client_id)) {
    try { await syncAccount(a.account_id); ok++; } catch (e) { failed++; logError(`meta-sync ${a.name}`, e); }
  }
  setSetting("meta.last_sync", new Date().toISOString());
  void weeklyAnalysis();
  return { ok, failed };
}

// Розбір від Джері сам раз на тиждень на клієнта (тільки де є витрати і ключ Anthropic) — у фоні, по черзі
const WEEK = 7 * 86400_000;
async function weeklyAnalysis(): Promise<void> {
  const g = globalThis as unknown as { __metaAnalyzing?: boolean };
  if (g.__metaAnalyzing || !autoOn("meta_analysis")) return;
  g.__metaAnalyzing = true;
  try {
    const { analyzeMeta } = await import("./metaAnalysis");
    const { getApiKey } = await import("./secrets");
    if (!getApiKey()) return;
    const clients = [...new Set(listAccounts().map((a) => a.client_id).filter(Boolean) as number[])];
    for (const cid of clients) {
      const last = getAnalysis(cid);
      if (last && Date.now() - +new Date(last.created_at.replace(" ", "T") + "Z") < WEEK) continue;
      if (!totals(cid, kyivDay(29), kyivDay(0)).spend) continue;
      try { await analyzeMeta(cid); } catch (e) { logError(`meta-analysis ${cid}`, e); }
    }
  } finally {
    g.__metaAnalyzing = false;
  }
}

export const lastSync = () => getSetting("meta.last_sync");

// Особистий токен (з Graph API Explorer, продовжений) живе ~60 днів; системного користувача — без терміну.
// Точного терміну без секрету застосунку не дізнатись, тому рахуємо від дня підключення.
export function tokenAgeDays(): number | null {
  const at = getSetting("meta.connected_at");
  return at ? Math.floor((Date.now() - +new Date(at)) / 86400_000) : null;
}

// Привʼязати кабінет до клієнта: вмикаємо йому послугу Meta Ads (там показуються цифри) і одразу тягнемо дані
export async function linkAndSync(accountId: string, clientId: number | null): Promise<string> {
  linkAccount(accountId, clientId);
  if (!clientId) return "";
  if (!getService(clientId, "meta_ads")) enableService(clientId, "meta_ads");
  try { await syncAccount(accountId); return ""; } catch (e) { return e instanceof Error ? e.message : "помилка"; }
}
