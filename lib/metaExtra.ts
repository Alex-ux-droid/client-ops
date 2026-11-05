// Глибші цифри Meta коротко — одне місце для Джері, розбору і екрану
import { adExtra, adsetExtra, adTrend, type MetaAd, type MetaAdset } from "./repo/meta";

const r1 = (v: number) => +v.toFixed(1);

// Відео: хук = 3-сек перегляди / покази; утримання = досмотри (ThruPlay) / 3-сек перегляди
export function adMore(a: MetaAd): Record<string, string | number> {
  const x = adExtra(a);
  const o: Record<string, string | number> = {};
  if (a.kind === "video" && x.v3s) {
    if (a.impressions_30d) o.hook_rate_pct = r1((x.v3s / a.impressions_30d) * 100);
    if (x.thru) o.hold_rate_pct = r1((x.thru / x.v3s) * 100);
    if (x.p25) o.watched_25_50_75_100 = [x.p25, x.p50 ?? 0, x.p75 ?? 0, x.p100 ?? 0].join("/");
    if (x.avg_sec) o.avg_watch_sec = r1(x.avg_sec);
  }
  if (x.purchases) { o.purchases = x.purchases; o.revenue = x.revenue ?? 0; if (a.spend_30d) o.roas = +((x.revenue ?? 0) / a.spend_30d).toFixed(2); }
  if (x.issues) o.issues = x.issues;
  const t = adTrend(a.ad_id);
  if (t.spend7 > 0) {
    if (t.cpl7 != null || t.cplPrev != null) o.cpl_7d_vs_prev = `${t.cpl7 ?? "—"} vs ${t.cplPrev ?? "—"}`;
    if (t.ctr7 != null && t.ctrPrev != null) o.ctr_7d_vs_prev = `${t.ctr7}% vs ${t.ctrPrev}%`;
  }
  return o;
}

export const adMoreText = (a: MetaAd) => {
  const o = adMore(a);
  const parts = [
    o.hook_rate_pct != null && `хук ${o.hook_rate_pct}%`, o.hold_rate_pct != null && `утримання ${o.hold_rate_pct}%`,
    o.purchases != null && `покупок ${o.purchases} на ${o.revenue}${o.roas != null ? ` (ROAS ${o.roas})` : ""}`,
    o.cpl_7d_vs_prev && `ціна ліда 7д/попер. ${o.cpl_7d_vs_prev}`, o.ctr_7d_vs_prev && `CTR 7д/попер. ${o.ctr_7d_vs_prev}`, o.issues && `⚠ ${o.issues}`,
  ].filter(Boolean);
  return parts.length ? ` · ${parts.join(", ")}` : "";
};

export function adsetMore(a: MetaAdset): Record<string, string> {
  const x = adsetExtra(a);
  return { ...(x.learning ? { learning: x.learning } : {}), ...(x.targeting ? { targeting: x.targeting } : {}) };
}
export const adsetMoreText = (a: MetaAdset) => {
  const x = adsetExtra(a);
  return [x.learning && ` · ${x.learning}`, x.targeting && ` · таргет: ${x.targeting}`].filter(Boolean).join("");
};
