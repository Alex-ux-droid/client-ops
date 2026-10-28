import { db } from "../db";

export type IdeaStatus = "new" | "used" | "dropped";
export type Idea = { id: number; client_id: number | null; text: string; status: IdeaStatus; created_at: string };
export type IdeaRow = Idea & { client_name: string | null };

export function listIdeas(opts: { clientId?: number; status?: IdeaStatus } = {}): IdeaRow[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.clientId) { where.push("i.client_id = ?"); args.push(opts.clientId); }
  if (opts.status) { where.push("i.status = ?"); args.push(opts.status); }
  return db().prepare(`
    SELECT i.*, c.name AS client_name FROM ideas i LEFT JOIN clients c ON c.id = i.client_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY i.id DESC
  `).all(...args) as IdeaRow[];
}

export function addIdea(text: string, clientId: number | null = null): number {
  return Number(db().prepare("INSERT INTO ideas (text, client_id) VALUES (?, ?)").run(text, clientId).lastInsertRowid);
}

export function setIdeaStatus(id: number, status: IdeaStatus): void {
  db().prepare("UPDATE ideas SET status = ? WHERE id = ?").run(status, id);
}
