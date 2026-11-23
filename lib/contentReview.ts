// Цифри наших опублікованих постів (Instagram insights) і тижневий розбір: що зайшло → у наступний автоплан.
import { db } from "./db";
import { autoOn } from "./agent/caps";
import { askJson } from "./llmJson";
import { logError } from "./log";
import { updatePost, type Post } from "./repo/content";
import { getSetting, setSetting } from "./repo/settings";
import { FORMATS } from "./repo/social";
import { getSnapshot, igInsights, refreshInstagram, stats } from "./socialAnalysis";

export type Metrics = { reach: number | null; saves: number | null; shares: number | null; views: number | null; likes?: number | null; comments?: number | null; replies?: number | null };
export const metricsOf = (p: Post): Metrics | null => { try { return p.metrics_json ? JSON.parse(p.metrics_json) : null; } catch { return null; } };

async function storyInsights(id: string): Promise<Metrics> {
  const { metaGet } = await import("./meta");
  for (const m of ["reach,replies,shares,views", "reach,replies", "reach"]) {
    try {
      const r = await metaGet<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(`${id}/insights`, { metric: m });
      const v = (n: string) => { const x = r.data.find((d) => d.name === n); return x ? (x.total_value?.value ?? x.values?.[0]?.value ?? null) : null; };
      return { reach: v("reach"), saves: null, shares: v("shares"), views: v("views"), replies: v("replies") };
    } catch { /* наступний набір */ }
  }
  return { reach: null, saves: null, shares: null, views: null };
}

// Опубліковані за 8 днів: сторіс — поки живі (24 год), решта — тиждень; не частіше разу на годину
export async function refreshPostMetrics(clientId?: number): Promise<number> {
  const rows = db().prepare(`SELECT * FROM content_posts WHERE status = 'published' AND ig_media_id != '' AND published_at >= datetime('now', '-8 days')
    AND (metrics_at IS NULL OR metrics_at < datetime('now', '-55 minutes')) ${clientId ? "AND client_id = ?" : ""}`).all(...(clientId ? [clientId] : [])) as Post[];
  let n = 0;
  for (const p of rows) {
    const story = p.format === "story";
    if (story && Date.parse(`${p.published_at}`) < Date.now() - 24 * 3600_000) continue;
    try {
      const m: Metrics = story ? await storyInsights(p.ig_media_id) : { reach: null, saves: null, shares: null, views: null, ...(await igInsights(p.ig_media_id, p.format === "reel" ? "REELS" : "FEED")) };
      if (m.reach == null && metricsOf(p)) continue; // не затираємо зібране порожнім
      updatePost(p.id, p.client_id, { metrics_json: JSON.stringify(m), metrics_at: new Date().toISOString().replace("T", " ").slice(0, 19) });
      n++;
    } catch (e) { logError("content-metrics", e); }
  }
  return n;
}

export type Review = { at: string; period: string; summary: string; works: string[]; weak: string[]; next: string[] };
export const getReview = (clientId: number): Review | null => { try { return JSON.parse(getSetting(`content.review.${clientId}`) ?? "null"); } catch { return null; } };

