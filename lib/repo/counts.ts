import { db } from "../db";
import { ymd } from "../dates";

// Лічильники для меню
export function navCounts() {
  const today = ymd();
  const n = (sql: string, ...a: unknown[]) => (db().prepare(sql).get(...a) as { n: number }).n;
  return {
    tasks: n(`SELECT COUNT(*) n FROM tasks WHERE status != 'done' AND due_date <= ?`, today),
    leads: n(`SELECT COUNT(*) n FROM clients WHERE status = 'lead'`),
    debts: n(`SELECT COUNT(*) n FROM payments WHERE paid_at IS NULL AND due_date < ?`, today),
    ideas: n(`SELECT COUNT(*) n FROM ideas WHERE status = 'new'`),
    journal: n(`SELECT COUNT(*) n FROM dev_log WHERE status = 'new'`),
  };
}

export function clientOptions(): { id: number; name: string }[] {
  return db().prepare(`SELECT id, name FROM clients WHERE status != 'archived' ORDER BY status = 'lead', name`).all() as { id: number; name: string }[];
}
