import { db } from "../db";

export const STAGES = [
  { k: "raw", label: "Скринька", hint: "сира ідея, ще не розгорнута" },
  { k: "idea", label: "Ідея", hint: "розгорнули, думаємо чи варто" },
  { k: "research", label: "Дослідження", hint: "перевіряємо біль, ринок, конкурентів" },
  { k: "foundation", label: "Фундамент", hint: "рішення, архітектура, ТЗ" },
  { k: "build", label: "Будуємо", hint: "розробка за планом" },
  { k: "launch", label: "Запуск", hint: "перші користувачі" },
  { k: "grow", label: "Росте", hint: "масштабуємо" },
  { k: "paused", label: "Пауза", hint: "відклали" },
  { k: "closed", label: "Закрито", hint: "не пішло — уроки в рішеннях" },
] as const;
export type Stage = (typeof STAGES)[number]["k"];
export const FLOW: Stage[] = ["idea", "research", "foundation", "build", "launch", "grow"];

// Фундамент: опорні блоки, на яких стоїть продукт
export const CANVAS = [
  { k: "problem", label: "Біль", q: "Яку проблему закриваємо? Як люди живуть з нею зараз і скільки вона їм коштує?" },
  { k: "audience", label: "Для кого", q: "Хто саме платить і хто користується? Перший сегмент, з якого почнемо." },
  { k: "solution", label: "Рішення", q: "Що робимо? Яким буде перший мінімальний продукт (MVP)?" },
  { k: "why_us", label: "Чому ми", q: "Чому саме ми це зробимо краще: досвід, клієнти, навички, доступ." },
  { k: "money", label: "Гроші", q: "Як заробляє: модель, ціна, хто і за що платить." },
  { k: "channels", label: "Канали", q: "Як знаходимо перших клієнтів і як масштабуємо." },
  { k: "competitors", label: "Конкуренти", q: "Хто вже це робить і чим користуються зараз замість нас." },
  { k: "metrics", label: "Метрика", q: "По якій цифрі зрозуміємо, що працює (північна зірка)." },
  { k: "risks", label: "Ризики", q: "Що може вбити проєкт і як перевіримо це раніше." },
] as const;
export type CanvasKey = (typeof CANVAS)[number]["k"];

export type Startup = {
  id: number; name: string; one_liner: string; stage: Stage; north_star: string; next_step: string;
  canvas: Partial<Record<CanvasKey, string>>; spec_md: string; spec_updated_at: string | null;
  repo: string; prod_url: string; lab_id: number | null; client_id: number | null; raw_text: string; created_at: string; updated_at: string;
};
export type ItemKind = "milestone" | "experiment" | "decision" | "question" | "note" | "link";
export type StartupItem = { id: number; startup_id: number; kind: ItemKind; title: string; body: string; status: string; data: Record<string, string>; position: number; created_at: string; updated_at: string };

type Row = Omit<Startup, "canvas"> & { canvas_json: string };
const parse = (r: Row | undefined): Startup | undefined => {
  if (!r) return undefined;
  const { canvas_json, ...rest } = r;
  let canvas: Startup["canvas"] = {};
  try { canvas = JSON.parse(canvas_json); } catch {}
  return { ...rest, canvas };
};
const parseItem = (r: Omit<StartupItem, "data"> & { data_json: string }): StartupItem => {
  const { data_json, ...rest } = r;
  let data: Record<string, string> = {};
  try { data = JSON.parse(data_json); } catch {}
  return { ...rest, data };
};

export function listStartups(): (Startup & { open_tasks: number; done_tasks: number; last_activity: string | null; health: number | null })[] {
  const rows = db().prepare(`SELECT s.*,
      (SELECT COUNT(*) FROM tasks t WHERE t.startup_id = s.id AND t.status != 'done') open_tasks,
      (SELECT COUNT(*) FROM tasks t WHERE t.startup_id = s.id AND t.status = 'done') done_tasks,
      (SELECT MAX(updated_at) FROM startup_items i WHERE i.startup_id = s.id) last_item,
      (SELECT ok FROM startup_checks c WHERE c.startup_id = s.id ORDER BY at DESC LIMIT 1) health
    FROM startups s ORDER BY CASE s.stage WHEN 'closed' THEN 2 WHEN 'paused' THEN 1 ELSE 0 END, s.updated_at DESC`).all() as (Row & { open_tasks: number; done_tasks: number; last_item: string | null; health: number | null })[];
  return rows.map((r) => ({ ...parse(r)!, open_tasks: r.open_tasks, done_tasks: r.done_tasks, health: r.health, last_activity: [r.updated_at, r.last_item].filter(Boolean).sort().at(-1) ?? null }));
}

export function getStartup(id: number): Startup | undefined {
  return parse(db().prepare("SELECT * FROM startups WHERE id = ?").get(id) as Row | undefined);
}

