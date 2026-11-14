import { db } from "../db";

export type ConfirmKind = "task_done" | "task_new" | "log" | "next_step" | "strategy";
export type ConfirmItem = { id: number; client_id: number; kind: ConfirmKind; task_id: number | null; title: string; evidence: string; status: string; created_at: string; client_name?: string };
export const CONFIRM_UA: Record<ConfirmKind, string> = { task_done: "схоже зроблено", task_new: "нове прохання", log: "в історію", next_step: "наступний крок", strategy: "оновити стратегію" };

export const pendingConfirms = (clientId?: number) => db().prepare(`SELECT q.*, c.name client_name FROM confirm_queue q JOIN clients c ON c.id = q.client_id
  WHERE q.status = 'new' ${clientId ? "AND q.client_id = ?" : ""} ORDER BY q.created_at DESC LIMIT 50`).all(...(clientId ? [clientId] : [])) as ConfirmItem[];
export const getConfirm = (id: number) => db().prepare("SELECT * FROM confirm_queue WHERE id = ?").get(id) as ConfirmItem | undefined;
export const setConfirmStatus = (id: number, status: "ok" | "skip") => db().prepare("UPDATE confirm_queue SET status = ?, decided_at = datetime('now') WHERE id = ?").run(status, id);

// Без повторів: ту саму пропозицію (клієнт + вид + задача/назва) за 14 днів не додаємо — навіть якщо Саша її відкинув
// Схожі назви («Реклама активна» і «Реклама активна, бюджет …») — одна пропозиція: перші 5 слів без чисел і знаків
export const confirmKey = (t: string) => t.toLowerCase().replace(/\d+/g, "").replace(/[^a-zа-яіїєґ ]+/gi, " ").trim().split(/\s+/).slice(0, 5).join(" ");
// Однакові або одна — початок іншої (мінімум 2 слова): «реклама активна» ≈ «реклама активна лідів»
export const confirmSimilar = (a: string, b: string) => a === b || ((a.split(" ").length >= 2 && b.startsWith(a + " ")) || (b.split(" ").length >= 2 && a.startsWith(b + " ")));
export function addConfirm(x: { client_id: number; kind: ConfirmKind; task_id?: number | null; title: string; evidence: string }): boolean {
  if (x.task_id) {
    if (db().prepare("SELECT 1 FROM confirm_queue WHERE client_id = ? AND kind = ? AND task_id = ? AND created_at >= datetime('now','-14 days')").get(x.client_id, x.kind, x.task_id)) return false;
  } else {
    const k = confirmKey(x.title);
    const near = db().prepare("SELECT title FROM confirm_queue WHERE client_id = ? AND kind = ? AND created_at >= datetime('now','-14 days')").all(x.client_id, x.kind) as { title: string }[];
    if (near.some((r) => confirmSimilar(confirmKey(r.title), k))) return false;
  }
  db().prepare("INSERT INTO confirm_queue (client_id, kind, task_id, title, evidence) VALUES (?, ?, ?, ?, ?)").run(x.client_id, x.kind, x.task_id ?? null, x.title.slice(0, 200), x.evidence.slice(0, 600));
  return true;
}

// Щодня: дублі в черзі склеюються, а те, що висить понад 3 дні, знімається (status expired).
// Прохання клієнтів (task_new) не губляться — повертаються, щоб з них зробити одну задачу «Розібрати».
export function tidyConfirms(): { dups: number; expired: number; asks: { client_id: number; titles: string[] }[] } {
  const rows = db().prepare("SELECT * FROM confirm_queue WHERE status = 'new' ORDER BY created_at DESC").all() as ConfirmItem[];
  const seen = new Map<string, string[]>();
  let dups = 0;
  for (const r of rows) {
    const g = `${r.client_id}|${r.kind}`, k = r.task_id ? `#${r.task_id}` : confirmKey(r.title);
    const ks = seen.get(g) ?? [];
    if (ks.some((x) => confirmSimilar(x, k))) { db().prepare("UPDATE confirm_queue SET status = 'dup', decided_at = datetime('now') WHERE id = ?").run(r.id); dups++; }
    else seen.set(g, [...ks, k]);
  }
  const old = db().prepare("SELECT * FROM confirm_queue WHERE status = 'new' AND created_at < datetime('now','-3 days')").all() as ConfirmItem[];
  const asks = new Map<number, string[]>();
  for (const r of old) {
    db().prepare("UPDATE confirm_queue SET status = 'expired', decided_at = datetime('now') WHERE id = ?").run(r.id);
    if (r.kind === "task_new") asks.set(r.client_id, [...(asks.get(r.client_id) ?? []), `${r.title}${r.evidence ? ` — ${r.evidence.replace(/\s+/g, " ").slice(0, 160)}` : ""}`]);
  }
  return { dups, expired: old.length, asks: [...asks].map(([client_id, titles]) => ({ client_id, titles })) };
}
