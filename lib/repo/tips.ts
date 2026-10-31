import { db } from "../db";
import { getSetting, setSetting } from "./settings";

export const TIP_TOPICS = {
  business: "Бізнес", finance: "Гроші", marketing: "Маркетинг", ads: "Реклама", sales: "Продажі",
  negotiation: "Переговори", psychology: "Психологія", term: "Термін", fact: "Факт", productivity: "Продуктивність",
} as const;
export type TipTopic = keyof typeof TIP_TOPICS;
export const isTipTopic = (t: string): t is TipTopic => t in TIP_TOPICS;
export const REACTIONS = { knew: "Знав", new: "Нове", boring: "Не цікаво", more: "Детальніше" } as const;
export type Reaction = keyof typeof REACTIONS;

export type Tip = { id: number; topic: TipTopic; title: string; body: string; source: string; shown_count: number; shown_at: string | null; reaction: Reaction | null; reacted_at: string | null; created_at: string };

// Частота показу (хв). Налаштування → «Можливості».
export const TIP_EVERY = [15, 30, 45, 60, 90, 120] as const;
export const tipEvery = () => Number(getSetting("tips.every")) || 45;

// Інтерес до теми з реакцій Саші: «нове/детальніше» піднімають, «не цікаво» сильно опускає, «знав» — трохи (рівень вищий)
export function topicScores(): Record<string, { knew: number; new: number; boring: number; more: number; score: number }> {
  const rows = db().prepare("SELECT topic, reaction, COUNT(*) n FROM tips WHERE reaction IS NOT NULL GROUP BY topic, reaction").all() as { topic: string; reaction: Reaction; n: number }[];
  const out: Record<string, { knew: number; new: number; boring: number; more: number; score: number }> = {};
  for (const t of Object.keys(TIP_TOPICS)) out[t] = { knew: 0, new: 0, boring: 0, more: 0, score: 1 };
  for (const r of rows) if (out[r.topic]) out[r.topic][r.reaction] = r.n;
  for (const v of Object.values(out)) v.score = Math.max(0.15, 1 + v.new * 0.4 + v.more * 0.6 - v.boring * 0.5 - v.knew * 0.1);
  return out;
}

export const unseenCount = () => (db().prepare("SELECT COUNT(*) n FROM tips WHERE shown_count = 0").get() as { n: number }).n;

// Наступна порада, якщо вже час (сервер тримає інтервал — щоб з двох пристроїв не сипалось удвічі)
export function nextTip(force = false): Tip | null {
  const last = Number(getSetting("tips.last_at")) || 0;
  if (!force && Date.now() - last < tipEvery() * 60_000) return null;
  const pool = db().prepare("SELECT * FROM tips WHERE shown_count = 0 ORDER BY id LIMIT 200").all() as Tip[];
  // нових нема — повторюємо ті, що були «нові/детальніше», найдавніші
  const list = pool.length ? pool : (db().prepare("SELECT * FROM tips WHERE reaction IN ('new','more') ORDER BY shown_at LIMIT 30").all() as Tip[]);
  if (!list.length) return null;
  const sc = topicScores();
  const w = list.map((t) => sc[t.topic]?.score ?? 1);
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  let tip = list[0];
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) { tip = list[i]; break; } }
  db().prepare("UPDATE tips SET shown_count = shown_count + 1, shown_at = datetime('now') WHERE id = ?").run(tip.id);
  setSetting("tips.last_at", String(Date.now()));
  return tip;
}

export function reactTip(id: number, reaction: Reaction): void {
  db().prepare("UPDATE tips SET reaction = ?, reacted_at = datetime('now') WHERE id = ?").run(reaction, id);
}

export function addTip(input: { topic: string; title: string; body: string; source?: string }): number | null {
  const title = input.title.trim().slice(0, 140), body = input.body.trim().slice(0, 900);
  if (!title || !body) return null;
  const dup = db().prepare("SELECT id FROM tips WHERE ulower(title) = ulower(?)").get(title);
  if (dup) return null;
  return Number(db().prepare("INSERT INTO tips (topic, title, body, source) VALUES (?, ?, ?, ?)")
    .run(isTipTopic(input.topic) ? input.topic : "business", title, body, input.source ?? "jerry").lastInsertRowid);
}

export function tipTitles(limit = 300): string[] {
  return (db().prepare("SELECT title FROM tips ORDER BY id DESC LIMIT ?").all(limit) as { title: string }[]).map((r) => r.title);
}

export function reactedTips(reaction: Reaction, limit = 15): { topic: string; title: string }[] {
  return db().prepare("SELECT topic, title FROM tips WHERE reaction = ? ORDER BY reacted_at DESC LIMIT ?").all(reaction, limit) as { topic: string; title: string }[];
}

export function tipStats() {
  const c = db().prepare("SELECT COUNT(*) total, SUM(shown_count > 0) shown, SUM(reaction IS NOT NULL) answered FROM tips").get() as { total: number; shown: number | null; answered: number | null };
  return { total: c.total, shown: c.shown ?? 0, answered: c.answered ?? 0, unseen: unseenCount() };
}

// Коротко для системного промпту Джері: що Сашу чіпляє, а що ні
export function tipsBlock(): string {
  const sc = Object.entries(topicScores()).filter(([, v]) => v.knew + v.new + v.boring + v.more > 0);
  if (!sc.length) return "";
  const line = sc.map(([k, v]) => `${TIP_TOPICS[k as TipTopic]}: нове ${v.new + v.more}, знав ${v.knew}, не цікаво ${v.boring}`).join("; ");
  return `Поради дня (реакції Саші по темах — підлаштовуй глибину і теми, коли пояснюєш): ${line}. Деталі — tips_stats.`;
}
