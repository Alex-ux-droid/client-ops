// CRM клієнта (Oselya CRM, docs/CLIENT_OPS.md у репо CRM): вебхук подій + запасне підтягування GET /leads + підсумки.
// Ключ API клієнта — .env CRM_KEY_<id>, секрет підпису вебхука — .env CRM_SECRET_<id>.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { autoOn } from "./agent/caps";
import { logError } from "./log";
import { addCrmEvent, crmLeads, getCrmLead, getCrmLink, listCrmLinks, patchCrmLink, upsertCrmLead, type CrmLead } from "./repo/crm";
import { getClientRow } from "./repo/clients";
import { setEnvVar } from "./secrets";

export const crmKey = (id: number) => process.env[`CRM_KEY_${id}`]?.trim() || "";
export const crmSecret = (id: number) => process.env[`CRM_SECRET_${id}`]?.trim() || "";
export const newCrmSecret = (id: number) => { const s = randomBytes(24).toString("hex"); setEnvVar(`CRM_SECRET_${id}`, s); return s; };
export const setCrmKey = (id: number, key: string | null) => setEnvVar(`CRM_KEY_${id}`, key);

export const STATUS_UA: Record<string, string> = { new: "новий", contacted: "в роботі", qualified: "кваліфікований", meeting: "показ / зустріч", won: "продано", paid: "оплачено", lost: "відмова", junk: "сміття", no_answer: "не додзвонились" };
export const SOURCE_UA: Record<string, string> = { meta_form: "форма Meta", site: "сайт", instagram_direct: "Instagram Direct", call: "дзвінок", messenger: "месенджер", referral: "рекомендація", repeat: "повторний", walk_in: "прийшов сам", other: "інше" };
export const REASON_UA: Record<string, string> = { expensive: "дорого", not_now: "не на зараз", no_answer: "не додзвонились", not_target: "не ціль", competitor: "обрали конкурента", other: "інше" };
const SOLD = new Set(["won", "paid"]);

type Raw = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const iso = (v: unknown) => { const t = s(v); return t && !Number.isNaN(Date.parse(t)) ? new Date(t).toISOString() : null; };

// Лід з CRM → рядок нашої бази. wonHint — момент продажу з події або з історії етапів
export function toLead(clientId: number, l: Raw, wonHint?: string | null): CrmLead | null {
  const crm_id = Number(l.crm_id);
  if (!crm_id) return null;
  const hist = Array.isArray(l.status_history) ? (l.status_history as Raw[]) : [];
  const status = s(l.status);
  const won = hist.find((h) => SOLD.has(s(h.to)))?.at ?? (SOLD.has(status) ? wonHint ?? l.updated_at : null);
  const mgr = l.manager as Raw | null;
  return {
    client_id: clientId, crm_id, contact_id: n(l.contact_id), meta_lead_id: s(l.meta_lead_id), meta_ad_id: s(l.meta_ad_id), meta_adset_id: s(l.meta_adset_id),
    meta_campaign_id: s(l.meta_campaign_id), ad_name: s(l.ad_name), campaign_name: s(l.campaign_name), source: s(l.external_source), name: s(l.name), phone: s(l.phone),
    status, status_raw: s(l.status_raw), deal_amount: n(l.deal_amount), paid_amount: n(l.paid_amount), cost_amount: n(l.cost_amount), currency: s(l.currency),
    won_at: iso(won), paid_at: iso(l.paid_at), lost_reason: s(l.lost_reason), lost_comment: s(l.lost_comment).slice(0, 500), manager: s(mgr?.name),
    first_contact_at: iso(l.first_contact_at), call_attempts: Number(l.call_attempts) || 0,
    created_at: iso(l.created_at) ?? new Date().toISOString(), updated_at: iso(l.updated_at) ?? new Date().toISOString(),
  };
}

const money = (v: number | null, cur: string) => (v == null ? "" : `${Math.round(v).toLocaleString("uk-UA")} ${cur}`);

