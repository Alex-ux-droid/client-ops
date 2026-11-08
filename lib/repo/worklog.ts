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

// Дубль = той самий клієнт, той самий день і майже той самий текст (Джері може записати одне й те саме двічі:
// complete_task + log_work, або витяжка повторно). Повертає id наявного запису.
const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
function similar(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const wa = new Set(x.split(" ").filter((w) => w.length > 2)), wb = new Set(y.split(" ").filter((w) => w.length > 2));
  if (!wa.size || !wb.size) return false;
  let both = 0; for (const w of wa) if (wb.has(w)) both++;
  return both / Math.min(wa.size, wb.size) >= 0.8;
}
export function findSimilarWork(clientId: number, doneAt: string, what: string): number | null {
  const rows = db().prepare("SELECT id, what FROM work_log WHERE client_id = ? AND substr(done_at,1,10) = ?").all(clientId, doneAt.slice(0, 10)) as { id: number; what: string }[];
  return rows.find((r) => similar(r.what, what))?.id ?? null;
}

export function addWork(input: { client_id: number; what: string; why?: string; result?: string; done_at: string; task_id?: number | null }): number {
  const dup = findSimilarWork(input.client_id, input.done_at, input.what);
  if (dup) return dup;
  return Number(db().prepare(`
    INSERT INTO work_log (client_id, task_id, done_at, what, why, result)
    VALUES (@client_id, @task_id, @done_at, @what, @why, @result)
  `).run({ task_id: null, why: "", result: "", ...input }).lastInsertRowid);
}

export function deleteWork(id: number): void {
  db().prepare("DELETE FROM work_log WHERE id = ?").run(id);
}
