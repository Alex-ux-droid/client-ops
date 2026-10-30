import { db } from "../db";

export type MetaAccount = {
  account_id: string; name: string; currency: string; account_status: number | null; disable_reason: number | null; business_name: string;
  client_id: number | null; client_name?: string | null; last_sync_at: string | null; last_error: string;
};
export type MetaCampaign = { campaign_id: string; account_id: string; name: string; status: string; objective: string; daily_budget: number | null; lifetime_budget: number | null };
export type MetaAd = { ad_id: string; account_id: string; campaign_id: string; name: string; status: string; thumbnail_url: string; body: string;
  image_url: string; kind: string; video_id: string; images_json: string; preview_url: string; adset_id: string; reach_30d: number; spend_30d: number; impressions_30d: number; clicks_30d: number; leads_30d: number };
export type MetaAdset = { adset_id: string; account_id: string; campaign_id: string; name: string; status: string; daily_budget: number | null; lifetime_budget: number | null;
  optimization_goal: string; spend_30d: number; impressions_30d: number; clicks_30d: number; leads_30d: number; reach_30d: number };
export type Breakdown = { kind: string; key: string; spend: number; impressions: number; clicks: number; leads: number; reach: number };
export type Totals = { spend: number; impressions: number; clicks: number; leads: number };

export const ACCOUNT_STATUS: Record<number, string> = {
  1: "активний", 2: "заблокований", 3: "борг / проблема з оплатою", 7: "на перевірці ризиків", 8: "очікує розрахунку",
  9: "пільговий період оплати", 100: "очікує закриття", 101: "закритий",
};

export function upsertAccount(a: Omit<MetaAccount, "client_id" | "last_sync_at" | "last_error">): void {
  db().prepare(`INSERT INTO meta_accounts (account_id, name, currency, account_status, disable_reason, business_name)
    VALUES (@account_id, @name, @currency, @account_status, @disable_reason, @business_name)
    ON CONFLICT(account_id) DO UPDATE SET name = excluded.name, currency = excluded.currency, account_status = excluded.account_status,
      disable_reason = excluded.disable_reason, business_name = excluded.business_name`).run(a);
}

export function listAccounts(): MetaAccount[] {
  return db().prepare(`SELECT a.*, c.name AS client_name FROM meta_accounts a LEFT JOIN clients c ON c.id = a.client_id
    ORDER BY a.client_id IS NULL, a.name`).all() as MetaAccount[];
}

export function accountsForClient(clientId: number): MetaAccount[] {
  return db().prepare("SELECT * FROM meta_accounts WHERE client_id = ? ORDER BY name").all(clientId) as MetaAccount[];
}

export function linkAccount(accountId: string, clientId: number | null): void {
  db().prepare("UPDATE meta_accounts SET client_id = ? WHERE account_id = ?").run(clientId, accountId);
}

export function setSyncResult(accountId: string, error = ""): void {
  db().prepare("UPDATE meta_accounts SET last_sync_at = datetime('now'), last_error = ? WHERE account_id = ?").run(error, accountId);
}

