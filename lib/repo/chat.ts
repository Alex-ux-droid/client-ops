import { db } from "../db";

export type ChatAction = { kind: string; text: string; href?: string };
export type ChatMessage = { id: number; client_id: number | null; role: "user" | "assistant"; content: string; actions: ChatAction[]; created_at: string };

export function listChat(clientId: number | null, limit = 40): ChatMessage[] {
  const rows = db().prepare(`SELECT * FROM (SELECT * FROM chat_messages WHERE client_id IS ? ORDER BY id DESC LIMIT ?) ORDER BY id`)
    .all(clientId, limit) as (Omit<ChatMessage, "actions"> & { actions_json: string })[];
  return rows.map(({ actions_json, ...r }) => ({ ...r, actions: JSON.parse(actions_json) as ChatAction[] }));
}

export function addChat(clientId: number | null, role: "user" | "assistant", content: string, actions: ChatAction[] = []): void {
  db().prepare("INSERT INTO chat_messages (client_id, role, content, actions_json) VALUES (?, ?, ?, ?)")
    .run(clientId, role, content, JSON.stringify(actions));
}

export function clearChat(clientId: number | null): void {
  db().prepare("DELETE FROM chat_messages WHERE client_id IS ?").run(clientId);
}
