// Шлях клієнта (дірки → червоні → жовті → зелені) і дошка-детектив Стратегії
import { db } from "../db";

export const PATH_STAGES = {
  holes: { label: "Дірки", hint: "що протікає прямо зараз — латаємо першим", n: 1 },
  red: { label: "Червоні", hint: "критичні проблеми, що гальмують результат", n: 2 },
  yellow: { label: "Жовті", hint: "важливе, але не горить", n: 3 },
  green: { label: "Зелені", hint: "працює — підкручуємо і вдосконалюємо", n: 4 },
} as const;
export type PathStage = keyof typeof PATH_STAGES;
export const PATH_STAGE_KEYS = Object.keys(PATH_STAGES) as PathStage[];
export const isPathStage = (s: string): s is PathStage => s in PATH_STAGES;
export const PATH_STATUS = { open: "треба", doing: "в роботі", done: "готово" } as const;
export type PathStatus = keyof typeof PATH_STATUS;

export type PathItem = { id: number; client_id: number; stage: PathStage; title: string; body: string; status: PathStatus; task_id: number | null; position: number; created_at: string; done_at: string | null };

export const listPath = (clientId: number) => db().prepare("SELECT * FROM strategy_path WHERE client_id = ? ORDER BY CASE stage WHEN 'holes' THEN 1 WHEN 'red' THEN 2 WHEN 'yellow' THEN 3 ELSE 4 END, status = 'done', position, id").all(clientId) as PathItem[];
export const getPathItem = (id: number) => db().prepare("SELECT * FROM strategy_path WHERE id = ?").get(id) as PathItem | undefined;
export function addPathItem(clientId: number, p: { stage: PathStage; title: string; body?: string }): number {
  const pos = (db().prepare("SELECT COALESCE(MAX(position), 0) + 1 p FROM strategy_path WHERE client_id = ? AND stage = ?").get(clientId, p.stage) as { p: number }).p;
  return Number(db().prepare("INSERT INTO strategy_path (client_id, stage, title, body, position) VALUES (?, ?, ?, ?, ?)").run(clientId, p.stage, p.title.trim(), (p.body ?? "").trim(), pos).lastInsertRowid);
}
export function updatePathItem(id: number, p: Partial<Pick<PathItem, "stage" | "title" | "body" | "status" | "task_id">>): void {
  const cur = getPathItem(id);
  if (!cur) return;
  const n = { ...cur, ...p };
  const doneAt = n.status === "done" ? cur.done_at ?? new Date().toISOString().slice(0, 19).replace("T", " ") : null;
  db().prepare("UPDATE strategy_path SET stage = ?, title = ?, body = ?, status = ?, task_id = ?, done_at = ? WHERE id = ?").run(n.stage, n.title, n.body, n.status, n.task_id, doneAt, id);
}
export const deletePathItem = (id: number) => db().prepare("DELETE FROM strategy_path WHERE id = ?").run(id);

// Де ми: перший етап, де ще є незакриті пункти
export function currentStage(items: PathItem[]): PathStage | null {
  for (const s of PATH_STAGE_KEYS) if (items.some((i) => i.stage === s && i.status !== "done")) return s;
  return null;
}

export function pathSnapshot(clientId: number): string {
  const items = listPath(clientId);
  if (!items.length) return "";
  const cur = currentStage(items);
  return `Шлях клієнта (по черзі: дірки → червоні → жовті → зелені)${cur ? `, зараз етап «${PATH_STAGES[cur].label}»` : ", усе закрито"}:\n${PATH_STAGE_KEYS.map((s) => {
    const xs = items.filter((i) => i.stage === s);
    if (!xs.length) return "";
    return `${PATH_STAGES[s].n}. ${PATH_STAGES[s].label} (${xs.filter((i) => i.status === "done").length}/${xs.length}):\n${xs.map((i) => `- [path_id ${i.id}] ${i.status === "done" ? "✓" : i.status === "doing" ? "…" : "○"} ${i.title}`).join("\n")}`;
  }).filter(Boolean).join("\n")}`;
}

// Дошка
export type BoardNode = { id: string; x: number; y: number; w: number; text: string; color: string; kind: "note" | "title" };
export type BoardEdge = { id: string; from: string; to: string; label?: string };
export type Board = { nodes: BoardNode[]; edges: BoardEdge[] };
export function getBoard(clientId: number): Board & { updated_at: string | null } {
  const r = db().prepare("SELECT data_json, updated_at FROM strategy_boards WHERE client_id = ?").get(clientId) as { data_json: string; updated_at: string } | undefined;
  if (!r) return { nodes: [], edges: [], updated_at: null };
  try { const b = JSON.parse(r.data_json) as Board; return { nodes: b.nodes ?? [], edges: b.edges ?? [], updated_at: r.updated_at }; } catch { return { nodes: [], edges: [], updated_at: r.updated_at }; }
}
export function saveBoard(clientId: number, b: Board): void {
  db().prepare("INSERT INTO strategy_boards (client_id, data_json, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(client_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at").run(clientId, JSON.stringify(b));
}
export const boardCount = (clientId: number) => getBoard(clientId).nodes.length;
