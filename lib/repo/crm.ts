// CRM клієнта: підключення, ліди/угоди, події. Ключі — не тут, а в .env.
import { db } from "../db";

export type CrmLink = { client_id: number; base_url: string; last_event_at: string | null; last_pull_at: string | null; pull_since: string | null; last_error: string; stages_json: string; summary_json: string; created_at: string };
export type CrmLead = {
  client_id: number; crm_id: number; contact_id: number | null; meta_lead_id: string; meta_ad_id: string; meta_adset_id: string; meta_campaign_id: string;
  ad_name: string; campaign_name: string; source: string; name: string; phone: string; status: string; status_raw: string;
  deal_amount: number | null; paid_amount: number | null; cost_amount: number | null; currency: string; won_at: string | null; paid_at: string | null;
  lost_reason: string; lost_comment: string; manager: string; first_contact_at: string | null; call_attempts: number; created_at: string; updated_at: string;
};

export const getCrmLink = (clientId: number) => db().prepare("SELECT * FROM crm_links WHERE client_id = ?").get(clientId) as CrmLink | undefined;
export const listCrmLinks = () => db().prepare("SELECT * FROM crm_links").all() as CrmLink[];
export function saveCrmLink(clientId: number, baseUrl: string): void {
  db().prepare(`INSERT INTO crm_links (client_id, base_url) VALUES (?, ?) ON CONFLICT(client_id) DO UPDATE SET base_url = excluded.base_url, last_error = ''`).run(clientId, baseUrl);
}
export function patchCrmLink(clientId: number, p: Partial<Omit<CrmLink, "client_id" | "created_at">>): void {
  const keys = Object.keys(p);
  if (!keys.length) return;
  db().prepare(`UPDATE crm_links SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE client_id = @client_id`).run({ ...p, client_id: clientId });
}
export const deleteCrmLink = (clientId: number) => db().prepare("DELETE FROM crm_links WHERE client_id = ?").run(clientId);

const LEAD_COLS = ["contact_id", "meta_lead_id", "meta_ad_id", "meta_adset_id", "meta_campaign_id", "ad_name", "campaign_name", "source", "name", "phone", "status", "status_raw",
  "deal_amount", "paid_amount", "cost_amount", "currency", "won_at", "paid_at", "lost_reason", "lost_comment", "manager", "first_contact_at", "call_attempts", "created_at", "updated_at"] as const;
// won_at не затираємо, якщо вже є (момент продажу); старіша версія ліда не перезаписує новішу
export function upsertCrmLead(l: CrmLead): void {
  db().prepare(`INSERT INTO crm_leads (client_id, crm_id, ${LEAD_COLS.join(", ")}) VALUES (@client_id, @crm_id, ${LEAD_COLS.map((c) => `@${c}`).join(", ")})
    ON CONFLICT(client_id, crm_id) DO UPDATE SET ${LEAD_COLS.filter((c) => c !== "won_at").map((c) => `${c} = excluded.${c}`).join(", ")},
      won_at = COALESCE(crm_leads.won_at, excluded.won_at)
    WHERE excluded.updated_at >= crm_leads.updated_at`).run(l);
}
export const getCrmLead = (clientId: number, crmId: number) => db().prepare("SELECT * FROM crm_leads WHERE client_id = ? AND crm_id = ?").get(clientId, crmId) as CrmLead | undefined;
export const crmLeads = (clientId: number) => db().prepare("SELECT * FROM crm_leads WHERE client_id = ? ORDER BY created_at DESC").all(clientId) as CrmLead[];
export const crmLeadByMeta = (metaLeadId: string) => db().prepare("SELECT * FROM crm_leads WHERE meta_lead_id = ? AND meta_lead_id <> ''").get(metaLeadId) as CrmLead | undefined;

// true — нова подія; false — уже бачили (повтор доставки)
export function addCrmEvent(e: { event_id: string; client_id: number; event: string; crm_id: number | null; summary: string; occurred_at: string }): boolean {
  return db().prepare(`INSERT OR IGNORE INTO crm_events (event_id, client_id, event, crm_id, summary, occurred_at) VALUES (@event_id, @client_id, @event, @crm_id, @summary, @occurred_at)`).run(e).changes > 0;
}
export const crmEvents = (clientId: number, limit = 20) => db().prepare("SELECT * FROM crm_events WHERE client_id = ? ORDER BY received_at DESC LIMIT ?").all(clientId, limit) as { event_id: string; event: string; crm_id: number | null; summary: string; occurred_at: string; received_at: string }[];
