import { db } from "../db";

export type TgChat = { chat_id: number; title: string; type: string; client_id: number | null; client_name: string | null; active: number; created_at: string; last_message_at: string | null; messages: number };
export type TgMessage = { id: number; chat_id: number; message_id: number; from_id: number | null; from_name: string; is_owner: number; kind: string; text: string; file_name: string; sent_at: string };

export function upsertChat(chatId: number, title: string, type: string, active = true): void {
  db().prepare(`INSERT INTO tg_chats (chat_id, title, type, active) VALUES (?, ?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET title = excluded.title, type = excluded.type, active = excluded.active`).run(chatId, title, type, active ? 1 : 0);
}

export function knownChat(chatId: number): boolean {
  return !!db().prepare("SELECT 1 FROM tg_chats WHERE chat_id = ?").get(chatId);
}

export function listChats(): TgChat[] {
  return db().prepare(`SELECT t.*, c.name AS client_name, (SELECT COUNT(*) FROM tg_messages m WHERE m.chat_id = t.chat_id) AS messages
    FROM tg_chats t LEFT JOIN clients c ON c.id = t.client_id WHERE t.type != 'private' ORDER BY t.active DESC, t.last_message_at DESC`).all() as TgChat[];
}

export function chatsForClient(clientId: number): TgChat[] {
  return db().prepare(`SELECT t.*, c.name AS client_name, (SELECT COUNT(*) FROM tg_messages m WHERE m.chat_id = t.chat_id) AS messages
    FROM tg_chats t LEFT JOIN clients c ON c.id = t.client_id WHERE t.client_id = ? ORDER BY t.last_message_at DESC`).all(clientId) as TgChat[];
}

export function linkChat(chatId: number, clientId: number | null): void {
  db().prepare("UPDATE tg_chats SET client_id = ? WHERE chat_id = ?").run(clientId, chatId);
}

export function addMessage(m: Omit<TgMessage, "id">): number {
  const r = db().prepare(`INSERT OR IGNORE INTO tg_messages (chat_id, message_id, from_id, from_name, is_owner, kind, text, file_name, sent_at)
    VALUES (@chat_id, @message_id, @from_id, @from_name, @is_owner, @kind, @text, @file_name, @sent_at)`).run(m);
  db().prepare("UPDATE tg_chats SET last_message_at = ? WHERE chat_id = ?").run(m.sent_at, m.chat_id);
  return Number(r.lastInsertRowid);
}

export function editMessage(chatId: number, messageId: number, text: string): void {
  db().prepare("UPDATE tg_messages SET text = ? WHERE chat_id = ? AND message_id = ?").run(text, chatId, messageId);
}

export function setMessageText(id: number, text: string): void {
  db().prepare("UPDATE tg_messages SET text = ? WHERE id = ?").run(text, id);
}

// Повідомлення з усіх груп клієнта, від старих до нових
export function clientMessages(clientId: number, opts: { limit?: number; since?: string } = {}): (TgMessage & { chat_title: string })[] {
  const rows = db().prepare(`SELECT * FROM (
      SELECT m.*, t.title AS chat_title FROM tg_messages m JOIN tg_chats t ON t.chat_id = m.chat_id
      WHERE t.client_id = ? ${opts.since ? "AND m.sent_at >= ?" : ""} ORDER BY m.sent_at DESC, m.id DESC LIMIT ?
    ) ORDER BY sent_at, id`).all(...[clientId, ...(opts.since ? [opts.since] : []), opts.limit ?? 200]);
  return rows as (TgMessage & { chat_title: string })[];
}

// Імпорт історії з Telegram Desktop: тільки нові повідомлення (за id у чаті), повертає скільки додано
export function importMessages(chatId: number, msgs: Omit<TgMessage, "id" | "chat_id">[]): number {
  const ins = db().prepare(`INSERT OR IGNORE INTO tg_messages (chat_id, message_id, from_id, from_name, is_owner, kind, text, file_name, sent_at)
    VALUES (@chat_id, @message_id, @from_id, @from_name, @is_owner, @kind, @text, @file_name, @sent_at)`);
  let added = 0;
  db().transaction(() => {
    for (const m of msgs) added += ins.run({ ...m, chat_id: chatId }).changes;
    db().prepare("UPDATE tg_chats SET last_message_at = (SELECT MAX(sent_at) FROM tg_messages WHERE chat_id = ?) WHERE chat_id = ?").run(chatId, chatId);
  })();
  return added;
}

// Для перегляду: найновіші першими, з пошуком і «показати старіші»
export function clientMessagesNewest(clientId: number, opts: { limit: number; q?: string }): { rows: (TgMessage & { chat_title: string })[]; total: number } {
  const q = opts.q?.trim();
  const where = `t.client_id = ?${q ? " AND (ulower(m.text) LIKE ulower(?) OR ulower(m.from_name) LIKE ulower(?))" : ""}`;
  const args: unknown[] = [clientId, ...(q ? [`%${q}%`, `%${q}%`] : [])];
  const rows = db().prepare(`SELECT m.*, t.title AS chat_title FROM tg_messages m JOIN tg_chats t ON t.chat_id = m.chat_id
    WHERE ${where} ORDER BY m.sent_at DESC, m.id DESC LIMIT ?`).all(...args, opts.limit) as (TgMessage & { chat_title: string })[];
  const total = (db().prepare(`SELECT COUNT(*) n FROM tg_messages m JOIN tg_chats t ON t.chat_id = m.chat_id WHERE ${where}`).get(...args) as { n: number }).n;
  return { rows, total };
}
