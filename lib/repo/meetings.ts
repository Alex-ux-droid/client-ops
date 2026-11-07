// Зустрічі з клієнтом: тези під час зустрічі, потім розбір
import { db } from "../db";

export type Meeting = { id: number; client_id: number; title: string; notes: string; status: "new" | "done"; created_at: string; updated_at: string };

export const listMeetings = (clientId: number, limit = 30) => db().prepare("SELECT * FROM meetings WHERE client_id = ? ORDER BY id DESC LIMIT ?").all(clientId, limit) as Meeting[];
export const getMeeting = (id: number) => db().prepare("SELECT * FROM meetings WHERE id = ?").get(id) as Meeting | undefined;
export function saveMeeting(clientId: number, id: number, title: string, notes: string): number {
  if (id && getMeeting(id)?.client_id === clientId) {
    db().prepare("UPDATE meetings SET title = ?, notes = ?, updated_at = datetime('now') WHERE id = ?").run(title.slice(0, 200), notes, id);
    return id;
  }
  return Number(db().prepare("INSERT INTO meetings (client_id, title, notes) VALUES (?, ?, ?)").run(clientId, title.slice(0, 200), notes).lastInsertRowid);
}
export const setMeetingStatus = (id: number, status: Meeting["status"]) => db().prepare("UPDATE meetings SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
export const deleteMeeting = (id: number) => db().prepare("DELETE FROM meetings WHERE id = ?").run(id);
