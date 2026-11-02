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
  return db().prepare(`SELECT * FROM leads WHERE EXISTS (SELECT 1 FROM lead_deliveries d WHERE d.lead_id = leads.id) AND taken_at IS NULL AND quality = '' AND reminded_at IS NULL
    AND notified_at IS NOT NULL AND notified_at != 'backfill' AND notified_at <= datetime('now', '-15 minutes') AND notified_at >= datetime('now', '-1 day')`).all() as Lead[];
}
export const leadFields = (l: Lead): LeadField[] => { try { return JSON.parse(l.fields_json) as LeadField[]; } catch { return []; } };

// ── Куди йдуть заявки клієнта, бот клієнта, доставки
export type LeadRoute = { client_id: number; to_group: number; to_bot: number; bot_username: string; bot_name: string; invite_code: string; updated_at: string };
export type LeadBotUser = { id: number; client_id: number; tg_user_id: number; name: string; active: number; created_at: string };
export type LeadDelivery = { id: number; lead_id: number; via: "main" | "client"; chat_id: number; message_id: number };

export function getRoute(clientId: number): LeadRoute {
  return (db().prepare("SELECT * FROM lead_routes WHERE client_id = ?").get(clientId) as LeadRoute | undefined)
    ?? { client_id: clientId, to_group: 1, to_bot: 0, bot_username: "", bot_name: "", invite_code: "", updated_at: "" };
}
export function saveRoute(clientId: number, patch: Partial<Omit<LeadRoute, "client_id" | "updated_at">>): void {
  const cur = getRoute(clientId);
  const r = { ...cur, ...patch };
  db().prepare(`INSERT INTO lead_routes (client_id, to_group, to_bot, bot_username, bot_name, invite_code) VALUES (@client_id, @to_group, @to_bot, @bot_username, @bot_name, @invite_code)
    ON CONFLICT(client_id) DO UPDATE SET to_group = excluded.to_group, to_bot = excluded.to_bot, bot_username = excluded.bot_username, bot_name = excluded.bot_name, invite_code = excluded.invite_code, updated_at = datetime('now')`)
    .run({ client_id: clientId, to_group: r.to_group, to_bot: r.to_bot, bot_username: r.bot_username, bot_name: r.bot_name, invite_code: r.invite_code });
}
export function botUsers(clientId: number, onlyActive = true): LeadBotUser[] {
  return db().prepare(`SELECT * FROM leadbot_users WHERE client_id = ? ${onlyActive ? "AND active = 1" : ""} ORDER BY id`).all(clientId) as LeadBotUser[];
}
export function addBotUser(clientId: number, tgUserId: number, name: string): void {
  db().prepare(`INSERT INTO leadbot_users (client_id, tg_user_id, name) VALUES (?, ?, ?)
    ON CONFLICT(client_id, tg_user_id) DO UPDATE SET name = excluded.name, active = 1`).run(clientId, tgUserId, name);
}
export function setBotUserActive(clientId: number, tgUserId: number, active: boolean): void {
  db().prepare("UPDATE leadbot_users SET active = ? WHERE client_id = ? AND tg_user_id = ?").run(active ? 1 : 0, clientId, tgUserId);
}
export function addDelivery(leadId: number, via: "main" | "client", chatId: number, messageId: number): void {
  db().prepare("INSERT INTO lead_deliveries (lead_id, via, chat_id, message_id) VALUES (?, ?, ?, ?)").run(leadId, via, chatId, messageId);
}
export function deliveries(leadId: number): LeadDelivery[] {
  return db().prepare("SELECT * FROM lead_deliveries WHERE lead_id = ?").all(leadId) as LeadDelivery[];
}