// Синхронізація кабінету одним заходом: кампанії, дні, оголошення
export function saveSync(accountId: string, data: {
  campaigns: Omit<MetaCampaign, "account_id">[];
  daily: { campaign_id: string; date: string; spend: number; impressions: number; clicks: number; leads: number }[];
  ads: Omit<MetaAd, "account_id">[];
  since: string;
  adsets?: Omit<MetaAdset, "account_id">[];
  breakdowns?: Breakdown[];
}): void {
  const tx = db().transaction(() => {
    const c = db().prepare(`INSERT INTO meta_campaigns (campaign_id, account_id, name, status, objective, daily_budget, lifetime_budget, updated_at)
      VALUES (@campaign_id, @account_id, @name, @status, @objective, @daily_budget, @lifetime_budget, datetime('now'))
      ON CONFLICT(campaign_id) DO UPDATE SET name = excluded.name, status = excluded.status, objective = excluded.objective,
        daily_budget = excluded.daily_budget, lifetime_budget = excluded.lifetime_budget, updated_at = excluded.updated_at`);
    for (const x of data.campaigns) c.run({ ...x, account_id: accountId });
    db().prepare("DELETE FROM meta_daily WHERE account_id = ? AND date >= ?").run(accountId, data.since);
    const d = db().prepare(`INSERT OR REPLACE INTO meta_daily (account_id, campaign_id, date, spend, impressions, clicks, leads)
      VALUES (@account_id, @campaign_id, @date, @spend, @impressions, @clicks, @leads)`);
    for (const x of data.daily) d.run({ ...x, account_id: accountId });
    db().prepare("DELETE FROM meta_ads WHERE account_id = ?").run(accountId);
    const a = db().prepare(`INSERT OR REPLACE INTO meta_ads (ad_id, account_id, campaign_id, name, status, thumbnail_url, body, image_url, kind, video_id, images_json, preview_url, adset_id, reach_30d, spend_30d, impressions_30d, clicks_30d, leads_30d)
      VALUES (@ad_id, @account_id, @campaign_id, @name, @status, @thumbnail_url, @body, @image_url, @kind, @video_id, @images_json, @preview_url, @adset_id, @reach_30d, @spend_30d, @impressions_30d, @clicks_30d, @leads_30d)`);
    for (const x of data.ads) a.run({ ...x, account_id: accountId });
    if (data.adsets) {
      db().prepare("DELETE FROM meta_adsets WHERE account_id = ?").run(accountId);
      const s = db().prepare(`INSERT OR REPLACE INTO meta_adsets (adset_id, account_id, campaign_id, name, status, daily_budget, lifetime_budget, optimization_goal, spend_30d, impressions_30d, clicks_30d, leads_30d, reach_30d)
        VALUES (@adset_id, @account_id, @campaign_id, @name, @status, @daily_budget, @lifetime_budget, @optimization_goal, @spend_30d, @impressions_30d, @clicks_30d, @leads_30d, @reach_30d)`);
      for (const x of data.adsets) s.run({ ...x, account_id: accountId });
    }
    if (data.breakdowns) {
      // розріз, який цього разу не прийшов (помилка Meta), лишаємо старим
      const kinds = [...new Set(data.breakdowns.map((b) => b.kind))];
      for (const k of kinds) db().prepare("DELETE FROM meta_breakdowns WHERE account_id = ? AND kind = ?").run(accountId, k);
      const b = db().prepare(`INSERT OR REPLACE INTO meta_breakdowns (account_id, kind, key, spend, impressions, clicks, leads, reach)
        VALUES (@account_id, @kind, @key, @spend, @impressions, @clicks, @leads, @reach)`);
      for (const x of data.breakdowns) b.run({ ...x, account_id: accountId });
    }
  });
  tx();
}

const ids = (clientId: number) => accountsForClient(clientId).map((a) => a.account_id);
const inList = (n: number) => Array(n).fill("?").join(",");

// Сума за період [since, until] по всіх кабінетах клієнта
export function totals(clientId: number, since: string, until: string): Totals {
  const acc = ids(clientId);
  if (!acc.length) return { spend: 0, impressions: 0, clicks: 0, leads: 0 };
  return db().prepare(`SELECT COALESCE(SUM(spend),0) spend, COALESCE(SUM(impressions),0) impressions, COALESCE(SUM(clicks),0) clicks, COALESCE(SUM(leads),0) leads
    FROM meta_daily WHERE account_id IN (${inList(acc.length)}) AND date BETWEEN ? AND ?`).get(...acc, since, until) as Totals;
}

export function dailySeries(clientId: number, since: string): { date: string; spend: number; leads: number }[] {
  const acc = ids(clientId);
  if (!acc.length) return [];
  return db().prepare(`SELECT date, SUM(spend) spend, SUM(leads) leads FROM meta_daily
    WHERE account_id IN (${inList(acc.length)}) AND date >= ? GROUP BY date ORDER BY date`).all(...acc, since) as { date: string; spend: number; leads: number }[];
}

export function campaignsWithStats(clientId: number, since: string): (MetaCampaign & Totals)[] {
  const acc = ids(clientId);
  if (!acc.length) return [];
  return db().prepare(`SELECT c.*, COALESCE(SUM(d.spend),0) spend, COALESCE(SUM(d.impressions),0) impressions, COALESCE(SUM(d.clicks),0) clicks, COALESCE(SUM(d.leads),0) leads
    FROM meta_campaigns c LEFT JOIN meta_daily d ON d.campaign_id = c.campaign_id AND d.date >= ?
    WHERE c.account_id IN (${inList(acc.length)}) GROUP BY c.campaign_id
    ORDER BY c.status = 'ACTIVE' DESC, spend DESC`).all(since, ...acc) as (MetaCampaign & Totals)[];
}

export function topAds(clientId: number, limit = 12): MetaAd[] {
  const acc = ids(clientId);
  if (!acc.length) return [];
  return db().prepare(`SELECT * FROM meta_ads WHERE account_id IN (${inList(acc.length)}) AND spend_30d > 0
    ORDER BY spend_30d DESC LIMIT ?`).all(...acc, limit) as MetaAd[];
}

const day = (offset: number) => new Date(Date.now() - offset * 86400_000).toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);

