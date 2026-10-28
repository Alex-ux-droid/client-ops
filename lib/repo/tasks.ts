import { db } from "../db";
import { endOfWeek, ymd } from "../dates";

export type TaskStatus = "todo" | "doing" | "done";

export type Task = {
  id: number;
  client_id: number | null;
  title: string;
  details: string;
  status: TaskStatus;
  due_date: string | null;
  remind_at: string | null;
  done_at: string | null;
  created_at: string;
};

export type TaskRow = Task & { client_name: string | null };

const SELECT = `SELECT t.*, c.name AS client_name FROM tasks t LEFT JOIN clients c ON c.id = t.client_id`;
const ORDER = `ORDER BY t.due_date IS NULL, t.due_date, t.id`;

export type TaskView = "overdue" | "today" | "week" | "later" | "all" | "done";

export function listTasks(view: TaskView, clientId?: number): TaskRow[] {
  const today = ymd();
  const where: string[] = [];
  const args: unknown[] = [];
  if (view === "done") where.push("t.status = 'done'");
  else where.push("t.status != 'done'");
  if (view === "overdue") { where.push("t.due_date < ?"); args.push(today); }
  if (view === "today") { where.push("t.due_date = ?"); args.push(today); }
  if (view === "week") { where.push("t.due_date > ? AND t.due_date <= ?"); args.push(today, endOfWeek()); }
  if (view === "later") { where.push("(t.due_date IS NULL OR t.due_date > ?)"); args.push(endOfWeek()); }
  if (clientId) { where.push("t.client_id = ?"); args.push(clientId); }
  const order = view === "done" ? "ORDER BY t.done_at DESC LIMIT 50" : ORDER;
  return db().prepare(`${SELECT} WHERE ${where.join(" AND ")} ${order}`).all(...args) as TaskRow[];
}

export function getTask(id: number): TaskRow | undefined {
  return db().prepare(`${SELECT} WHERE t.id = ?`).get(id) as TaskRow | undefined;
}

export function createTask(input: { title: string; client_id?: number | null; details?: string; due_date?: string | null; remind_at?: string | null }): number {
  return Number(db().prepare(`
    INSERT INTO tasks (title, client_id, details, due_date, remind_at)
    VALUES (@title, @client_id, @details, @due_date, @remind_at)
  `).run({ client_id: null, details: "", due_date: null, remind_at: null, ...input }).lastInsertRowid);
}

export function setTaskStatus(id: number, status: TaskStatus): void {
  db().prepare(`UPDATE tasks SET status = ?, done_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE NULL END WHERE id = ?`)
    .run(status, status, id);
}

export function updateTask(id: number, input: Partial<Pick<Task, "title" | "details" | "due_date" | "remind_at" | "client_id">>): void {
  const keys = (["title", "details", "due_date", "remind_at", "client_id"] as const).filter((k) => input[k] !== undefined);
  if (!keys.length) return;
  db().prepare(`UPDATE tasks SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...input, id });
}

export function deleteTask(id: number): void {
  db().prepare("DELETE FROM tasks WHERE id = ?").run(id);
}

export function taskCounts() {
  const today = ymd();
  const row = db().prepare(`
    SELECT
      SUM(due_date < @today) AS overdue,
      SUM(due_date = @today) AS today,
      SUM(due_date > @today AND due_date <= @week) AS week,
      COUNT(*) AS open
    FROM tasks WHERE status != 'done'
  `).get({ today, week: endOfWeek() }) as Record<string, number | null>;
  const doneWeek = db().prepare(`SELECT COUNT(*) AS n FROM tasks WHERE status = 'done' AND done_at >= date('now','-6 days')`).get() as { n: number };
  return {
    overdue: row.overdue ?? 0,
    today: row.today ?? 0,
    week: row.week ?? 0,
    open: row.open ?? 0,
    doneWeek: doneWeek.n,
  };
}
