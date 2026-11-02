import { db } from "../db";

export type MsgTemplate = { id: number; title: string; when_hint: string; guide: string; example: string; position: number };

export function listMsgTemplates(): MsgTemplate[] {
  return db().prepare("SELECT * FROM msg_templates ORDER BY position, id").all() as MsgTemplate[];
}
export function getMsgTemplate(id: number): MsgTemplate | undefined {
  return db().prepare("SELECT * FROM msg_templates WHERE id = ?").get(id) as MsgTemplate | undefined;
}
export function saveMsgTemplate(t: { id?: number; title: string; when_hint: string; guide: string; example: string }): number {
  if (t.id) {
    db().prepare("UPDATE msg_templates SET title = ?, when_hint = ?, guide = ?, example = ?, updated_at = datetime('now') WHERE id = ?").run(t.title, t.when_hint, t.guide, t.example, t.id);
    return t.id;
  }
  const pos = (db().prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM msg_templates").get() as { p: number }).p;
  return Number(db().prepare("INSERT INTO msg_templates (title, when_hint, guide, example, position) VALUES (?, ?, ?, ?, ?)").run(t.title, t.when_hint, t.guide, t.example, pos).lastInsertRowid);
}
export function deleteMsgTemplate(id: number): void {
  db().prepare("DELETE FROM msg_templates WHERE id = ?").run(id);
}
