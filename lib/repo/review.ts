// Тижневий рев'ю: тиждень = понеділок (Київ). Рядок на активного клієнта, рішення на тиждень, знімок при закритті.
import { db } from "../db";
import { listMetrics, metricName, metricValue, fmtMetric } from "./metrics";

const kyiv = (d = new Date()) => d.toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" });
export function weekStartOf(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd + "T00:00:00Z") + n * 86400_000).toISOString().slice(0, 10);
export const weekLabel = (w: string) => `${w.slice(8, 10)}.${w.slice(5, 7)}–${addDays(w, 6).slice(8, 10)}.${addDays(w, 6).slice(5, 7)}`;

export const getReview = (week: string) => db().prepare("SELECT * FROM weekly_reviews WHERE week = ?").get(week) as { week: string; data_json: string; closed_at: string } | undefined;
export const listReviews = (limit = 26) => db().prepare("SELECT week, closed_at FROM weekly_reviews ORDER BY week DESC LIMIT ?").all(limit) as { week: string; closed_at: string }[];

// Який тиждень рев'ювимо: у неділю з 18:00 — поточний; інакше — минулий, якщо не закритий; інакше поточний
export function dueWeek(now = new Date()): { week: string; due: boolean } {
  const k = kyiv(now), today = k.slice(0, 10), cur = weekStartOf(today);
  const sundayEve = new Date(today + "T00:00:00Z").getUTCDay() === 0 && Number(k.slice(11, 13)) >= 18;
  if (sundayEve) return { week: cur, due: !getReview(cur) };
  const prev = addDays(cur, -7);
  if (!getReview(prev) && db().prepare("SELECT 1 FROM weekly_reviews LIMIT 1").get()) return { week: prev, due: true };
  return { week: cur, due: false };
}

export type ReviewRow = {
  client_id: number; name: string;
  metric: { name: string; now: string; weekAgo: string; target: string } | null;
  changes: string[]; plan: string[]; decision: string; to_task: boolean; task_id: number | null;
};
export function reviewRows(week: string): ReviewRow[] {
  const end = addDays(week, 6);
  const clients = db().prepare("SELECT id, name FROM clients WHERE status = 'active' AND deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[];
  return clients.map((c) => {
    const m = listMetrics(c.id).find((x) => x.is_main);
    let metric: ReviewRow["metric"] = null;
    if (m) {
      const ago = (db().prepare("SELECT value FROM client_metric_values WHERE metric_id = ? AND day <= ? ORDER BY day DESC LIMIT 1").get(m.id, addDays(week, -1)) as { value: number } | undefined)?.value ?? null;
      metric = { name: metricName(m), now: fmtMetric(m, metricValue(m)), weekAgo: fmtMetric(m, ago), target: m.target != null ? fmtMetric(m, m.target) : "—" };
    }
    const changes = (db().prepare("SELECT what FROM work_log WHERE client_id = ? AND substr(done_at,1,10) BETWEEN ? AND ? ORDER BY done_at DESC, id DESC LIMIT 5").all(c.id, week, end) as { what: string }[]).map((r) => r.what);
    const plan = (db().prepare("SELECT title FROM strategy_items WHERE client_id = ? AND kind = 'plan' AND horizon = 'week' ORDER BY id LIMIT 5").all(c.id) as { title: string }[]).map((r) => r.title);
    const it = db().prepare("SELECT decision, to_task, task_id FROM weekly_review_items WHERE week = ? AND client_id = ?").get(week, c.id) as { decision: string; to_task: number; task_id: number | null } | undefined;
    return { client_id: c.id, name: c.name, metric, changes, plan, decision: it?.decision ?? "", to_task: !!it?.to_task, task_id: it?.task_id ?? null };
  });
}

export function saveDecision(week: string, clientId: number, decision: string, toTask: boolean): void {
  db().prepare(`INSERT INTO weekly_review_items (week, client_id, decision, to_task) VALUES (?, ?, ?, ?)
    ON CONFLICT(week, client_id) DO UPDATE SET decision = excluded.decision, to_task = excluded.to_task`).run(week, clientId, decision.slice(0, 1000), toTask ? 1 : 0);
}
export const setDecisionTask = (week: string, clientId: number, taskId: number) => db().prepare("UPDATE weekly_review_items SET task_id = ? WHERE week = ? AND client_id = ?").run(taskId, week, clientId);

export function weekMoney(week: string) {
  const end = addDays(week, 6), today = kyiv().slice(0, 10);
  const one = (sql: string, ...a: unknown[]) => (db().prepare(sql).get(...a) as { v: number | null }).v ?? 0;
  return {
    received: one("SELECT SUM(amount) v FROM payments WHERE paid_at BETWEEN ? AND ?", week, end),
    expected: one("SELECT SUM(amount) v FROM payments WHERE paid_at IS NULL AND due_date BETWEEN ? AND ? AND due_date >= ?", week, end, today),
    overdue: one("SELECT SUM(amount) v FROM payments WHERE paid_at IS NULL AND due_date < ?", today),
  };
}

export function closeReview(week: string, data: unknown): void {
  db().prepare("INSERT INTO weekly_reviews (week, data_json) VALUES (?, ?) ON CONFLICT(week) DO UPDATE SET data_json = excluded.data_json, closed_at = datetime('now')").run(week, JSON.stringify(data));
}

// Останній знімок по клієнту — для тижневої чернетки звіту клієнту
export function lastReviewFor(clientId: number): { week: string; row: ReviewRow } | null {
  const r = db().prepare("SELECT week, data_json FROM weekly_reviews ORDER BY week DESC LIMIT 1").get() as { week: string; data_json: string } | undefined;
  if (!r) return null;
  try {
    const row = (JSON.parse(r.data_json) as { rows: ReviewRow[] }).rows.find((x) => x.client_id === clientId);
    return row ? { week: r.week, row } : null;
  } catch { return null; }
}
