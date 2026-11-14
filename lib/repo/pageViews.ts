import { db } from "../db";

// /clients/12?tab=meta → /clients/:id?tab=meta — щоб рахувати розділи, а не окремих клієнтів
export function normPath(path: string, search: string): string {
  const p = path.replace(/\/\d+(?=\/|$)/g, "/:id").slice(0, 120);
  const q = new URLSearchParams(search);
  const keep = ["tab", "v", "sv", "mv", "view"].filter((k) => q.get(k)).map((k) => `${k}=${q.get(k)}`);
  return keep.length ? `${p}?${keep.join("&")}` : p;
}
export function addView(path: string): void {
  const day = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
  db().prepare("INSERT INTO page_views (day, path, n) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET n = n + 1").run(day, path);
}
export const topViews = (days = 14) => db().prepare("SELECT path, SUM(n) n, COUNT(*) days FROM page_views WHERE day >= date('now', ?) GROUP BY path ORDER BY n DESC").all(`-${days} days`) as { path: string; n: number; days: number }[];
