import { db } from "../db";

export type ConfirmKind = "task_done" | "task_new" | "log" | "next_step" | "strategy";
export type ConfirmItem = { id: number; client_id: number; kind: ConfirmKind; task_id: number | null; title: string; evidence: string; status: string; created_at: string; client_name?: string };
export const CONFIRM_UA: Record<ConfirmKind, string> = { task_done: "схоже зроблено", task_new: "нове прохання", log: "в історію", next_step: "наступний крок", strategy: "оновити стратегію" };

export const pendingConfirms = (clientId?: number) => db().prepare(`SELECT q.*, c.name client_name FROM confirm_queue q JOIN clients c ON c.id = q.client_id
  WHERE q.status = 'new' ${clientId ? "AND q.client_id = ?" : ""} ORDER BY q.created_at DESC LIMIT 50`).all(...(clientId ? [clientId] : [])) as ConfirmItem[];
export const getConfirm = (id: number) => db().prepare("SELECT * FROM confirm_queue WHERE id = ?").get(id) as ConfirmItem | undefined;
export const setConfirmStatus = (id: number, status: "ok" | "skip") => db().prepare("UPDATE confirm_queue SET status = ?, decided_at = datetime('now') WHERE id = ?").run(status, id);

// Без повторів: ту саму пропозицію (клієнт + вид + задача/назва) за 14 днів не додаємо — навіть якщо Саша її відкинув
export function addConfirm(x: { client_id: number; kind: ConfirmKind; task_id?: number | null; title: string; evidence: string }): boolean {
  const norm = x.title.toLowerCase().replace(/\s+/g, " ").trim();
  const dup = db().prepare(`SELECT 1 FROM confirm_queue WHERE client_id = ? AND kind = ? AND created_at >= datetime('now','-14 days')
    AND (${x.task_id ? "task_id = ?" : "lower(title) = ?"})`).get(x.client_id, x.kind, x.task_id ?? norm);
  if (dup) return false;
  db().prepare("INSERT INTO confirm_queue (client_id, kind, task_id, title, evidence) VALUES (?, ?, ?, ?, ?)").run(x.client_id, x.kind, x.task_id ?? null, x.title.slice(0, 200), x.evidence.slice(0, 600));
  return true;
}
