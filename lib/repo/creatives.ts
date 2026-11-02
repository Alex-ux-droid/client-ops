// Промпти креативів і журнал змін реклами
import { db } from "../db";

export type CreativePrompt = { id: number; client_id: number; title: string; angle: string; format: string; prompt: string; ad_ids: string; verdict: "" | "win" | "lose"; notes: string; created_at: string };
export type AdChange = { id: number; client_id: number; at: string; what: string; why: string; expect: string; result: string; created_at: string };

export function listPrompts(clientId: number, limit = 50): CreativePrompt[] {
  return db().prepare("SELECT * FROM creative_prompts WHERE client_id = ? ORDER BY id DESC LIMIT ?").all(clientId, limit) as CreativePrompt[];
}
export const getPrompt = (id: number) => db().prepare("SELECT * FROM creative_prompts WHERE id = ?").get(id) as CreativePrompt | undefined;
export function addPrompt(p: { client_id: number; title: string; angle?: string; format?: string; prompt: string; notes?: string }): number {
  return Number(db().prepare("INSERT INTO creative_prompts (client_id, title, angle, format, prompt, notes) VALUES (?, ?, ?, ?, ?, ?)").run(p.client_id, p.title.slice(0, 160), p.angle ?? "", p.format ?? "", p.prompt, p.notes ?? "").lastInsertRowid);
}
export function updatePrompt(id: number, patch: Partial<Pick<CreativePrompt, "title" | "angle" | "format" | "prompt" | "ad_ids" | "verdict" | "notes">>): void {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (keys.length) db().prepare(`UPDATE creative_prompts SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...patch, id });
}
export const deletePrompt = (id: number) => db().prepare("DELETE FROM creative_prompts WHERE id = ?").run(id);
export const adIdsOf = (p: CreativePrompt) => p.ad_ids.split(",").map((x) => x.trim()).filter(Boolean);

export function listChanges(clientId: number, limit = 50): AdChange[] {
  return db().prepare("SELECT * FROM ad_changes WHERE client_id = ? ORDER BY at DESC, id DESC LIMIT ?").all(clientId, limit) as AdChange[];
}
export const getChange = (id: number) => db().prepare("SELECT * FROM ad_changes WHERE id = ?").get(id) as AdChange | undefined;
export function addChange(c: { client_id: number; what: string; why?: string; expect?: string; at?: string }): number {
  return Number(db().prepare("INSERT INTO ad_changes (client_id, what, why, expect, at) VALUES (?, ?, ?, ?, COALESCE(?, date('now')))").run(c.client_id, c.what, c.why ?? "", c.expect ?? "", c.at ?? null).lastInsertRowid);
}
export function updateChange(id: number, patch: Partial<Pick<AdChange, "what" | "why" | "expect" | "result" | "at">>): void {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (keys.length) db().prepare(`UPDATE ad_changes SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...patch, id });
}
export const deleteChange = (id: number) => db().prepare("DELETE FROM ad_changes WHERE id = ?").run(id);
