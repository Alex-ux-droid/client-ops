// Meta Ads — тільки читання (Marketing API, без бібліотек). Токен системного користувача з Business Manager (ads_read).
// Цифри тягнемо самі за розкладом (вебхуків на витрати в Meta нема).
import { logError } from "./log";
import { autoLinkFromServices, kyivDay, saveSync, setSyncResult, upsertAccount, listAccounts, type MetaAd, type MetaCampaign } from "./repo/meta";
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
    if (e?.code === 10 || e?.code === 200) throw new Error(`Нема доступу: ${e.message}`);
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
  return list.length;
}

// Один кабінет: кампанії з бюджетами, цифри по днях за 30 днів, оголошення з креативами
export async function syncAccount(accountId: string): Promise<void> {
  const since = kyivDay(29), until = kyivDay(0);
  const range = JSON.stringify({ since, until });
  try {
    type C = { id: string; name: string; effective_status: string; objective?: string; daily_budget?: string; lifetime_budget?: string };
    const camps = await all<C>(`${accountId}/campaigns`, { fields: "id,name,effective_status,objective,daily_budget,lifetime_budget", limit: "200" });

    type I = { campaign_id?: string; ad_id?: string; date_start: string; spend?: string; impressions?: string; clicks?: string; actions?: Action[] };
    const daily = await all<I>(`${accountId}/insights`, {
      level: "campaign", fields: "campaign_id,spend,impressions,clicks,actions", time_range: range, time_increment: "1", limit: "500",
    });
    const adStats = await all<I>(`${accountId}/insights`, {
      level: "ad", fields: "ad_id,campaign_id,spend,impressions,clicks,actions", time_range: range, limit: "500",
    });

    // Креативи тільки для оголошень з витратами. Через ребро /ads з фільтром по id
    // (параметр ?ids= у v26 прибрали). Якщо не вийде — цифри все одно зберігаємо, просто без картинок.
    const spent = adStats.filter((x) => num(x.spend) > 0).sort((a, b) => num(b.spend) - num(a.spend)).slice(0, 60);
    type AdInfo = { id: string; name?: string; effective_status?: string; campaign_id?: string; creative?: { thumbnail_url?: string; body?: string; title?: string } };
    const info: Record<string, AdInfo> = {};
    const adIds = spent.map((x) => x.ad_id).filter(Boolean) as string[];
    try {
      for (let i = 0; i < adIds.length; i += 50) {
        const list = await all<AdInfo>(`${accountId}/ads`, {
          fields: "id,name,effective_status,campaign_id,creative{thumbnail_url,body,title}",
          filtering: JSON.stringify([{ field: "id", operator: "IN", value: adIds.slice(i, i + 50) }]),
          limit: "50",
        });
        for (const a of list) info[a.id] = a;
      }
    } catch (e) {
      logError(`meta-creatives ${accountId}`, e);
    }

    const campaigns: Omit<MetaCampaign, "account_id">[] = camps.map((c) => ({
      campaign_id: c.id, name: c.name, status: c.effective_status, objective: c.objective ?? "", daily_budget: budget(c.daily_budget), lifetime_budget: budget(c.lifetime_budget),
    }));
    const ads: Omit<MetaAd, "account_id">[] = spent.map((x) => {
      const a = info[x.ad_id ?? ""] ?? ({} as AdInfo);
      return {
        ad_id: x.ad_id ?? "", campaign_id: x.campaign_id ?? a.campaign_id ?? "", name: a.name ?? "", status: a.effective_status ?? "",
        thumbnail_url: a.creative?.thumbnail_url ?? "", body: [a.creative?.title, a.creative?.body].filter(Boolean).join(" — ").slice(0, 500),
        spend_30d: num(x.spend), impressions_30d: num(x.impressions), clicks_30d: num(x.clicks), leads_30d: leadsOf(x.actions),
      };
    });
    saveSync(accountId, {
      since, campaigns, ads,
      daily: daily.map((x) => ({ campaign_id: x.campaign_id ?? "", date: x.date_start, spend: num(x.spend), impressions: num(x.impressions), clicks: num(x.clicks), leads: leadsOf(x.actions) })),
    });
    setSyncResult(accountId, "");
  } catch (e) {
    setSyncResult(accountId, e instanceof Error ? e.message : "помилка");
    throw e;
  }
}

// Усі прив'язані до клієнтів кабінети. Помилка одного не зупиняє інші.
export async function syncAll(): Promise<{ ok: number; failed: number }> {
  if (!metaToken()) return { ok: 0, failed: 0 };
  await refreshAccounts().catch((e) => logError("meta-accounts", e));
  let ok = 0, failed = 0;
  for (const a of listAccounts().filter((x) => x.client_id)) {
    try { await syncAccount(a.account_id); ok++; } catch (e) { failed++; logError(`meta-sync ${a.name}`, e); }
  }
  setSetting("meta.last_sync", new Date().toISOString());
  return { ok, failed };
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
