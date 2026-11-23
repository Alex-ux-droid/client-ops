// Instagram конкурентів через Business Discovery (наш IG-акаунт читає публічні дані чужого бізнес-акаунта):
// профіль + 25 останніх постів з лайками й коментарями (охоплення Instagram не віддає). Розбір Джері → ідеї в автоплан.
import { db } from "./db";
import { askJson } from "./llmJson";
import { metaGet } from "./meta";
import { getSetting, setSetting } from "./repo/settings";
import { getSocial } from "./repo/social";
import { getSnapshot, stats } from "./socialAnalysis";

export type CPost = { type: string; date: string; caption: string; url: string; likes: number; comments: number };
export type CAccount = { id: number; username: string; name: string; followers: number | null; media: number | null; posts: CPost[]; error: string; fetched_at: string | null };
const TYPE: Record<string, string> = { REELS: "Reels", CAROUSEL_ALBUM: "Карусель", IMAGE: "Фото", VIDEO: "Відео" };
export const normUser = (s: string) => (s.match(/instagram\.com\/([A-Za-z0-9_.]+)/i)?.[1] ?? s).replace(/^@/, "").trim().toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 30);

type Row = { id: number; username: string; profile_json: string; posts_json: string; error: string; fetched_at: string | null };
export function listCompetitorIg(clientId: number): CAccount[] {
  return (db().prepare("SELECT * FROM competitor_ig WHERE client_id = ? ORDER BY id").all(clientId) as Row[]).map((r) => {
    const p = JSON.parse(r.profile_json || "{}");
    return { id: r.id, username: r.username, name: p.name ?? "", followers: p.followers ?? null, media: p.media ?? null, posts: JSON.parse(r.posts_json || "[]"), error: r.error, fetched_at: r.fetched_at };
  });
}
export function addCompetitorIg(clientId: number, raw: string): void {
  for (const u of raw.split(/[\s,;]+/).map(normUser).filter((x) => x.length >= 2)) db().prepare("INSERT OR IGNORE INTO competitor_ig (client_id, username) VALUES (?, ?)").run(clientId, u);
}
export const removeCompetitorIg = (clientId: number, id: number) => db().prepare("DELETE FROM competitor_ig WHERE id = ? AND client_id = ?").run(id, clientId);
// Instagram-посилання з карти конкурентів (поле «сайт» / «як перевірено») — одразу в список
export function seedFromCompetitors(clientId: number): void {
  const rows = db().prepare("SELECT site || ' ' || checked t FROM competitors WHERE client_id = ? AND archived = 0").all(clientId) as { t: string }[];
  const found = rows.flatMap((r) => [...r.t.matchAll(/instagram\.com\/([A-Za-z0-9_.]+)/gi)].map((m) => m[1]));
  if (found.length) addCompetitorIg(clientId, found.join(" "));
}

export async function refreshCompetitorIg(clientId: number): Promise<string | null> {
  const s = getSocial(clientId);
  if (!s?.ig_id) return "Спершу обери Instagram клієнта (Контент → Налаштування) — через нього читаються конкуренти";
  seedFromCompetitors(clientId);
  for (const a of listCompetitorIg(clientId)) {
    try {
      const r = await metaGet<{ business_discovery?: { name?: string; followers_count?: number; media_count?: number; media?: { data: { caption?: string; like_count?: number; comments_count?: number; media_type: string; media_product_type?: string; timestamp: string; permalink: string }[] } } }>(s.ig_id,
        { fields: `business_discovery.username(${a.username}){name,followers_count,media_count,media.limit(25){caption,like_count,comments_count,media_type,media_product_type,timestamp,permalink}}` });
      const bd = r.business_discovery;
      if (!bd) throw new Error("Instagram не віддав акаунт");
      const posts: CPost[] = (bd.media?.data ?? []).map((m) => ({ type: TYPE[m.media_product_type === "REELS" ? "REELS" : m.media_type] ?? m.media_type, date: m.timestamp, caption: (m.caption ?? "").slice(0, 300), url: m.permalink, likes: m.like_count ?? 0, comments: m.comments_count ?? 0 }));
      db().prepare("UPDATE competitor_ig SET profile_json = ?, posts_json = ?, error = '', fetched_at = datetime('now') WHERE id = ?").run(JSON.stringify({ name: bd.name ?? "", followers: bd.followers_count ?? null, media: bd.media_count ?? null }), JSON.stringify(posts), a.id);
    } catch (e) {
      const m = e instanceof Error ? e.message : "помилка";
      const plain = /code 110|\(код 110\)|cannot be found|not.*business|Invalid user id/i.test(m) ? "Акаунт не знайдено або він особистий (Instagram дає дивитись лише бізнес- і автор-акаунти)" : m.slice(0, 200);
      db().prepare("UPDATE competitor_ig SET error = ?, fetched_at = datetime('now') WHERE id = ?").run(plain, a.id);
    }
  }
  return null;
}

