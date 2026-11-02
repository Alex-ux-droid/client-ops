// Профіль спілкування з клієнтом і обіцянки клієнтам
import { db } from "../db";

export type ClientComm = { client_id: number; profile: string; source: "auto" | "manual"; messages_seen: number; updated_at: string };

export function getComm(clientId: number): ClientComm | undefined {
  return db().prepare("SELECT * FROM client_comm WHERE client_id = ?").get(clientId) as ClientComm | undefined;
}
export function saveComm(clientId: number, profile: string, source: "auto" | "manual", messagesSeen?: number): void {
  db().prepare(`INSERT INTO client_comm (client_id, profile, source, messages_seen) VALUES (?, ?, ?, ?)
    ON CONFLICT(client_id) DO UPDATE SET profile = excluded.profile, source = excluded.source,
      messages_seen = CASE WHEN excluded.messages_seen > 0 THEN excluded.messages_seen ELSE client_comm.messages_seen END, updated_at = datetime('now')`)
    .run(clientId, profile.trim(), source, messagesSeen ?? 0);
}
export function countClientTexts(clientId: number): number {
  return (db().prepare(`SELECT COUNT(*) n FROM tg_messages m JOIN tg_chats t ON t.chat_id = m.chat_id WHERE t.client_id = ? AND m.text != ''`).get(clientId) as { n: number }).n;
}

export type Promise_ = { id: number; client_id: number | null; what: string; due_date: string | null; quote: string; source: string; task_id: number | null; created_at: string };

export function addPromise(p: { client_id: number | null; what: string; due_date: string | null; quote: string; source: "group" | "draft"; task_id: number | null }): number {
  return Number(db().prepare("INSERT INTO promises (client_id, what, due_date, quote, source, task_id) VALUES (@client_id, @what, @due_date, @quote, @source, @task_id)").run(p).lastInsertRowid);
}
// Та сама обіцянка вже записана (той самий клієнт і день за останні 2 доби) — щоб текст, скопійований у групу, не задвоїв задачу
export function promiseExists(clientId: number | null, dueDate: string | null): boolean {
  return !!db().prepare(`SELECT 1 FROM promises WHERE client_id IS ? AND due_date IS ? AND created_at >= datetime('now', '-2 days')`).get(clientId, dueDate);
}
export function recentPromises(clientId: number, limit = 10): Promise_[] {
  return db().prepare("SELECT * FROM promises WHERE client_id = ? ORDER BY id DESC LIMIT ?").all(clientId, limit) as Promise_[];
}
