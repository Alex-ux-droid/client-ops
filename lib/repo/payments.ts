import { db } from "../db";
import { ymd } from "../dates";

export type Payment = {
  id: number;
  client_id: number;
  amount: number;
  due_date: string;
  paid_at: string | null;
  note: string;
  created_at: string;
};
export type PaymentRow = Payment & { client_name: string };

const SELECT = `SELECT p.*, c.name AS client_name FROM payments p JOIN clients c ON c.id = p.client_id`;

export function listPayments(opts: { clientId?: number; open?: boolean; month?: string } = {}): PaymentRow[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.clientId) { where.push("p.client_id = ?"); args.push(opts.clientId); }
  if (opts.open) where.push("p.paid_at IS NULL");
  if (opts.month) { where.push("(substr(p.due_date,1,7) = ? OR substr(p.paid_at,1,7) = ?)"); args.push(opts.month, opts.month); }
  return db().prepare(`${SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY p.paid_at IS NOT NULL, p.due_date DESC, p.id DESC`).all(...args) as PaymentRow[];
}

export function addPayment(input: { client_id: number; amount: number; due_date: string; paid_at?: string | null; note?: string }): number {
  return Number(db().prepare(`INSERT INTO payments (client_id, amount, due_date, paid_at, note)
    VALUES (@client_id, @amount, @due_date, @paid_at, @note)`).run({ paid_at: null, note: "", ...input }).lastInsertRowid);
}

export function markPaid(id: number, paid: boolean): void {
  db().prepare("UPDATE payments SET paid_at = ? WHERE id = ?").run(paid ? ymd() : null, id);
}

export function deletePayment(id: number): void {
  db().prepare("DELETE FROM payments WHERE id = ?").run(id);
}

// Створити очікувані оплати на місяць для всіх активних клієнтів з fee_monthly > 0 (без дублів)
export function createMonthInvoices(month: string): number {
  const clients = db().prepare(`SELECT id, fee_monthly, pay_day FROM clients WHERE status = 'active' AND fee_monthly > 0`).all() as { id: number; fee_monthly: number; pay_day: number }[];
  const exists = db().prepare(`SELECT 1 FROM payments WHERE client_id = ? AND substr(due_date,1,7) = ? AND note = 'щомісячна оплата'`);
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  let n = 0;
  db().transaction(() => {
    for (const c of clients) {
      if (exists.get(c.id, month)) continue;
      const day = String(Math.min(Math.max(c.pay_day, 1), lastDay)).padStart(2, "0");
      addPayment({ client_id: c.id, amount: c.fee_monthly, due_date: `${month}-${day}`, note: "щомісячна оплата" });
      n++;
    }
  })();
  return n;
}

export function moneySummary(month: string) {
  const today = ymd();
  const q = (sql: string, ...a: unknown[]) => ((db().prepare(sql).get(...a) as { v: number | null }).v ?? 0);
  return {
    received: q(`SELECT SUM(amount) v FROM payments WHERE substr(paid_at,1,7) = ?`, month),
    expected: q(`SELECT SUM(amount) v FROM payments WHERE paid_at IS NULL AND substr(due_date,1,7) = ? AND due_date >= ?`, month, today),
    overdue: q(`SELECT SUM(amount) v FROM payments WHERE paid_at IS NULL AND due_date < ?`, today),
    overdueCount: q(`SELECT COUNT(*) v FROM payments WHERE paid_at IS NULL AND due_date < ?`, today),
    mrr: q(`SELECT SUM(fee_monthly) v FROM clients WHERE status = 'active'`),
  };
}

// Отримано по місяцях за останні N місяців (для графіка)
export function receivedByMonth(months = 6): { month: string; total: number }[] {
  const out: { month: string; total: number }[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = months - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const month = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
    const r = db().prepare(`SELECT SUM(amount) v FROM payments WHERE substr(paid_at,1,7) = ?`).get(month) as { v: number | null };
    out.push({ month, total: r.v ?? 0 });
  }
  return out;
}
