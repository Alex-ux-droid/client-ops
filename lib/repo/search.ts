import { db } from "../db";

export type Hit = { kind: "client" | "task" | "idea" | "material" | "playbook" | "work"; id: number; title: string; sub: string; href: string };

// Пошук по всьому. LIKE без індексів — для однієї людини з сотнями записів цього досить.
export function searchAll(q: string, limit = 6): Hit[] {
  const like = `%${q.trim().toLowerCase()}%`;
  if (q.trim().length < 2) return [];
  const run = <T,>(sql: string, map: (r: T) => Hit) => (db().prepare(sql).all(like, like, limit) as T[]).map(map);
  type R = { id: number; a: string; b: string | null; client_id?: number | null };
  return [
    ...run<R>(`SELECT id, name a, niche b FROM clients WHERE ulower(name) LIKE ? OR ulower((niche || ' ' || offer || ' ' || needs || ' ' || notes)) LIKE ? LIMIT ?`,
      (r) => ({ kind: "client", id: r.id, title: r.a, sub: r.b || "клієнт", href: `/clients/${r.id}` })),
    ...run<R>(`SELECT t.id, t.title a, c.name b, t.client_id FROM tasks t LEFT JOIN clients c ON c.id = t.client_id WHERE ulower(t.title) LIKE ? OR ulower(t.details) LIKE ? ORDER BY t.status = 'done' LIMIT ?`,
      (r) => ({ kind: "task", id: r.id, title: r.a, sub: r.b || "задача", href: r.client_id ? `/clients/${r.client_id}?tab=tasks` : "/tasks?view=all" })),
    ...run<R>(`SELECT w.id, w.what a, c.name b, w.client_id FROM work_log w JOIN clients c ON c.id = w.client_id WHERE ulower(w.what) LIKE ? OR ulower((w.why || ' ' || w.result)) LIKE ? ORDER BY w.done_at DESC LIMIT ?`,
      (r) => ({ kind: "work", id: r.id, title: r.a, sub: r.b || "", href: `/clients/${r.client_id}?tab=history` })),
    ...run<R>(`SELECT m.id, m.title a, c.name b, m.client_id FROM materials m JOIN clients c ON c.id = m.client_id WHERE ulower(m.title) LIKE ? OR ulower(m.content) LIKE ? LIMIT ?`,
      (r) => ({ kind: "material", id: r.id, title: r.a, sub: r.b || "", href: `/clients/${r.client_id}?tab=materials` })),
    ...run<R>(`SELECT i.id, i.text a, c.name b FROM ideas i LEFT JOIN clients c ON c.id = i.client_id WHERE ulower(i.text) LIKE ? OR ulower(i.text) LIKE ? LIMIT ?`,
      (r) => ({ kind: "idea", id: r.id, title: r.a, sub: r.b || "ідея", href: "/ideas" })),
    ...run<R>(`SELECT id, title a, tags b FROM playbooks WHERE ulower(title) LIKE ? OR ulower(body_md) LIKE ? LIMIT ?`,
      (r) => ({ kind: "playbook", id: r.id, title: r.a, sub: r.b || "плейбук", href: `/playbooks/${r.id}` })),
  ];
}
