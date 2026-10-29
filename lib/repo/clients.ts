import { db } from "../db";

export const CLIENT_STATUSES = ["lead", "active", "paused", "archived"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const LEAD_STAGES = ["new", "contacted", "proposal", "negotiation"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export type Client = {
  id: number;
  name: string;
  niche: string;
  status: ClientStatus;
  stage: LeadStage;
  fee_monthly: number;
  pay_day: number;
  next_step: string;
  offer: string;
  budget: string;
  contacts: string;
  needs: string;
  client_vision: string;
  my_vision: string;
  notes: string;
  bitwarden_ref: string;
  created_at: string;
  updated_at: string;
};

export type ClientInput = Omit<Client, "id" | "created_at" | "updated_at">;

export const CLIENT_FIELDS = [
  "name", "niche", "status", "stage", "fee_monthly", "pay_day", "next_step", "offer", "budget", "contacts",
  "needs", "client_vision", "my_vision", "notes", "bitwarden_ref",
] as const;

export type ClientRow = Client & {
  open_tasks: number;
  overdue_tasks: number;
  last_work: string | null;
  debt: number;
};

const ROW_SQL = `
  SELECT c.*,
    (SELECT COUNT(*) FROM tasks t WHERE t.client_id = c.id AND t.status != 'done') AS open_tasks,
    (SELECT COUNT(*) FROM tasks t WHERE t.client_id = c.id AND t.status != 'done' AND t.due_date < date('now','localtime')) AS overdue_tasks,
    (SELECT MAX(done_at) FROM work_log w WHERE w.client_id = c.id) AS last_work,
    (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.client_id = c.id AND p.paid_at IS NULL AND p.due_date < date('now','localtime')) AS debt
  FROM clients c`;

export function listClients(): ClientRow[] {
  return db().prepare(`${ROW_SQL}
    ORDER BY CASE c.status WHEN 'active' THEN 0 WHEN 'lead' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END, c.name
  `).all() as ClientRow[];
}

export function getClientRow(id: number): ClientRow | undefined {
  return db().prepare(`${ROW_SQL} WHERE c.id = ?`).get(id) as ClientRow | undefined;
}

// Що з клієнтом не так: прострочені задачі, борг, давно без руху
export type Flag = { level: "bad" | "warn"; text: string };
export function clientFlags(c: ClientRow, today = new Date()): Flag[] {
  const flags: Flag[] = [];
  if (c.overdue_tasks) flags.push({ level: "bad", text: `${c.overdue_tasks} прострочено` });
  if (c.debt > 0) flags.push({ level: "bad", text: "борг по оплаті" });
  if (c.status === "active") {
    const days = c.last_work ? Math.floor((+today - +new Date(c.last_work)) / 86400_000) : null;
    if (days === null) flags.push({ level: "warn", text: "ще не було робіт" });
    else if (days >= 14) flags.push({ level: "warn", text: `${days} дн. без руху` });
    if (!c.open_tasks) flags.push({ level: "warn", text: "нема задач" });
  }
  if (c.status === "lead" && !c.next_step) flags.push({ level: "warn", text: "нема наступного кроку" });
  return flags;
}

export function setStage(id: number, stage: LeadStage): void {
  db().prepare("UPDATE clients SET stage = ?, updated_at = datetime('now') WHERE id = ?").run(stage, id);
}

export function setStatus(id: number, status: ClientStatus): void {
  db().prepare("UPDATE clients SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}

export function getClient(id: number): Client | undefined {
  return db().prepare("SELECT * FROM clients WHERE id = ?").get(id) as Client | undefined;
}

export function findClients(q: string): Client[] {
  return db().prepare("SELECT * FROM clients WHERE name LIKE ? OR niche LIKE ? ORDER BY name LIMIT 20")
    .all(`%${q}%`, `%${q}%`) as Client[];
}

export function createClient(input: ClientInput): number {
  const cols = CLIENT_FIELDS.join(", ");
  const vals = CLIENT_FIELDS.map((f) => "@" + f).join(", ");
  return Number(db().prepare(`INSERT INTO clients (${cols}) VALUES (${vals})`).run(input).lastInsertRowid);
}

export function updateClient(id: number, input: Partial<ClientInput>): void {
  const keys = CLIENT_FIELDS.filter((f) => input[f] !== undefined);
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = @${k}`).join(", ");
  db().prepare(`UPDATE clients SET ${set}, updated_at = datetime('now') WHERE id = @id`).run({ ...input, id });
}

export function countClientsByStatus(): Record<string, number> {
  const rows = db().prepare("SELECT status, COUNT(*) AS n FROM clients GROUP BY status").all() as { status: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}
