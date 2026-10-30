import { db } from "../db";
import { endOfWeek, ymd } from "../dates";

export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "high" | "normal" | "low";

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
  priority: TaskPriority;
  gcal_event_id: string | null;
};

export type TaskRow = Task & { client_name: string | null; items_total: number; items_done: number; links_count: number };
export type TaskItem = { id: number; task_id: number; text: string; done: number; position: number };
export type TaskLink = { id: number; task_id: number; title: string; url: string };

const SELECT = `SELECT t.*, c.name AS client_name,
  (SELECT COUNT(*) FROM task_items i WHERE i.task_id = t.id) AS items_total,
  (SELECT COUNT(*) FROM task_items i WHERE i.task_id = t.id AND i.done = 1) AS items_done,
  (SELECT COUNT(*) FROM task_links l WHERE l.task_id = t.id) AS links_count
  FROM tasks t LEFT JOIN clients c ON c.id = t.client_id`;
const ORDER = `ORDER BY t.due_date IS NULL, t.due_date, CASE t.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, t.id`;

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

export function createTask(input: { title: string; client_id?: number | null; details?: string; due_date?: string | null; remind_at?: string | null; priority?: TaskPriority }): number {
  return Number(db().prepare(`
    INSERT INTO tasks (title, client_id, details, due_date, remind_at, priority)
    VALUES (@title, @client_id, @details, @due_date, @remind_at, @priority)
  `).run({ client_id: null, details: "", due_date: null, remind_at: null, priority: "normal", ...input }).lastInsertRowid);
}

export function setTaskStatus(id: number, status: TaskStatus): void {
  db().prepare(`UPDATE tasks SET status = ?, done_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE NULL END WHERE id = ?`)
    .run(status, status, id);
}

export function updateTask(id: number, input: Partial<Pick<Task, "title" | "details" | "due_date" | "remind_at" | "client_id" | "priority">>): void {
  const keys = (["title", "details", "due_date", "remind_at", "client_id", "priority"] as const).filter((k) => input[k] !== undefined);
  if (!keys.length) return;
  db().prepare(`UPDATE tasks SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...input, id });
}

export function createTasksBulk(titles: string[], clientId: number | null, dueDate: string | null): number {
  const ins = db().prepare("INSERT INTO tasks (title, client_id, due_date) VALUES (?, ?, ?)");
  db().transaction(() => titles.forEach((t) => ins.run(t, clientId, dueDate)))();
  return titles.length;
}

// Відкриті задачі на найближчі 7 днів, згруповані по днях (прострочені — в сьогодні)
export function weekPlan(): { date: string; tasks: TaskRow[] }[] {
  const today = ymd();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return ymd(d);
  });
  const rows = db().prepare(`${SELECT} WHERE t.status != 'done' AND t.due_date <= ? ${ORDER}`).all(days[6]) as TaskRow[];
  return days.map((date) => ({
    date,
    tasks: rows.filter((t) => (date === today ? t.due_date! <= today : t.due_date === date)),
  }));
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
  const doneToday = db().prepare(`SELECT COUNT(*) AS n FROM tasks WHERE status = 'done' AND date(done_at,'localtime') = date('now','localtime')`).get() as { n: number };
  return {
    overdue: row.overdue ?? 0,
    today: row.today ?? 0,
    week: row.week ?? 0,
    open: row.open ?? 0,
    doneWeek: doneWeek.n,
    doneToday: doneToday.n,
  };
}

// ---- Підзадачі (чекліст) і посилання задачі
export function taskItems(taskId: number): TaskItem[] {
  return db().prepare("SELECT * FROM task_items WHERE task_id = ? ORDER BY position, id").all(taskId) as TaskItem[];
}
export function addTaskItems(taskId: number, texts: string[]): void {
  const pos = (db().prepare("SELECT COALESCE(MAX(position), 0) p FROM task_items WHERE task_id = ?").get(taskId) as { p: number }).p;
  const ins = db().prepare("INSERT INTO task_items (task_id, text, position) VALUES (?, ?, ?)");
  db().transaction(() => texts.map((t) => t.trim()).filter(Boolean).forEach((t, i) => ins.run(taskId, t.slice(0, 500), pos + i + 1)))();
}
export function setTaskItem(id: number, input: { done?: boolean; text?: string }): void {
  if (input.done !== undefined) db().prepare("UPDATE task_items SET done = ? WHERE id = ?").run(input.done ? 1 : 0, id);
  if (input.text !== undefined && input.text.trim()) db().prepare("UPDATE task_items SET text = ? WHERE id = ?").run(input.text.trim().slice(0, 500), id);
}
export function deleteTaskItem(id: number): void {
  db().prepare("DELETE FROM task_items WHERE id = ?").run(id);
}
export function taskLinks(taskId: number): TaskLink[] {
  return db().prepare("SELECT * FROM task_links WHERE task_id = ? ORDER BY id").all(taskId) as TaskLink[];
}
export function addTaskLink(taskId: number, url: string, title = ""): void {
  db().prepare("INSERT INTO task_links (task_id, title, url) VALUES (?, ?, ?)").run(taskId, title.trim().slice(0, 200), url.trim());
}
export function deleteTaskLink(id: number): void {
  db().prepare("DELETE FROM task_links WHERE id = ?").run(id);
}

export function setTaskEvent(id: number, eventId: string | null): void {
  db().prepare("UPDATE tasks SET gcal_event_id = ? WHERE id = ?").run(eventId, id);
}