export async function reviewWeek(clientId: number): Promise<string | null> {
  await refreshInstagram(clientId).catch(() => {});
  await refreshPostMetrics(clientId);
  const posts = db().prepare("SELECT p.*, pl.name pillar FROM content_posts p LEFT JOIN content_pillars pl ON pl.id = p.pillar_id WHERE p.client_id = ? AND p.status = 'published' AND p.published_at >= datetime('now', '-14 days') ORDER BY p.published_at")
    .all(clientId) as (Post & { pillar: string | null })[];
  if (!posts.length) return "За 2 тижні не було опублікованих постів — розбирати нічого";
  const st = stats(getSnapshot(clientId, "ig"));
  const line = (p: Post & { pillar: string | null }) => { const m = metricsOf(p); return `${p.published_at?.slice(0, 10)} · ${FORMATS[p.format]} · ${p.pillar ?? "—"} · «${p.topic}» · хук «${p.hook}» · охоплення ${m?.reach ?? "—"} · збер. ${m?.saves ?? "—"} · реп. ${m?.shares ?? "—"} · перегл. ${m?.views ?? "—"}`; };
  const r = await askJson<Omit<Review, "at" | "period">>(
    "Ти SMM-аналітик. Розбери наші пости за 2 тижні по цифрах проти середнього акаунта: які формати, рубрики, теми й хуки зайшли, які ні. Коротко, з цифрами, без загальних порад, українською. next — конкретні зміни для наступного плану (формат/рубрика/тип хука/частота), щоб їх могла виконати людина або автоплан. Поверни ТІЛЬКИ JSON: {\"summary\": \"1–2 речення\", \"works\": [\"до 3\"], \"weak\": [\"до 3\"], \"next\": [\"рівно 3\"]}",
    `СЕРЕДНЄ АКАУНТА (12 останніх): охоплення ${st?.reach ?? "—"}, по форматах: ${(st?.byType ?? []).map((t) => `${t.type} ${t.reach ?? "—"}`).join(", ")}\n\nНАШІ ПОСТИ:\n${posts.map(line).join("\n")}`,
    { maxTokens: 2000, effort: "medium" });
  const rv: Review = { at: new Date().toISOString(), period: `${posts[0].published_at?.slice(0, 10)} – ${posts.at(-1)!.published_at?.slice(0, 10)}`, summary: String(r.summary ?? ""), works: (r.works ?? []).map(String).slice(0, 3), weak: (r.weak ?? []).map(String).slice(0, 3), next: (r.next ?? []).map(String).slice(0, 3) };
  setSetting(`content.review.${clientId}`, JSON.stringify(rv));
  return null;
}

// Щохвилинний тік: цифри — раз на годину; розбір — щопонеділка після 09:00 за Києвом, раз на тиждень
export async function reviewTick(): Promise<void> {
  const hour = new Date().toISOString().slice(0, 13);
  if (getSetting("content.metrics_hour") !== hour) { setSetting("content.metrics_hour", hour); await refreshPostMetrics().catch((e) => logError("content-metrics", e)); }
  if (!autoOn("content_review")) return;
  const k = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" });
  const wd = new Date(`${k.slice(0, 10)}T12:00:00Z`).getUTCDay();
  if (wd !== 1 || k.slice(11, 13) < "09") return;
  const week = k.slice(0, 10);
  if (getSetting("content.review_week") === week) return;
  setSetting("content.review_week", week);
  const ids = (db().prepare("SELECT DISTINCT client_id FROM content_posts WHERE status = 'published' AND published_at >= datetime('now', '-14 days')").all() as { client_id: number }[]).map((r) => r.client_id);
  const { tg, tgOwner } = await import("./telegram");
  const { getClient } = await import("./repo/clients");
  // Конкуренти: оновити й розібрати всіх клієнтів, у кого вони є
  const { analyzeCompetitorIg, refreshCompetitorIg } = await import("./competitorIg");
  for (const r of db().prepare("SELECT DISTINCT client_id FROM competitor_ig").all() as { client_id: number }[]) {
    try { if (!(await refreshCompetitorIg(r.client_id))) await analyzeCompetitorIg(r.client_id); } catch (e) { logError("content-competitors", e); }
  }
  for (const id of ids) {
    try {
      if (await reviewWeek(id)) continue;
      const rv = getReview(id)!;
      await tg("sendMessage", { chat_id: tgOwner(), text: `📊 Контент · ${getClient(id)?.name ?? ""} · ${rv.period}\n${rv.summary}\n\n✅ ${rv.works.join("\n✅ ")}\n\n⚠️ ${rv.weak.join("\n⚠️ ")}\n\nДалі:\n→ ${rv.next.join("\n→ ")}`.slice(0, 4000) }).catch(() => {});
    } catch (e) { logError("content-review", e); }
  }
}
