import { db } from "../db";

export const DEV_KINDS = { request: "Доробити", bug: "Глюк", note: "Нюанс", error: "Помилка" } as const;
export const DEV_SOURCES = { sasha: "Саша", assistant: "Джері", system: "Система" } as const;
export type DevKind = keyof typeof DEV_KINDS;
export type DevSource = keyof typeof DEV_SOURCES;
export type DevEntry = { id: number; kind: DevKind; source: DevSource; title: string; body: string; context: string; status: "new" | "exported"; created_at: string; exported_at: string | null };

export function addDevEntry(e: { kind: DevKind; source: DevSource; title: string; body?: string; context?: string }): number {
  return Number(db().prepare("INSERT INTO dev_log (kind, source, title, body, context) VALUES (@kind, @source, @title, @body, @context)")
    .run({ body: "", context: "", ...e, title: e.title.slice(0, 300) }).lastInsertRowid);
}

// Помилка системи: одна й та сама за добу записується один раз
export function addErrorEntry(where: string, message: string): void {
  const dup = db().prepare(`SELECT 1 FROM dev_log WHERE kind = 'error' AND title = ? AND created_at > datetime('now','-1 day')`).get(`${where}: ${message}`.slice(0, 300));
  if (!dup) addDevEntry({ kind: "error", source: "system", title: `${where}: ${message}`, context: where });
}

export function listDev(status: "new" | "exported"): DevEntry[] {
  return db().prepare(`SELECT * FROM dev_log WHERE status = ? ORDER BY id ${status === "new" ? "ASC" : "DESC"} LIMIT 300`).all(status) as DevEntry[];
}

export function countNewDev(): number {
  return (db().prepare("SELECT COUNT(*) n FROM dev_log WHERE status = 'new'").get() as { n: number }).n;
}

export function markExported(ids: number[]): void {
  const st = db().prepare("UPDATE dev_log SET status = 'exported', exported_at = datetime('now') WHERE id = ?");
  db().transaction(() => ids.forEach((id) => st.run(id)))();
}

export function deleteDev(id: number): void {
  db().prepare("DELETE FROM dev_log WHERE id = ?").run(id);
}

// Текст для Claude: markdown з усіма новими записами
export function exportMarkdown(entries: DevEntry[], meta: { commit: string | null; counts: Record<string, number> }): string {
  const date = new Date().toISOString().slice(0, 16).replace("T", " ");
  const head = [
    `# Журнал client-ops · ${date}`,
    "",
    `Версія: ${meta.commit ?? "?"} · записів: ${entries.length} · у базі: ${Object.entries(meta.counts).map(([k, v]) => `${k} ${v}`).join(", ")}`,
    "",
    "Для Claude: це запити й спостереження з робочої системи. Записи від «Джері» (помічника) — його думки, перевір перед тим як робити. Пиши Саші коротко, що зроблено і що ні.",
    "",
  ];
  const groups = (Object.keys(DEV_KINDS) as DevKind[]).map((k) => {
    const items = entries.filter((e) => e.kind === k);
    if (!items.length) return "";
    return [`## ${DEV_KINDS[k]} (${items.length})`, "", ...items.map((e) =>
      [`### #${e.id} ${e.title}`, `_${DEV_SOURCES[e.source]} · ${e.created_at.slice(0, 16)}${e.context ? ` · ${e.context}` : ""}_`, "", e.body.trim(), ""].join("\n"))].join("\n");
  });
  return [...head, ...groups.filter(Boolean)].join("\n");
}