// Вебхук: перевірка підпису по сирому тілу, дедуп за event_id, запис ліда
export async function crmWebhook(clientId: number, raw: string, h: Headers): Promise<{ status: number; body: Raw }> {
  const secret = crmSecret(clientId);
  if (!secret || !getCrmLink(clientId)) return { status: 404, body: { ok: false } };
  const ts = h.get("x-timestamp") ?? "", sig = h.get("x-signature") ?? "";
  const exp = "sha256=" + createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
  if (sig.length !== exp.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return { status: 401, body: { ok: false, error: "bad signature" } };
  // Повтори CRM ідуть до 12 год — тому вікно широке; від повторного програвання захищає event_id
  if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 48 * 3600) return { status: 401, body: { ok: false, error: "stale" } };
  let b: Raw;
  try { b = JSON.parse(raw) as Raw; } catch { return { status: 400, body: { ok: false, error: "bad json" } }; }
  const event = s(b.event), eventId = s(b.event_id) || s(h.get("x-event-id"));
  if (!eventId) return { status: 422, body: { ok: false, error: "no event_id" } };
  const lead = (b.lead ?? null) as Raw | null;
  const at = iso(b.occurred_at) ?? new Date().toISOString();
  const row = lead ? toLead(clientId, lead, event === "deal.won" || event === "deal.paid" || (event === "lead.status_changed" && SOLD.has(s(lead.status))) ? at : null) : null;
  const an = b.analysis as Raw | undefined;
  const summary = event === "test" ? "тестова подія"
    : event === "call.analyzed" ? `дзвінок: оцінка ${s(an?.score)}${an?.summary ? ` — ${s(an.summary).slice(0, 200)}` : ""}`
    : row ? `${row.name || `#${row.crm_id}`} → ${STATUS_UA[row.status] ?? row.status}${row.deal_amount ? `, ${money(row.deal_amount, row.currency)}` : ""}${row.lost_reason ? ` (${REASON_UA[row.lost_reason] ?? row.lost_reason})` : ""}` : event;
  const fresh = addCrmEvent({ event_id: eventId, client_id: clientId, event, crm_id: row?.crm_id ?? null, summary, occurred_at: at });
  if (!fresh) return { status: 200, body: { ok: true, duplicate: true } };
  const before = row ? getCrmLead(clientId, row.crm_id) : undefined;
  if (row) upsertCrmLead(row);
  patchCrmLink(clientId, { last_event_at: new Date().toISOString() });
  if (row && (event === "deal.won" || event === "deal.paid") && !(event === "deal.won" && before && SOLD.has(before.status))) void notifySale(clientId, row, event).catch((e) => logError("crm-notify", e));
  return { status: 200, body: { ok: true } };
}

// Продаж → коротко Саші в Telegram (тумблер)
async function notifySale(clientId: number, l: CrmLead, event: string) {
  if (!autoOn("crm_notify")) return;
  const { tg, tgOwner } = await import("./telegram");
  const owner = tgOwner();
  if (!owner) return;
  const c = getClientRow(clientId);
  const head = event === "deal.paid" ? "💵 Оплата" : "💰 Продаж";
  const amount = event === "deal.paid" ? (l.paid_amount ?? l.deal_amount) : l.deal_amount;
  const text = `${head} · ${c?.name ?? ""}\n${l.name || `угода #${l.crm_id}`}: ${money(amount, l.currency) || "без суми"}${l.manager ? `\nМенеджер: ${l.manager}` : ""}${l.ad_name || l.campaign_name ? `\nЗ реклами: ${[l.campaign_name, l.ad_name].filter(Boolean).join(" → ")}` : l.source ? `\nДжерело: ${SOURCE_UA[l.source] ?? l.source}` : ""}`;
  await tg("sendMessage", { chat_id: owner, text });
}

