// Конкуренти клієнта і журнал спостережень
import { db } from "../db";

export const THREAT = { high: { label: "Висока", tone: "bad" }, mid: { label: "Середня", tone: "warn" }, low: { label: "Низька", tone: "" } } as const;
export type Threat = keyof typeof THREAT | "";
export const COMP_FIELDS = {
  name: "Компанія", level: "Рівень", site: "Сайт", region: "Регіон", scale: "Масштаб", what: "Що роблять", for_whom: "Для кого", why: "Чому конкурент",
  pros: "Переваги (+)", cons: "Мінуси (−)", numbers: "Цифри / ціни", threat: "Загроза", action: "Що з цим робимо", checked: "Як перевірено",
} as const;
export type CompField = keyof typeof COMP_FIELDS;
export type Competitor = Record<CompField, string> & { id: number; client_id: number; watch: number; archived: number; checked_at: string | null; created_at: string; updated_at: string };
export type CompNote = { id: number; competitor_id: number; kind: string; text: string; url: string; source: string; created_at: string };
export const NOTE_KINDS = { note: "Нотатка", change: "Зміна", price: "Ціни", ad: "Реклама", content: "Контент", check: "Перевірка Джері" } as const;

export const normThreat = (t: string): Threat => { const s = t.trim().toLowerCase(); return /^(high|вис)/.test(s) ? "high" : /^(mid|серед)/.test(s) ? "mid" : /^(low|низ)/.test(s) ? "low" : ""; };
export const listCompetitors = (clientId: number, archived = false) =>
  db().prepare(`SELECT c.*, (SELECT MAX(created_at) FROM competitor_notes n WHERE n.competitor_id = c.id) AS last_note FROM competitors c WHERE client_id = ? AND archived = ? ORDER BY CASE threat WHEN 'high' THEN 0 WHEN 'mid' THEN 1 WHEN 'low' THEN 2 ELSE 3 END, level, name`).all(clientId, archived ? 1 : 0) as (Competitor & { last_note: string | null })[];
export const getCompetitor = (id: number) => db().prepare("SELECT * FROM competitors WHERE id = ?").get(id) as Competitor | undefined;
export const findCompetitor = (clientId: number, name: string) => db().prepare("SELECT * FROM competitors WHERE client_id = ? AND ulower(name) = ulower(?)").get(clientId, name.trim()) as Competitor | undefined;

export function saveCompetitor(clientId: number, data: Partial<Record<CompField, string>>, id?: number): number {
  const patch = Object.fromEntries(Object.entries(data).filter(([k, v]) => k in COMP_FIELDS && v != null).map(([k, v]) => [k, k === "threat" ? normThreat(String(v)) : String(v).trim()])) as Partial<Record<CompField, string>>;
  const ex = id ? getCompetitor(id) : patch.name ? findCompetitor(clientId, patch.name) : undefined;
  if (ex && ex.client_id === clientId) {
    const keys = Object.keys(patch);
    if (keys.length) db().prepare(`UPDATE competitors SET ${keys.map((k) => `${k} = @${k}`).join(", ")}, updated_at = datetime('now') WHERE id = @id`).run({ ...patch, id: ex.id });
    return ex.id;
  }
  if (!patch.name) throw new Error("Нема назви компанії");
  const keys = Object.keys(patch);
  return Number(db().prepare(`INSERT INTO competitors (client_id, ${keys.join(", ")}) VALUES (@client_id, ${keys.map((k) => `@${k}`).join(", ")})`).run({ ...patch, client_id: clientId }).lastInsertRowid);
}
export const setWatch = (id: number, on: boolean) => db().prepare("UPDATE competitors SET watch = ?, updated_at = datetime('now') WHERE id = ?").run(on ? 1 : 0, id);
export const setArchived = (id: number, on: boolean) => db().prepare("UPDATE competitors SET archived = ?, updated_at = datetime('now') WHERE id = ?").run(on ? 1 : 0, id);
export const deleteCompetitor = (id: number) => db().prepare("DELETE FROM competitors WHERE id = ?").run(id);
export const markChecked = (id: number) => db().prepare("UPDATE competitors SET checked_at = datetime('now') WHERE id = ?").run(id);

export const listNotes = (competitorId: number, limit = 50) => db().prepare("SELECT * FROM competitor_notes WHERE competitor_id = ? ORDER BY id DESC LIMIT ?").all(competitorId, limit) as CompNote[];
export const recentNotes = (clientId: number, limit = 12) => db().prepare("SELECT n.*, c.name AS comp FROM competitor_notes n JOIN competitors c ON c.id = n.competitor_id WHERE c.client_id = ? ORDER BY n.id DESC LIMIT ?").all(clientId, limit) as (CompNote & { comp: string })[];
export function addNote(competitorId: number, n: { kind?: string; text: string; url?: string; source?: string }): number {
  return Number(db().prepare("INSERT INTO competitor_notes (competitor_id, kind, text, url, source) VALUES (?, ?, ?, ?, ?)").run(competitorId, n.kind && n.kind in NOTE_KINDS ? n.kind : "note", n.text.trim(), (n.url ?? "").slice(0, 500), n.source ?? "manual").lastInsertRowid);
}
export const deleteNote = (id: number) => db().prepare("DELETE FROM competitor_notes WHERE id = ?").run(id);
// Для автонагляду: під наглядом і не перевірені 7+ днів
export const dueForCheck = (limit = 5) => db().prepare("SELECT * FROM competitors WHERE watch = 1 AND archived = 0 AND (checked_at IS NULL OR checked_at < datetime('now', '-7 days')) ORDER BY checked_at IS NOT NULL, checked_at LIMIT ?").all(limit) as Competitor[];
