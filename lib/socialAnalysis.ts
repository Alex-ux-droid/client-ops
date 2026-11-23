// Аналіз акаунтів клієнта: Instagram (Graph API, бізнес-акаунт) + сторінка Facebook. Знімок у social_snapshots, розбір — askJson.
import { db } from "./db";
import { metaAll, metaGet } from "./meta";
import { getSocial } from "./repo/social";
import { getSetting, setSetting } from "./repo/settings";

export type SPost = { id: string; network: "ig" | "fb"; type: string; date: string; caption: string; url: string; thumb: string; likes: number; comments: number; reach: number | null; saves: number | null; shares: number | null; views: number | null };
export type SProfile = { name: string; followers: number | null; media: number | null };
export type Snapshot = { network: "ig" | "fb"; profile: SProfile; posts: SPost[]; error: string; fetched_at: string };

export function getSnapshot(clientId: number, network: "ig" | "fb"): Snapshot | null {
  const r = db().prepare("SELECT * FROM social_snapshots WHERE client_id = ? AND network = ?").get(clientId, network) as { profile_json: string; posts_json: string; error: string; fetched_at: string } | undefined;
  if (!r) return null;
  return { network, profile: JSON.parse(r.profile_json), posts: JSON.parse(r.posts_json), error: r.error, fetched_at: r.fetched_at };
}
function save(clientId: number, network: "ig" | "fb", profile: SProfile | null, posts: SPost[], error = "") {
  db().prepare(`INSERT INTO social_snapshots (client_id, network, profile_json, posts_json, error, fetched_at) VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(client_id, network) DO UPDATE SET profile_json = CASE WHEN excluded.error = '' THEN excluded.profile_json ELSE profile_json END, posts_json = CASE WHEN excluded.error = '' THEN excluded.posts_json ELSE posts_json END, error = excluded.error, fetched_at = excluded.fetched_at`)
    .run(clientId, network, JSON.stringify(profile ?? {}), JSON.stringify(posts), error);
}

const TYPE: Record<string, string> = { REELS: "Reels", CAROUSEL_ALBUM: "Карусель", IMAGE: "Фото", VIDEO: "Відео", STORY: "Сторіс" };

export async function igInsights(id: string, kind: string): Promise<Partial<SPost>> {
  // Набір метрик різний для типів; пробуємо повний, далі мінімальний
  const sets = kind === "REELS" ? ["reach,saved,shares,views", "reach,saved"] : ["reach,saved,shares,views", "reach,saved", "reach"];
  for (const m of sets) {
    try {
      const r = await metaGet<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(`${id}/insights`, { metric: m });
      const v = (n: string) => { const x = r.data.find((d) => d.name === n); return x ? (x.total_value?.value ?? x.values?.[0]?.value ?? null) : null; };
      return { reach: v("reach"), saves: v("saved"), shares: v("shares"), views: v("views") };
    } catch { /* наступний набір */ }
  }
  return {};
}

export async function refreshInstagram(clientId: number): Promise<void> {
  const s = getSocial(clientId);
  if (!s?.ig_id) return save(clientId, "ig", null, [], "Instagram не обрано (Контент → Налаштування)");
  try {
    const p = await metaGet<{ username?: string; followers_count?: number; media_count?: number }>(s.ig_id, { fields: "username,followers_count,media_count" });
    const media = (await metaGet<{ data: { id: string; caption?: string; media_type: string; media_product_type?: string; timestamp: string; like_count?: number; comments_count?: number; permalink: string; thumbnail_url?: string; media_url?: string }[] }>(`${s.ig_id}/media`,
      { fields: "id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink,thumbnail_url,media_url", limit: "30" })).data ?? [];
    const posts: SPost[] = [];
    for (const m of media) {
      const kind = m.media_product_type === "REELS" ? "REELS" : m.media_type;
      posts.push({ id: m.id, network: "ig", type: TYPE[kind] ?? kind, date: m.timestamp, caption: (m.caption ?? "").slice(0, 400), url: m.permalink, thumb: m.thumbnail_url ?? m.media_url ?? "",
        likes: m.like_count ?? 0, comments: m.comments_count ?? 0, reach: null, saves: null, shares: null, views: null, ...(await igInsights(m.id, kind)) });
    }
    save(clientId, "ig", { name: `@${p.username ?? s.ig_username}`, followers: p.followers_count ?? null, media: p.media_count ?? null }, posts);
  } catch (e) { save(clientId, "ig", null, [], e instanceof Error ? e.message.slice(0, 300) : "помилка"); }
}