export function createStartup(input: { name: string; one_liner?: string; stage?: Stage; raw_text?: string; lab_id?: number | null; client_id?: number | null; canvas?: Startup["canvas"] }): number {
  return Number(db().prepare(`INSERT INTO startups (name, one_liner, stage, raw_text, lab_id, client_id, canvas_json) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(input.name.slice(0, 120), input.one_liner ?? "", input.stage ?? "idea", input.raw_text ?? "", input.lab_id ?? null, input.client_id ?? null, JSON.stringify(input.canvas ?? {})).lastInsertRowid);
}

const FIELDS = ["name", "one_liner", "stage", "north_star", "next_step", "spec_md", "repo", "prod_url", "client_id"] as const;
export function updateStartup(id: number, patch: Partial<Pick<Startup, (typeof FIELDS)[number]>> & { canvas?: Startup["canvas"] }): void {
  const keys = FIELDS.filter((k) => patch[k] !== undefined);
  const sets = keys.map((k) => `${k} = @${k}`);
  const args: Record<string, unknown> = { id };
  for (const k of keys) args[k] = patch[k];
  if (patch.spec_md !== undefined) sets.push("spec_updated_at = datetime('now')");
  if (patch.canvas) {
    const cur = getStartup(id)?.canvas ?? {};
    args.canvas_json = JSON.stringify({ ...cur, ...patch.canvas });
    sets.push("canvas_json = @canvas_json");
  }
  if (!sets.length) return;
  db().prepare(`UPDATE startups SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = @id`).run(args);
}

export function deleteStartup(id: number): void {
  db().prepare("DELETE FROM startups WHERE id = ?").run(id);
}

export function listItems(startupId: number, kind?: ItemKind): StartupItem[] {
  const rows = db().prepare(`SELECT * FROM startup_items WHERE startup_id = ? ${kind ? "AND kind = ?" : ""} ORDER BY ${kind === "milestone" ? "position, id" : "created_at DESC, id DESC"}`)
    .all(...(kind ? [startupId, kind] : [startupId])) as (Omit<StartupItem, "data"> & { data_json: string })[];
  return rows.map(parseItem);
}

export function getItem(id: number): StartupItem | undefined {
  const r = db().prepare("SELECT * FROM startup_items WHERE id = ?").get(id) as (Omit<StartupItem, "data"> & { data_json: string }) | undefined;
  return r ? parseItem(r) : undefined;
}

export function addItem(startupId: number, input: { kind: ItemKind; title?: string; body?: string; status?: string; data?: Record<string, string> }): number {
  const pos = (db().prepare("SELECT COALESCE(MAX(position), 0) p FROM startup_items WHERE startup_id = ? AND kind = ?").get(startupId, input.kind) as { p: number }).p + 1;
  const id = Number(db().prepare("INSERT INTO startup_items (startup_id, kind, title, body, status, data_json, position) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(startupId, input.kind, (input.title ?? "").slice(0, 300), input.body ?? "", input.status ?? "", JSON.stringify(input.data ?? {}), pos).lastInsertRowid);
  db().prepare("UPDATE startups SET updated_at = datetime('now') WHERE id = ?").run(startupId);
  return id;
}

export function updateItem(id: number, patch: { title?: string; body?: string; status?: string; data?: Record<string, string>; position?: number }): void {
  const cur = getItem(id);
  if (!cur) return;
  db().prepare("UPDATE startup_items SET title = ?, body = ?, status = ?, data_json = ?, position = ?, updated_at = datetime('now') WHERE id = ?")
    .run(patch.title ?? cur.title, patch.body ?? cur.body, patch.status ?? cur.status, JSON.stringify({ ...cur.data, ...(patch.data ?? {}) }), patch.position ?? cur.position, id);
  db().prepare("UPDATE startups SET updated_at = datetime('now') WHERE id = ?").run(cur.startup_id);
}

export function deleteItem(id: number): void {
  db().prepare("UPDATE tasks SET milestone_id = NULL WHERE milestone_id = ?").run(id);
  db().prepare("DELETE FROM startup_items WHERE id = ?").run(id);
}

// ---- Моніторинг
export function addCheck(startupId: number, ok: boolean, status: number, ms: number): void {
  db().prepare("INSERT INTO startup_checks (startup_id, ok, status, ms) VALUES (?, ?, ?, ?)").run(startupId, ok ? 1 : 0, status, ms);
  db().prepare("DELETE FROM startup_checks WHERE startup_id = ? AND at < datetime('now', '-30 days')").run(startupId);
}
export function recentChecks(startupId: number, hours = 24): { at: string; ok: number; status: number; ms: number }[] {
  return db().prepare(`SELECT at, ok, status, ms FROM startup_checks WHERE startup_id = ? AND at >= datetime('now', ?) ORDER BY at`).all(startupId, `-${hours} hours`) as { at: string; ok: number; status: number; ms: number }[];
}
export function uptime(startupId: number, days: number): number | null {
  const r = db().prepare(`SELECT COUNT(*) n, SUM(ok) up FROM startup_checks WHERE startup_id = ? AND at >= datetime('now', ?)`).get(startupId, `-${days} days`) as { n: number; up: number | null };
  return r.n ? Math.round(((r.up ?? 0) / r.n) * 1000) / 10 : null;
}
export function monitoredStartups(): { id: number; name: string; prod_url: string }[] {
  return db().prepare("SELECT id, name, prod_url FROM startups WHERE prod_url != '' AND stage NOT IN ('closed', 'paused')").all() as { id: number; name: string; prod_url: string }[];
}

export function startupForLab(labId: number): { id: number; name: string } | undefined {
  return db().prepare("SELECT id, name FROM startups WHERE lab_id = ? ORDER BY id DESC LIMIT 1").get(labId) as { id: number; name: string } | undefined;
}
