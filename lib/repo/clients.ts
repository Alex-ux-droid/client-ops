import { db } from "../db";

export const CLIENT_STATUSES = ["lead", "active", "paused", "archived"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export type Client = {
  id: number;
  name: string;
  niche: string;
  status: ClientStatus;
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
  "name", "niche", "status", "offer", "budget", "contacts",
  "needs", "client_vision", "my_vision", "notes", "bitwarden_ref",
] as const;

export type ClientRow = Client & { open_tasks: number; last_work: string | null };

export function listClients(): ClientRow[] {
  return db().prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM tasks t WHERE t.client_id = c.id AND t.status != 'done') AS open_tasks,
      (SELECT MAX(done_at) FROM work_log w WHERE w.client_id = c.id) AS last_work
    FROM clients c
    ORDER BY CASE c.status WHEN 'active' THEN 0 WHEN 'lead' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END, c.name
  `).all() as ClientRow[];
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