// ---- Запити до CRM
async function crmGet<T>(clientId: number, path: string, params: Record<string, string> = {}): Promise<T> {
  const link = getCrmLink(clientId), key = crmKey(clientId);
  if (!link || !key) throw new Error("CRM не підключена");
  const url = `${link.base_url.replace(/\/+$/, "")}${path}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`;
  const r = await fetch(url, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000) });
  if (r.status === 401) throw new Error("CRM: ключ не підходить (створи новий у CRM → Налаштування → Конектори → Client Ops)");
  if (r.status === 429) throw new Error("CRM: забагато запитів, спробую пізніше");
  if (!r.ok) throw new Error(`CRM: відповідь ${r.status}`);
  return (await r.json()) as T;
}

export async function crmCheck(clientId: number): Promise<string> {
  const st = await crmGet<Raw>(clientId, "/stages");
  patchCrmLink(clientId, { stages_json: JSON.stringify(st), last_error: "" });
  return "ok";
}

// Забрати ліди, змінені після pull_since (перший раз — усю історію)
export async function crmPull(clientId: number): Promise<number> {
  const link = getCrmLink(clientId);
  if (!link) return 0;
  const startedAt = new Date().toISOString();
  const since = link.pull_since ? new Date(Date.parse(link.pull_since) - 10 * 60_000).toISOString() : "2000-01-01T00:00:00Z";
  let cursor = "", got = 0;
  try {
    for (let i = 0; i < 200; i++) {
      const page = await crmGet<{ items?: Raw[]; next_cursor?: string | null }>(clientId, "/leads", { updated_since: since, limit: "500", ...(cursor ? { cursor } : {}) });
      for (const it of page.items ?? []) { const row = toLead(clientId, it); if (row) { upsertCrmLead(row); got++; } }
      if (!page.next_cursor) break;
      cursor = page.next_cursor;
    }
    let summary = link.summary_json;
    try {
      const to = new Date(), from = new Date(Date.now() - 30 * 86400_000);
      summary = JSON.stringify(await crmGet<Raw>(clientId, "/summary", { from: from.toISOString(), to: to.toISOString() }));
    } catch (e) { logError(`crm-summary ${clientId}`, e); }
    patchCrmLink(clientId, { pull_since: startedAt, last_pull_at: startedAt, last_error: "", summary_json: summary });
  } catch (e) {
    patchCrmLink(clientId, { last_error: e instanceof Error ? e.message : "помилка" });
    throw e;
  }
  return got;
}

// Раз на 30 хв — запасне підтягування (вебхук міг не дійти)
let lastTick = 0;
export async function crmTick(): Promise<void> {
  if (Date.now() - lastTick < 30 * 60_000 || !autoOn("crm_sync")) return;
  lastTick = Date.now();
  for (const l of listCrmLinks()) if (crmKey(l.client_id)) await crmPull(l.client_id).catch((e) => { if (!/забагато/.test(String(e))) logError(`crm-pull ${l.client_id}`, e); });
}

