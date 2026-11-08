// Тривога продажів з CRM клієнта: заявки, з якими ніхто не звʼязався за добу
import { crmLeads, getCrmLink, noContactLead } from "./crm";
import { kyivDay, totals, accountsForClient } from "./meta";

export function crmAlerts(clientId: number): { level: "bad" | "warn"; text: string; reason?: string; kind?: "sales" }[] {
  if (!getCrmLink(clientId)) return [];
  const now = Date.now(), from = new Date(now - 30 * 86400_000).toISOString(), dayAgo = new Date(now - 86400_000).toISOString();
  const all = crmLeads(clientId);
  const out: { level: "bad" | "warn"; text: string; reason?: string; kind?: "sales" }[] = [];
  const old = all.filter((l) => l.created_at >= from && l.created_at <= dayAgo);
  const stale = old.filter(noContactLead);
  if (stale.length >= 2 && stale.length / old.length > 0.2) {
    const pct = Math.round((stale.length / old.length) * 100);
    out.push({ level: pct >= 40 ? "bad" : "warn", kind: "sales", text: `без контакту ${stale.length} (${pct}%)`,
      reason: `За 30 днів: ${stale.length} з ${old.length} лідів (${pct}%) старші за добу, а в CRM нема ні контакту, ні спроби дзвінка. Джерело: CRM клієнта.` });
  }
  // 0 продажів за 14 днів, а реклама крутиться
  const d14 = new Date(now - 14 * 86400_000).toISOString();
  if (accountsForClient(clientId).length && !all.some((l) => l.won_at && l.won_at >= d14)) {
    const ads = totals(clientId, kyivDay(13), kyivDay(0));
    if (ads.spend > 0 && all.some((l) => l.won_at)) out.push({ level: "warn", kind: "sales", text: "0 продажів за 14 дн.", reason: `Реклама за 14 днів: витрачено ${Math.round(ads.spend)}, лідів ${ads.leads}, а продажів у CRM нема. Джерело: CRM + Meta.` });
  }
  return out;
}
