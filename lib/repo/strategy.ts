// Стратегія клієнта: конспект, частини екосистеми, план/хроніка/знання/рішення/ідеї
import { db } from "../db";

export const PART_KINDS = { build: "Будуємо", service: "Надаємо", tool: "Сервіси й інтеграції" } as const;
export type PartKind = keyof typeof PART_KINDS;
export const PART_STATUS = { plan: "план", building: "будуємо", live: "працює", improving: "покращуємо", paused: "пауза" } as const;
export type PartStatus = keyof typeof PART_STATUS;
export const HORIZONS = { week: "Цей тиждень", month: "Цей місяць", later: "Далі / масштабування", done: "Зроблено" } as const;
export type Horizon = keyof typeof HORIZONS;
export const ITEM_KINDS = ["plan", "log", "knowledge", "decision", "idea"] as const;
export type SItemKind = (typeof ITEM_KINDS)[number];
export const KNOW_CATS = { fix: "Зламалось → виправили", integration: "Інтеграція / API", lesson: "Урок / правило" } as const;

export type Strategy = { client_id: number; where_now: string; goal: string; focus: string; insights: string; updated_at: string };
export type Part = { id: number; client_id: number; kind: PartKind; title: string; status: PartStatus; summary: string; stack: string; pros: string; cons: string; next_step: string; position: number; created_at: string; updated_at: string };
export type SItem = { id: number; client_id: number; part_id: number | null; kind: SItemKind; horizon: string; cat: string; title: string; body: string; source: string; task_id: number | null; owner: string; review_date: string | null; created_at: string; done_at: string | null };

