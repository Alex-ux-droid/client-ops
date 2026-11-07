// Центр креативів: шаблони стилю і AI-радар
import { db } from "../db";

export type CStyle = { id: number; kind: string; title: string; body: string; active: number; source: string; updated_at: string };
export type RadarItem = { id: number; title: string; source: string; url: string; what: string; how: string; hint_style_id: number | null; hint_kind: string; hint_title: string; hint_body: string; status: "new" | "accepted" | "skipped"; created_at: string;
  area: string; score: number; sent_to: string };

export const listStyles = () => db().prepare("SELECT * FROM creative_styles ORDER BY kind = 'general' DESC, kind, id").all() as CStyle[];
export const getStyle = (id: number) => db().prepare("SELECT * FROM creative_styles WHERE id = ?").get(id) as CStyle | undefined;
// Активні шаблони для формату: загальні + цього формату (feed/story беруть і «square» — статика)
export function stylesFor(format?: string): CStyle[] {
  const kinds = ["general", ...(format ? [format] : []), ...(format && ["feed", "story", "carousel"].includes(format) ? ["square"] : [])];
  return db().prepare(`SELECT * FROM creative_styles WHERE active = 1 AND kind IN (${kinds.map(() => "?").join(",")}) ORDER BY kind = 'general' DESC, id`).all(...kinds) as CStyle[];
}
export function saveStyle(s: { id?: number; kind: string; title: string; body: string; active?: boolean; source?: string }): number {
  if (s.id && getStyle(s.id)) {
    db().prepare("UPDATE creative_styles SET kind = ?, title = ?, body = ?, active = ?, updated_at = datetime('now') WHERE id = ?").run(s.kind, s.title.slice(0, 160), s.body, s.active === false ? 0 : 1, s.id);
    return s.id;
  }
  return Number(db().prepare("INSERT INTO creative_styles (kind, title, body, active, source) VALUES (?, ?, ?, ?, ?)").run(s.kind, s.title.slice(0, 160), s.body, s.active === false ? 0 : 1, s.source ?? "manual").lastInsertRowid);
}
export const deleteStyle = (id: number) => db().prepare("DELETE FROM creative_styles WHERE id = ?").run(id);

export function listRadar(status?: RadarItem["status"], limit = 60, area?: string): RadarItem[] {
  const w: string[] = [], a: unknown[] = [];
  if (status) { w.push("status = ?"); a.push(status); }
  if (area) { w.push("area = ?"); a.push(area); }
  return db().prepare(`SELECT * FROM ai_radar ${w.length ? `WHERE ${w.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ?`).all(...a, limit) as RadarItem[];
}
export const getRadar = (id: number) => db().prepare("SELECT * FROM ai_radar WHERE id = ?").get(id) as RadarItem | undefined;
export function addRadar(r: Omit<RadarItem, "id" | "status" | "created_at" | "sent_to">): number | null {
  const dup = db().prepare("SELECT id FROM ai_radar WHERE ulower(title) = ulower(?) OR (url <> '' AND url = ?)").get(r.title, r.url);
  if (dup) return null;
  return Number(db().prepare("INSERT INTO ai_radar (area, score, title, source, url, what, how, hint_style_id, hint_kind, hint_title, hint_body) VALUES (@area, @score, @title, @source, @url, @what, @how, @hint_style_id, @hint_kind, @hint_title, @hint_body)").run(r).lastInsertRowid);
}
export const setRadarStatus = (id: number, status: RadarItem["status"], sentTo = "") => db().prepare("UPDATE ai_radar SET status = ?, sent_to = ? WHERE id = ?").run(status, sentTo, id);
export const radarNewCount = (area?: string) => ((area
  ? db().prepare("SELECT COUNT(*) n FROM ai_radar WHERE status = 'new' AND area = ?").get(area)
  : db().prepare("SELECT COUNT(*) n FROM ai_radar WHERE status = 'new'").get()) as { n: number }).n;
// Що Саша взяв з радару — Джері бачить у кожній розмові (щоб радив з сьогоднішніх інструментів)
export const radarAccepted = (days = 60, limit = 12) => db().prepare("SELECT * FROM ai_radar WHERE status = 'accepted' AND created_at >= datetime('now', ?) ORDER BY score DESC, id DESC LIMIT ?").all(`-${days} days`, limit) as RadarItem[];