// Тривоги для «Потребують уваги»: кабінет з проблемою, гроші йдуть без лідів, ціна ліда різко виросла
export function metaAlerts(clientId: number): { level: "bad" | "warn"; text: string }[] {
  const accs = accountsForClient(clientId);
  if (!accs.length) return [];
  const out: { level: "bad" | "warn"; text: string }[] = [];
  for (const a of accs) if (a.account_status && a.account_status !== 1) out.push({ level: "bad", text: `кабінет: ${ACCOUNT_STATUS[a.account_status] ?? "проблема"}` });
  const last3 = totals(clientId, day(3), day(1));
  const prev = totals(clientId, day(30), day(4));
  if (last3.spend > 0 && last3.leads === 0 && prev.leads > 0) out.push({ level: "warn", text: "реклама 3 дні без лідів" });
  if (last3.leads > 0 && prev.leads > 0) {
    const now = last3.spend / last3.leads, before = prev.spend / prev.leads;
    if (before > 0 && now > before * 1.8) out.push({ level: "warn", text: `ціна ліда ×${(now / before).toFixed(1)}` });
  }
  return out;
}

export { day as kyivDay };

// Кабінети, ID яких уже вписаний у послузі Meta Ads клієнта, привʼязуємо самі
export function autoLinkFromServices(): number {
  const rows = db().prepare("SELECT client_id, details_json FROM client_services WHERE type = 'meta_ads'").all() as { client_id: number; details_json: string }[];
  const upd = db().prepare("UPDATE meta_accounts SET client_id = ? WHERE client_id IS NULL AND (account_id = ? OR account_id = ?)");
  let n = 0;
  for (const r of rows) {
    const raw = String((JSON.parse(r.details_json) as Record<string, string>).account_id ?? "").trim();
    const digits = raw.replace(/\D/g, "");
    if (digits) n += upd.run(r.client_id, `act_${digits}`, raw).changes;
  }
  return n;
}

// ---- Загальна панель «Реклама»: цифри по кабінетах
export function accountTotals(accountId: string, since: string, until: string): Totals {
  return db().prepare(`SELECT COALESCE(SUM(spend),0) spend, COALESCE(SUM(impressions),0) impressions, COALESCE(SUM(clicks),0) clicks, COALESCE(SUM(leads),0) leads
    FROM meta_daily WHERE account_id = ? AND date BETWEEN ? AND ?`).get(accountId, since, until) as Totals;
}

export function accountSeries(accountId: string, since: string): { date: string; spend: number; leads: number }[] {
  return db().prepare(`SELECT date, SUM(spend) spend, SUM(leads) leads FROM meta_daily WHERE account_id = ? AND date >= ?
    GROUP BY date ORDER BY date`).all(accountId, since) as { date: string; spend: number; leads: number }[];
}

// Активні кампанії і сума їх денних бюджетів
export function accountBudget(accountId: string): { active: number; daily: number } {
  return db().prepare(`SELECT COUNT(*) active, COALESCE(SUM(daily_budget),0) daily FROM meta_campaigns
    WHERE account_id = ? AND status = 'ACTIVE'`).get(accountId) as { active: number; daily: number };
}

// ---- Глибокий розбір: групи оголошень, розрізи, усі оголошення, аналіз Джері
export function adsetsForClient(clientId: number): MetaAdset[] {
  const acc = ids(clientId);
  if (!acc.length) return [];
  return db().prepare(`SELECT * FROM meta_adsets WHERE account_id IN (${inList(acc.length)}) ORDER BY spend_30d DESC`).all(...acc) as MetaAdset[];
}

export function adsForClient(clientId: number): MetaAd[] {
  const acc = ids(clientId);
  if (!acc.length) return [];
  return db().prepare(`SELECT * FROM meta_ads WHERE account_id IN (${inList(acc.length)}) ORDER BY spend_30d DESC`).all(...acc) as MetaAd[];
}

// Розріз по всіх кабінетах клієнта (однакові ключі складаються)
export function breakdowns(clientId: number, kind: string): Breakdown[] {
  const acc = ids(clientId);
  if (!acc.length) return [];
  return db().prepare(`SELECT kind, key, SUM(spend) spend, SUM(impressions) impressions, SUM(clicks) clicks, SUM(leads) leads, SUM(reach) reach
    FROM meta_breakdowns WHERE account_id IN (${inList(acc.length)}) AND kind = ? GROUP BY key ORDER BY spend DESC`).all(...acc, kind) as Breakdown[];
}

export type MetaAnalysis = { summary?: string; pros?: string[]; cons?: string[]; tips?: string[]; audience?: string; creatives?: Record<string, string> };
export function getAnalysis(clientId: number): { data: MetaAnalysis; created_at: string } | null {
  const r = db().prepare("SELECT data_json, created_at FROM meta_analysis WHERE client_id = ?").get(clientId) as { data_json: string; created_at: string } | undefined;
  return r ? { data: JSON.parse(r.data_json) as MetaAnalysis, created_at: r.created_at } : null;
}
export function saveAnalysis(clientId: number, data: MetaAnalysis): void {
  db().prepare(`INSERT INTO meta_analysis (client_id, data_json, created_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(client_id) DO UPDATE SET data_json = excluded.data_json, created_at = excluded.created_at`).run(clientId, JSON.stringify(data));
}
