// Тривога продажів з CRM клієнта: заявки, з якими ніхто не звʼязався за добу
import { crmLeads, getCrmLink, noContactLead } from "./crm";

export function crmAlerts(clientId: number): { level: "bad" | "warn"; text: string; reason?: string; kind?: "sales" }[] {
  if (!getCrmLink(clientId)) return [];
  const now = Date.now(), from = new Date(now - 30 * 86400_000).toISOString(), dayAgo = new Date(now - 86400_000).toISOString();
  const old = crmLeads(clientId).filter((l) => l.created_at >= from && l.created_at <= dayAgo);
  const stale = old.filter(noContactLead);
  if (stale.length < 2 || stale.length / old.length <= 0.2) return [];
  const pct = Math.round((stale.length / old.length) * 100);
  return [{ level: pct >= 40 ? "bad" : "warn", kind: "sales", text: `${stale.length} лід. без контакту >24 год`,
    reason: `За 30 днів: ${stale.length} з ${old.length} лідів (${pct}%) старші за добу, а в CRM нема ні контакту, ні спроби дзвінка. Джерело: CRM клієнта.` }];
}
