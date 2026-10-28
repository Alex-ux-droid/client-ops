import { db } from "../db";

export type WorkEntry = {
  id: number;
  client_id: number;
  task_id: number | null;
  done_at: string;
  what: string;
  why: string;
  result: string;
  created_at: string;
};

export type WorkRow = WorkEntry & { client_name: string };

export function listWork(clientId?: number, limit = 50): WorkRow[] {
  const where = clientId ? "WHERE w.client_id = ?" : "";
  const args = clientId ? [clientId, limit] : [limit];
  return db().prepare(`
    SELECT w.*, c.name AS client_name FROM work_log w JOIN clients c ON c.id = w.client_id
    ${where} ORDER BY w.done_at DESC, w.id DESC LIMIT ?
  `).all(...args) as WorkRow[];
}

export function addWork(input: { client_id: number; what: string; why?: string; result?: string; done_at: string; task_id?: number | null }): number {
  return Number(db().prepare(`
    INSERT INTO work_log (client_id, task_id, done_at, what, why, result)
    VALUES (@client_id, @task_id, @done_at, @what, @why, @result)
  `).run({ task_id: null, why: "", result: "", ...input }).lastInsertRowid);
}

export function deleteWork(id: number): void {
  db().prepare("DELETE FROM work_log WHERE id = ?").run(id);
}
