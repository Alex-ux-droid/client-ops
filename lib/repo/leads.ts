// Заявки з лід-форм Meta
import { db } from "../db";

export type MetaPage = { page_id: string; name: string; client_id: number | null; client_name?: string | null; leads_on: number; last_lead_time: string | null; last_error: string; updated_at: string };
export type LeadField = { label: string; value: string };
export type Lead = {
  id: number; lead_id: string; client_id: number | null; page_id: string; form_id: string; form_name: string; ad_id: string; ad_name: string; adset_name: string; campaign_name: string;
  platform: string; created_time: string; name: string; phone: string; email: string; fields_json: string; quality: "" | "good" | "bad"; quality_by: string;
  taken_at: string | null; taken_by: string; notified_at: string | null; tg_chat_id: number | null; tg_message_id: number | null; reminded_at: string | null; created_at: string;
};

export function listPages(): MetaPage[] {
  return db().prepare("SELECT p.*, c.name AS client_name FROM meta_pages p LEFT JOIN clients c ON c.id = p.client_id ORDER BY p.name").all() as MetaPage[];
}
export function getPage(id: string): MetaPage | undefined {
  return db().prepare("SELECT * FROM meta_pages WHERE page_id = ?").get(id) as MetaPage | undefined;
}
export function upsertPage(id: string, name: string): void {
  db().prepare(`INSERT INTO meta_pages (page_id, name) VALUES (?, ?) ON CONFLICT(page_id) DO UPDATE SET name = excluded.name, updated_at = datetime('now')`).run(id, name);
}
export function setPage(id: string, patch: { client_id?: number | null; leads_on?: number; last_lead_time?: string | null; last_error?: string }): void {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (!keys.length) return;
  db().prepare(`UPDATE meta_pages SET ${keys.map((k) => `${k} = @${k}`).join(", ")}, updated_at = datetime('now') WHERE page_id = @id`).run({ ...patch, id });
}
export function upsertForm(f: { form_id: string; page_id: string; name: string; status: string; questions_json: string }): void {
  db().prepare(`INSERT INTO meta_lead_forms (form_id, page_id, name, status, questions_json) VALUES (@form_id, @page_id, @name, @status, @questions_json)
    ON CONFLICT(form_id) DO UPDATE SET name = excluded.name, status = excluded.status, questions_json = excluded.questions_json`).run(f);
}
// Клієнт за оголошенням: ad → кабінет → клієнт
export function clientByAd(adId: string): number | null {
  if (!adId) return null;
  const r = db().prepare("SELECT a.client_id FROM meta_ads d JOIN meta_accounts a ON a.account_id = d.account_id WHERE d.ad_id = ?").get(adId) as { client_id: number | null } | undefined;
  return r?.client_id ?? null;
}
export function insertLead(l: Omit<Lead, "id" | "quality" | "quality_by" | "taken_at" | "taken_by" | "tg_chat_id" | "tg_message_id" | "reminded_at" | "created_at">): number | null {
  const r = db().prepare(`INSERT OR IGNORE INTO leads (lead_id, client_id, page_id, form_id, form_name, ad_id, ad_name, adset_name, campaign_name, platform, created_time, name, phone, email, fields_json, notified_at)
    VALUES (@lead_id, @client_id, @page_id, @form_id, @form_name, @ad_id, @ad_name, @adset_name, @campaign_name, @platform, @created_time, @name, @phone, @email, @fields_json, @notified_at)`).run(l);
  return r.changes ? Number(r.lastInsertRowid) : null;
}
export function getLead(id: number): Lead | undefined {
  return db().prepare("SELECT * FROM leads WHERE id = ?").get(id) as Lead | undefined;
}
export function setLead(id: number, patch: Partial<Pick<Lead, "quality" | "quality_by" | "taken_at" | "taken_by" | "notified_at" | "tg_chat_id" | "tg_message_id" | "reminded_at">>): void {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (!keys.length) return;
  db().prepare(`UPDATE leads SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...patch, id });
}
export function clientLeads(clientId: number, days = 30, limit = 200): Lead[] {
  return db().prepare(`SELECT * FROM leads WHERE client_id = ? AND created_time >= ? ORDER BY created_time DESC LIMIT ?`)
    .all(clientId, new Date(Date.now() - days * 86400_000).toISOString(), limit) as Lead[];
}
export function leadStats(clientId: number, days: number): { total: number; good: number; bad: number; taken: number; unrated: number } {
  const r = db().prepare(`SELECT COUNT(*) total, SUM(quality = 'good') good, SUM(quality = 'bad') bad, SUM(taken_at IS NOT NULL) taken, SUM(quality = '') unrated
    FROM leads WHERE client_id = ? AND created_time >= ?`).get(clientId, new Date(Date.now() - days * 86400_000).toISOString()) as Record<string, number | null>;
  return { total: r.total ?? 0, good: r.good ?? 0, bad: r.bad ?? 0, taken: r.taken ?? 0, unrated: r.unrated ?? 0 };
}
// Заявки, на які ніхто не натиснув «Взяли» за 15 хв (тільки надіслані в групу, за добу)
export function leadsToRemind(): Lead[] {
  return db().prepare(`SELECT * FROM leads WHERE tg_chat_id IS NOT NULL AND taken_at IS NULL AND quality = '' AND reminded_at IS NULL
    AND notified_at IS NOT NULL AND notified_at != 'backfill' AND notified_at <= datetime('now', '-15 minutes') AND notified_at >= datetime('now', '-1 day')`).all() as Lead[];
}
export const leadFields = (l: Lead): LeadField[] => { try { return JSON.parse(l.fields_json) as LeadField[]; } catch { return []; } };
