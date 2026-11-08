// Головна метрика клієнта: джерела (CRM, Meta, вручну), поточне значення, історія, тривоги.
import { db } from "../db";
import { crmLeads, getCrmLink } from "./crm";
import { accountsForClient, kyivDay, totals } from "./meta";

export const METRIC_SOURCES = {
  crm_contact_pct: { label: "лід → контакт, % (30 дн.)", dir: "up", unit: "%", kind: "sales" },
  crm_sale_pct: { label: "лід → продаж, % (30 дн.)", dir: "up", unit: "%", kind: "sales" },
  crm_sales: { label: "продажів за 30 дн.", dir: "up", unit: "", kind: "sales" },
  crm_revenue: { label: "продано на суму за 30 дн.", dir: "up", unit: "", kind: "money" },
  meta_leads: { label: "лідів з реклами за 7 дн.", dir: "up", unit: "", kind: "ads" },
  meta_cpl: { label: "ціна ліда за 7 дн.", dir: "down", unit: "", kind: "ads" },
  manual: { label: "своя (вписую вручну)", dir: "up", unit: "", kind: "sales" },
} as const;
export type MetricSource = keyof typeof METRIC_SOURCES;
export type Metric = { id: number; client_id: number; source: MetricSource; name: string; target: number | null; direction: "up" | "down"; is_main: number; created_at: string };

export const metricName = (m: Metric) => m.name || METRIC_SOURCES[m.source]?.label || m.source;
export const listMetrics = (clientId: number) => db().prepare("SELECT * FROM client_metrics WHERE client_id = ? ORDER BY is_main DESC, id").all(clientId) as Metric[];
export const getMetric = (id: number) => db().prepare("SELECT * FROM client_metrics WHERE id = ?").get(id) as Metric | undefined;

export function addMetric(clientId: number, p: { source: MetricSource; name?: string; target?: number | null; direction?: "up" | "down"; is_main?: boolean }): number {
  const first = !listMetrics(clientId).length;
  const id = Number(db().prepare("INSERT INTO client_metrics (client_id, source, name, target, direction, is_main) VALUES (?, ?, ?, ?, ?, ?)")
    .run(clientId, p.source, p.name ?? "", p.target ?? null, p.direction ?? METRIC_SOURCES[p.source].dir, 0).lastInsertRowid);
  if (p.is_main || first) setMainMetric(id);
  return id;
}
export function updateMetric(id: number, p: Partial<Pick<Metric, "name" | "target" | "direction">>): void {
  const keys = (["name", "target", "direction"] as const).filter((k) => p[k] !== undefined);
  if (keys.length) db().prepare(`UPDATE client_metrics SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...p, id });
}
export function setMainMetric(id: number): void {
  const m = getMetric(id);
  if (!m) return;
  db().prepare("UPDATE client_metrics SET is_main = (id = ?) WHERE client_id = ?").run(id, m.client_id);
}
export const deleteMetric = (id: number) => db().prepare("DELETE FROM client_metrics WHERE id = ?").run(id);
export const setMetricValue = (id: number, day: string, value: number) => db().prepare("INSERT INTO client_metric_values (metric_id, day, value) VALUES (?, ?, ?) ON CONFLICT(metric_id, day) DO UPDATE SET value = excluded.value").run(id, day, value);
export const metricHistory = (id: number, days = 60) => db().prepare("SELECT day, value FROM client_metric_values WHERE metric_id = ? AND day >= ? ORDER BY day").all(id, kyivDay(days)) as { day: string; value: number }[];

// Поточне значення (рахуємо наживо; manual — останнє вписане). null — даних нема.
export function metricValue(m: Metric): number | null {
  const c = m.client_id;
  if (m.source === "manual") return (db().prepare("SELECT value FROM client_metric_values WHERE metric_id = ? ORDER BY day DESC LIMIT 1").get(m.id) as { value: number } | undefined)?.value ?? null;
  if (m.source.startsWith("crm_")) {
    if (!getCrmLink(c)) return null;
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const all = crmLeads(c), leads = all.filter((l) => l.created_at >= since && l.status !== "junk");
    const sold = all.filter((l) => l.won_at && l.won_at >= since);
    if (m.source === "crm_sales") return sold.length;
    if (m.source === "crm_revenue") return Math.round(sold.reduce((a, l) => a + (l.deal_amount ?? 0), 0));
    if (!leads.length) return null;
    const hit = m.source === "crm_contact_pct" ? leads.filter((l) => l.first_contact_at || l.call_attempts > 0).length : leads.filter((l) => l.status === "won" || l.status === "paid").length;
    return Math.round((hit / leads.length) * 1000) / 10;
  }
  if (!accountsForClient(c).length) return null;
  const t = totals(c, kyivDay(6), kyivDay(0));
  if (m.source === "meta_leads") return t.leads;
  return t.leads ? Math.round((t.spend / t.leads) * 100) / 100 : null;
}

export const fmtMetric = (m: Metric, v: number | null) => (v == null ? "—" : `${v.toLocaleString("uk-UA", { maximumFractionDigits: 1 })}${METRIC_SOURCES[m.source]?.unit ?? ""}`);

// Знімок усіх автоматичних метрик раз на день (для тренду)
export function snapshotMetrics(day = kyivDay(0)): number {
  let n = 0;
  for (const m of db().prepare("SELECT * FROM client_metrics WHERE source != 'manual'").all() as Metric[]) {
    const v = metricValue(m);
    if (v != null) { setMetricValue(m.id, day, v); n++; }
  }
  return n;
}

// Тривога по головній метриці: гірша за ціль або впала на третину за 14 днів
type MFlag = { level: "bad" | "warn"; text: string; reason?: string; kind?: "money" | "sales" | "ads" };
export function metricAlerts(clientId: number): MFlag[] {
  const m = listMetrics(clientId).find((x) => x.is_main);
  if (!m) return [];
  const v = metricValue(m);
  if (v == null) return [];
  const name = metricName(m), kind = METRIC_SOURCES[m.source]?.kind ?? "sales";
  const up = m.direction === "up";
  const out: MFlag[] = [];
  if (m.target != null && m.target > 0 && (up ? v < m.target : v > m.target)) {
    const far = up ? v < m.target * 0.7 : v > m.target * 1.3;
    out.push({ level: far ? "bad" : "warn", kind, text: `${name}: ${fmtMetric(m, v)} при цілі ${fmtMetric(m, m.target)}`, reason: `Головна метрика клієнта гірша за ціль. Зараз ${fmtMetric(m, v)}, ціль ${fmtMetric(m, m.target)}.` });
  }
  const old = (db().prepare("SELECT value FROM client_metric_values WHERE metric_id = ? AND day <= ? ORDER BY day DESC LIMIT 1").get(m.id, kyivDay(14)) as { value: number } | undefined)?.value;
  if (!out.length && old != null && old > 0 && (up ? v < old * 0.67 : v > old * 1.5)) {
    out.push({ level: "warn", kind, text: `${name} ${up ? "впала" : "зросла"} за 2 тижні`, reason: `Головна метрика: було ${fmtMetric(m, old)} (14 днів тому), зараз ${fmtMetric(m, v)}.` });
  }
  return out;
}