export async function refreshFacebook(clientId: number): Promise<void> {
  const s = getSocial(clientId);
  if (!s?.page_id) return save(clientId, "fb", null, [], "Сторінку не обрано (Контент → Налаштування)");
  try {
    // Пости сторінки читаються токеном сторінки (його видає наш токен; не зберігаємо)
    const pg = await metaGet<{ name?: string; followers_count?: number; fan_count?: number; access_token?: string }>(s.page_id, { fields: "name,followers_count,fan_count,access_token" });
    const tok = pg.access_token;
    const list = await metaAll<{ id: string; message?: string; created_time: string; permalink_url?: string; full_picture?: string; shares?: { count: number }; reactions?: { summary: { total_count: number } }; comments?: { summary: { total_count: number } } }>(`${s.page_id}/posts`,
      { fields: "id,message,created_time,permalink_url,full_picture,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)", limit: "25" }, tok);
    const posts: SPost[] = list.slice(0, 25).map((m) => ({ id: m.id, network: "fb", type: m.full_picture ? "Пост з фото" : "Текст", date: m.created_time, caption: (m.message ?? "").slice(0, 400), url: m.permalink_url ?? "", thumb: m.full_picture ?? "",
      likes: m.reactions?.summary.total_count ?? 0, comments: m.comments?.summary.total_count ?? 0, reach: null, saves: null, shares: m.shares?.count ?? 0, views: null }));
    save(clientId, "fb", { name: pg.name ?? s.page_name, followers: pg.followers_count ?? pg.fan_count ?? null, media: null }, posts);
  } catch (e) { save(clientId, "fb", null, [], e instanceof Error ? e.message.slice(0, 300) : "помилка"); }
}

// Зведення: частота, середні, по форматах
export function stats(sn: Snapshot | null) {
  if (!sn) return null;
  const since30 = Date.now() - 30 * 864e5;
  const ps = sn.posts;
  const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const eng = (p: SPost) => p.likes + p.comments + (p.saves ?? 0) + (p.shares ?? 0);
  const byType = [...new Set(ps.map((p) => p.type))].map((t) => {
    const g = ps.filter((p) => p.type === t);
    return { type: t, n: g.length, reach: avg(g.map((p) => p.reach)), eng: avg(g.map(eng)), saves: avg(g.map((p) => p.saves)) };
  }).sort((a, b) => (b.reach ?? b.eng ?? 0) - (a.reach ?? a.eng ?? 0));
  const reach = avg(ps.slice(0, 12).map((p) => p.reach));
  return {
    posts30: ps.filter((p) => Date.parse(p.date) >= since30).length,
    lastDate: ps[0]?.date ?? null,
    reach, eng: avg(ps.slice(0, 12).map(eng)),
    er: sn.profile.followers && ps.length ? Math.round((ps.slice(0, 12).reduce((a, p) => a + eng(p), 0) / Math.min(12, ps.length) / sn.profile.followers) * 1000) / 10 : null,
    byType, top: [...ps].sort((a, b) => (b.reach ?? eng(b)) - (a.reach ?? eng(a))).slice(0, 3),
  };
}

export type Analysis = { at: string; summary: string; works: string[]; weak: string[]; actions: string[] };
export const getAnalysis = (clientId: number): Analysis | null => { try { return JSON.parse(getSetting(`content.analysis.${clientId}`) ?? "null"); } catch { return null; } };

export async function analyzeAccounts(clientId: number): Promise<string | null> {
  const ig = getSnapshot(clientId, "ig"), fb = getSnapshot(clientId, "fb");
  if (!ig?.posts.length && !fb?.posts.length) return "Спершу «Оновити» — потрібні пости з цифрами";
  const line = (p: SPost) => `${p.date.slice(0, 10)} · ${p.type} · охоплення ${p.reach ?? "—"} · збер. ${p.saves ?? "—"} · реп. ${p.shares ?? "—"} · лайки ${p.likes} · ком. ${p.comments} · «${p.caption.replace(/\s+/g, " ").slice(0, 120)}»`;
  const block = (sn: Snapshot | null, label: string) => sn?.posts.length ? `${label} ${sn.profile.name}, підписників ${sn.profile.followers ?? "—"}:\n${sn.posts.map(line).join("\n")}` : "";
  const sp = getSocial(clientId);
  const { askJson } = await import("./llmJson");
  const r = await askJson<Omit<Analysis, "at">>(
    "Ти SMM-аналітик для забудовника/локального бізнесу. По цифрах постів скажи коротко і конкретно, з цифрами: що заходить (формати, теми, хуки), що ні, частота. Без загальних порад. Українською. Поверни ТІЛЬКИ JSON: {\"summary\": \"1–2 речення\", \"works\": [\"до 4 пунктів\"], \"weak\": [\"до 4 пунктів\"], \"actions\": [\"рівно 3 конкретні дії на наступний місяць\"]}",
    `ДЛЯ КОГО: ${sp?.audience ?? ""}\n\n${block(ig, "INSTAGRAM")}\n\n${block(fb, "FACEBOOK")}`, { maxTokens: 2500, effort: "medium" });
  const a: Analysis = { at: new Date().toISOString(), summary: String(r.summary ?? ""), works: (r.works ?? []).map(String).slice(0, 4), weak: (r.weak ?? []).map(String).slice(0, 4), actions: (r.actions ?? []).map(String).slice(0, 3) };
  setSetting(`content.analysis.${clientId}`, JSON.stringify(a));
  return null;
}
