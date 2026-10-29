import { db } from "../db";

export type AdStat = {
  id: number;
  client_id: number;
  platform: string;
  period_start: string;
  period_end: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  sales: number;
  revenue: number;
  note: string;
  created_at: string;
};

export const AD_FIELDS = ["platform", "period_start", "period_end", "spend", "impressions", "clicks", "leads", "sales", "revenue", "note"] as const;
export type AdInput = Omit<AdStat, "id" | "created_at">;

export function listAdStats(clientId: number): AdStat[] {
  return db().prepare("SELECT * FROM ad_stats WHERE client_id = ? ORDER BY period_end, id").all(clientId) as AdStat[];
}

export function addAdStat(input: AdInput): number {
  return Number(db().prepare(`INSERT INTO ad_stats (client_id, ${AD_FIELDS.join(", ")})
    VALUES (@client_id, ${AD_FIELDS.map((f) => "@" + f).join(", ")})`).run(input).lastInsertRowid);
}

export function deleteAdStat(id: number): void {
  db().prepare("DELETE FROM ad_stats WHERE id = ?").run(id);
}

export const cpl = (s: { spend: number; leads: number }) => (s.leads ? s.spend / s.leads : null);
export const ctr = (s: { clicks: number; impressions: number }) => (s.impressions ? (s.clicks / s.impressions) * 100 : null);
export const roas = (s: { revenue: number; spend: number }) => (s.spend ? s.revenue / s.spend : null);