// ---- Цифри для екрана і Джері (рахуємо самі з лідів — так точно знаємо, що саме)
export type CrmStats = {
  leads: number; sales: number; revenue: number; avgCheck: number | null; conv: number | null; paid: number;
  speedMin: number | null; noContact: number; currency: string;
  bySource: { key: string; leads: number; sales: number; revenue: number }[];
  byStatus: { key: string; n: number }[];
  lost: { key: string; n: number }[];
  managers: { key: string; leads: number; sales: number; revenue: number; speedMin: number | null }[];
};
const median = (xs: number[]) => { if (!xs.length) return null; const a = [...xs].sort((x, y) => x - y), m = a.length >> 1; return Math.round(a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2); };
export function crmStats(clientId: number, sinceIso: string, untilIso = new Date().toISOString()): CrmStats {
  const all = crmLeads(clientId);
  const inP = (t: string | null) => !!t && t >= sinceIso && t <= untilIso;
  const leads = all.filter((l) => inP(l.created_at));
  const sold = all.filter((l) => inP(l.won_at));
  const rev = (xs: CrmLead[]) => xs.reduce((a, l) => a + (l.deal_amount ?? 0), 0);
  const speeds = (xs: CrmLead[]) => xs.filter((l) => l.first_contact_at).map((l) => (Date.parse(l.first_contact_at!) - Date.parse(l.created_at)) / 60000).filter((x) => x >= 0);
  const group = <K extends string>(xs: CrmLead[], key: (l: CrmLead) => K) => { const m = new Map<K, CrmLead[]>(); for (const l of xs) m.set(key(l), [...(m.get(key(l)) ?? []), l]); return m; };
  const srcKeys = new Set([...leads, ...sold].map((l) => l.source || "other"));
  const mgrKeys = new Set([...leads, ...sold].map((l) => l.manager || "—"));
  return {
    leads: leads.length, sales: sold.length, revenue: rev(sold), avgCheck: sold.length ? rev(sold) / sold.length : null,
    conv: leads.length ? (leads.filter((l) => SOLD.has(l.status)).length / leads.length) * 100 : null,
    paid: all.filter((l) => inP(l.paid_at)).reduce((a, l) => a + (l.paid_amount ?? 0), 0),
    speedMin: median(speeds(leads)), noContact: leads.filter((l) => !l.first_contact_at && !["lost", "junk", "no_answer"].includes(l.status)).length,
    currency: all.find((l) => l.currency)?.currency ?? "",
    bySource: [...srcKeys].map((k) => ({ key: k, leads: leads.filter((l) => (l.source || "other") === k).length, sales: sold.filter((l) => (l.source || "other") === k).length, revenue: rev(sold.filter((l) => (l.source || "other") === k)) })).sort((a, b) => b.leads - a.leads),
    byStatus: [...group(leads, (l) => l.status || "new")].map(([key, xs]) => ({ key, n: xs.length })).sort((a, b) => b.n - a.n),
    lost: [...group(leads.filter((l) => l.lost_reason), (l) => l.lost_reason)].map(([key, xs]) => ({ key, n: xs.length })).sort((a, b) => b.n - a.n),
    managers: [...mgrKeys].map((k) => ({ key: k, leads: leads.filter((l) => (l.manager || "—") === k).length, sales: sold.filter((l) => (l.manager || "—") === k).length, revenue: rev(sold.filter((l) => (l.manager || "—") === k)), speedMin: median(speeds(leads.filter((l) => (l.manager || "—") === k))) })).sort((a, b) => b.leads - a.leads),
  };
}

// Реклама → продажі по кожному оголошенню (за весь час: продаж квартири може статись через місяці після заявки)
export type AdSales = { ad_id: string; ad_name: string; campaign_name: string; spend: number | null; metaLeads: number | null; crmLeads: number; meetings: number; sales: number; revenue: number; cps: number | null; roas: number | null };
export function crmByAd(clientId: number, adTotals: { ad_id: string; ad_name: string; campaign_name: string; spend: number; leads: number }[]): AdSales[] {
  const all = crmLeads(clientId).filter((l) => l.meta_ad_id);
  const meta = new Map(adTotals.map((a) => [a.ad_id, a]));
  const ids = new Set([...all.map((l) => l.meta_ad_id), ...adTotals.filter((a) => a.spend > 0).map((a) => a.ad_id)]);
  const out: AdSales[] = [];
  for (const id of ids) {
    const xs = all.filter((l) => l.meta_ad_id === id), m = meta.get(id);
    const sold = xs.filter((l) => SOLD.has(l.status)), revenue = sold.reduce((a, l) => a + (l.deal_amount ?? 0), 0);
    const spend = m ? m.spend : null;
    out.push({
      ad_id: id, ad_name: m?.ad_name || xs[0]?.ad_name || id, campaign_name: m?.campaign_name || xs[0]?.campaign_name || "",
      spend, metaLeads: m ? m.leads : null, crmLeads: xs.length, meetings: xs.filter((l) => ["meeting", "won", "paid"].includes(l.status)).length,
      sales: sold.length, revenue, cps: spend && sold.length ? spend / sold.length : null, roas: spend ? revenue / spend : null,
    });
  }
  return out.sort((a, b) => b.revenue - a.revenue || (b.spend ?? 0) - (a.spend ?? 0));
}
