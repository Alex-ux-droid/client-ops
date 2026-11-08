// Гіпотези клієнта (Стратегія → Гіпотези): що перевіряємо, чим міряємо, до коли, що вийшло
import { db } from "../db";

export const HYP_STATUS = { idea: "ідея", running: "перевіряємо", confirmed: "підтвердилась", rejected: "не підтвердилась" } as const;
export type HypStatus = keyof typeof HYP_STATUS;
export type Hypothesis = { id: number; client_id: number; statement: string; action: string; metric_id: number | null; expected: string; deadline: string | null; status: HypStatus; result: string; created_at: string; closed_at: string | null };

export const listHypotheses = (clientId: number) => db().prepare("SELECT * FROM hypotheses WHERE client_id = ? ORDER BY CASE status WHEN 'running' THEN 0 WHEN 'idea' THEN 1 ELSE 2 END, COALESCE(deadline, '9999'), id DESC").all(clientId) as Hypothesis[];
export const getHypothesis = (id: number) => db().prepare("SELECT * FROM hypotheses WHERE id = ?").get(id) as Hypothesis | undefined;
export const hypothesesDue = (clientId: number, from: string, to: string) => db().prepare("SELECT * FROM hypotheses WHERE client_id = ? AND status IN ('idea','running') AND deadline BETWEEN ? AND ? ORDER BY deadline").all(clientId, from, to) as Hypothesis[];

export function addHypothesis(clientId: number, h: { statement: string; action?: string; metric_id?: number | null; expected?: string; deadline?: string | null; status?: HypStatus }): number {
  return Number(db().prepare("INSERT INTO hypotheses (client_id, statement, action, metric_id, expected, deadline, status) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(clientId, h.statement.slice(0, 500), h.action ?? "", h.metric_id ?? null, h.expected ?? "", h.deadline || null, h.status && h.status in HYP_STATUS ? h.status : "idea").lastInsertRowid);
}
export function updateHypothesis(id: number, p: Partial<Pick<Hypothesis, "statement" | "action" | "metric_id" | "expected" | "deadline" | "status" | "result">>): void {
  const keys = (["statement", "action", "metric_id", "expected", "deadline", "status", "result"] as const).filter((k) => p[k] !== undefined);
  if (!keys.length) return;
  const closing = p.status === "confirmed" || p.status === "rejected";
  db().prepare(`UPDATE hypotheses SET ${keys.map((k) => `${k} = @${k}`).join(", ")}${closing ? ", closed_at = datetime('now')" : p.status ? ", closed_at = NULL" : ""} WHERE id = @id`).run({ ...p, id });
}
export const deleteHypothesis = (id: number) => db().prepare("DELETE FROM hypotheses WHERE id = ?").run(id);