export function getStrategy(clientId: number): Strategy {
  return (db().prepare("SELECT * FROM strategy WHERE client_id = ?").get(clientId) as Strategy | undefined)
    ?? { client_id: clientId, where_now: "", goal: "", focus: "", insights: "", updated_at: "" };
}
export function saveStrategy(clientId: number, patch: Partial<Pick<Strategy, "where_now" | "goal" | "focus" | "insights">>): void {
  const cur = getStrategy(clientId);
  const s = { ...cur, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
  db().prepare(`INSERT INTO strategy (client_id, where_now, goal, focus, insights) VALUES (@client_id, @where_now, @goal, @focus, @insights)
    ON CONFLICT(client_id) DO UPDATE SET where_now = excluded.where_now, goal = excluded.goal, focus = excluded.focus, insights = excluded.insights, updated_at = datetime('now')`)
    .run({ client_id: clientId, where_now: s.where_now, goal: s.goal, focus: s.focus, insights: s.insights });
}

export function listParts(clientId: number): Part[] {
  return db().prepare("SELECT * FROM strategy_parts WHERE client_id = ? ORDER BY position, id").all(clientId) as Part[];
}
export const getPart = (id: number) => db().prepare("SELECT * FROM strategy_parts WHERE id = ?").get(id) as Part | undefined;
export function findPart(clientId: number, title: string): Part | undefined {
  const t = title.trim().toLowerCase();
  return listParts(clientId).find((p) => p.title.trim().toLowerCase() === t) ?? listParts(clientId).find((p) => t && (p.title.toLowerCase().includes(t) || t.includes(p.title.toLowerCase())));
}
const PF = ["kind", "title", "status", "summary", "stack", "pros", "cons", "next_step", "position"] as const;
export function addPart(clientId: number, p: Partial<Pick<Part, (typeof PF)[number]>> & { title: string }): number {
  const pos = (db().prepare("SELECT COALESCE(MAX(position), 0) + 1 p FROM strategy_parts WHERE client_id = ?").get(clientId) as { p: number }).p;
  return Number(db().prepare(`INSERT INTO strategy_parts (client_id, kind, title, status, summary, stack, pros, cons, next_step, position) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(clientId, p.kind && p.kind in PART_KINDS ? p.kind : "build", p.title.slice(0, 120), p.status && p.status in PART_STATUS ? p.status : "plan", p.summary ?? "", p.stack ?? "", p.pros ?? "", p.cons ?? "", p.next_step ?? "", p.position ?? pos).lastInsertRowid);
}
export function updatePart(id: number, patch: Partial<Pick<Part, (typeof PF)[number]>>): void {
  const keys = PF.filter((k) => patch[k] !== undefined && (k !== "kind" || (patch.kind as string) in PART_KINDS) && (k !== "status" || (patch.status as string) in PART_STATUS));
  if (keys.length) db().prepare(`UPDATE strategy_parts SET ${keys.map((k) => `${k} = @${k}`).join(", ")}, updated_at = datetime('now') WHERE id = @id`).run({ ...patch, id });
}
export const deletePart = (id: number) => db().prepare("DELETE FROM strategy_parts WHERE id = ?").run(id);

export function listItems(clientId: number, opts: { kind?: SItemKind; part?: number | null; limit?: number } = {}): SItem[] {
  const w: string[] = ["client_id = ?"]; const a: unknown[] = [clientId];
  if (opts.kind) { w.push("kind = ?"); a.push(opts.kind); }
  if (opts.part !== undefined) { if (opts.part === null) w.push("part_id IS NULL"); else { w.push("part_id = ?"); a.push(opts.part); } }
  return db().prepare(`SELECT * FROM strategy_items WHERE ${w.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`).all(...a, opts.limit ?? 500) as SItem[];
}
export const getItem = (id: number) => db().prepare("SELECT * FROM strategy_items WHERE id = ?").get(id) as SItem | undefined;
export function addItem(clientId: number, i: { kind: SItemKind; title: string; body?: string; part_id?: number | null; horizon?: string; cat?: string; source?: string; owner?: string; review_date?: string | null }): number {
  return Number(db().prepare("INSERT INTO strategy_items (client_id, part_id, kind, horizon, cat, title, body, source, owner, review_date) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(clientId, i.part_id ?? null, i.kind, i.kind === "plan" ? (i.horizon && i.horizon in HORIZONS ? i.horizon : "week") : "", i.cat ?? "", i.title.slice(0, 300), i.body ?? "", i.source ?? "manual", i.owner ?? "", i.review_date || null).lastInsertRowid);
}
// Перевірка пріоритетів: висновки / тривога кажуть «обробка заявок», а план тижня — про більше лідів без пункту про обробку
const PROCESSING = /обробк|дзвін|дзвон|контакт|менеджер|crm|відповід|передзвон|реакц/i;
const MORE_LEADS = /більше лід|збільш|бюджет|масштаб|нов(і|а|у) кампан|запуст|ліди|лідів/i;
export function planConflict(clientId: number, noContactAlert: boolean): string | null {
  const s = getStrategy(clientId);
  const insightSaysProcessing = /обробк[аиу]?\s*(заяв|лід)|заявк\S*\s*не\s*обробл|не\s*(дзвон|передзвон)|без контакту|проблем\S*\s*(в|з|у)\s*обробц/i.test(s.insights);
  if (!insightSaysProcessing && !noContactAlert) return null;
  const week = listItems(clientId, { kind: "plan" }).filter((i) => i.horizon === "week");
  const more = week.filter((i) => MORE_LEADS.test(i.title) && !PROCESSING.test(i.title));
  if (!more.length || week.some((i) => PROCESSING.test(i.title))) return null;
  return `План суперечить висновку: ${insightSaysProcessing ? "у Висновках — проблема з обробкою заявок" : "горить «без контакту»"}, а на тиждень — «${more[0].title}» без жодного пункту про обробку лідів. Спершу обробка, потім більше лідів.`;
}
export function updateItem(id: number, patch: Partial<Pick<SItem, "title" | "body" | "horizon" | "cat" | "part_id" | "task_id" | "owner" | "review_date">>): void {
  const keys = (["title", "body", "horizon", "cat", "part_id", "task_id", "owner", "review_date"] as const).filter((k) => patch[k] !== undefined);
  if (!keys.length) return;
  db().prepare(`UPDATE strategy_items SET ${keys.map((k) => `${k} = @${k}`).join(", ")}${patch.horizon === "done" ? ", done_at = datetime('now')" : patch.horizon ? ", done_at = NULL" : ""} WHERE id = @id`).run({ ...patch, id });
}
export const deleteItem = (id: number) => db().prepare("DELETE FROM strategy_items WHERE id = ?").run(id);
export const lines = (s: string) => s.split("\n").map((x) => x.replace(/^\s*([-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