// Зведення по акаунту: пости за 30 днів, середні реакції, ER, формати, топ
export function cstats(a: Pick<CAccount, "posts" | "followers">) {
  const ps = a.posts, eng = (p: CPost) => p.likes + p.comments;
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((x, y) => x + y, 0) / xs.length) : null);
  const byType = [...new Set(ps.map((p) => p.type))].map((t) => { const g = ps.filter((p) => p.type === t); return { type: t, n: g.length, eng: avg(g.map(eng)) }; }).sort((x, y) => (y.eng ?? 0) - (x.eng ?? 0));
  const e = avg(ps.map(eng));
  return {
    posts30: ps.filter((p) => Date.parse(p.date) >= Date.now() - 30 * 864e5).length,
    eng: e, er: e != null && a.followers ? Math.round((e / a.followers) * 1000) / 10 : null,
    byType, top: [...ps].sort((x, y) => eng(y) - eng(x)).slice(0, 3),
  };
}

export type CompReview = { at: string; summary: string; patterns: string[]; gaps: string[]; ideas: string[] };
export const getCompReview = (clientId: number): CompReview | null => { try { return JSON.parse(getSetting(`content.comp.${clientId}`) ?? "null"); } catch { return null; } };

export async function analyzeCompetitorIg(clientId: number): Promise<string | null> {
  const acc = listCompetitorIg(clientId).filter((a) => a.posts.length);
  if (!acc.length) return "Спершу додай акаунти й натисни «Оновити»";
  const our = getSnapshot(clientId, "ig"), st = stats(our);
  const line = (p: CPost) => `${p.date.slice(0, 10)} · ${p.type} · ❤ ${p.likes} · 💬 ${p.comments} · «${p.caption.replace(/\s+/g, " ").slice(0, 140)}»`;
  const block = acc.map((a) => { const c = cstats(a); return `@${a.username} (${a.name}), підписників ${a.followers ?? "—"}, постів за 30 дн. ${c.posts30}, реакцій на пост ${c.eng ?? "—"}:\n${a.posts.slice(0, 20).map(line).join("\n")}`; }).join("\n\n");
  const sp = getSocial(clientId);
  const r = await askJson<Omit<CompReview, "at">>(
    "Ти SMM-аналітик. Порівняй Instagram конкурентів з нашим акаунтом за цифрами реакцій (лайки+коментарі; охоплення чужих невідоме). Що в них стабільно заходить (формати, теми, подача, хуки, частота), чого в нас нема, і що з цього варто взяти — не копіюючи. Коротко, з цифрами й прикладами, українською. Ідеї — конкретні теми/формати постів для нас (без обіцянок і фактів, яких ми не знаємо). Поверни ТІЛЬКИ JSON: {\"summary\": \"1–2 речення\", \"patterns\": [\"до 4: що в них заходить\"], \"gaps\": [\"до 3: чого в нас нема\"], \"ideas\": [\"рівно 5 ідей постів для нас\"]}",
    `МИ: ${our?.profile.name ?? "—"}, підписників ${our?.profile.followers ?? "—"}, постів за 30 дн. ${st?.posts30 ?? "—"}, реакцій на пост ${st?.eng ?? "—"}, формати: ${(st?.byType ?? []).map((t) => `${t.type} ${t.eng ?? "—"}`).join(", ")}\nДЛЯ КОГО: ${sp?.audience ?? ""}\n\nКОНКУРЕНТИ:\n${block}`,
    { maxTokens: 2500, effort: "medium" });
  setSetting(`content.comp.${clientId}`, JSON.stringify({ at: new Date().toISOString(), summary: String(r.summary ?? ""), patterns: (r.patterns ?? []).map(String).slice(0, 4), gaps: (r.gaps ?? []).map(String).slice(0, 3), ideas: (r.ideas ?? []).map(String).slice(0, 5) }));
  return null;
}
