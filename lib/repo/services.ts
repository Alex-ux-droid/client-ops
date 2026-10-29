import { db } from "../db";
import { isServiceType, type ServiceType, type ToolCategory } from "../services";

export type Tool = { id: number; category: ToolCategory; name: string; url: string; notes: string };
export type ClientService = {
  id: number; client_id: number; type: ServiceType; status: "active" | "paused" | "done";
  started_at: string | null; tool_id: number | null; tool_name: string | null; tool_url: string | null;
  details: Record<string, string>; notes: string; created_at: string;
};
export type Folder = { id: number; client_id: number; kind: string; title: string; url: string };

// ---- Довідник інструментів
export function listTools(category?: ToolCategory): Tool[] {
  return (category
    ? db().prepare("SELECT * FROM tools WHERE category = ? ORDER BY name").all(category)
    : db().prepare("SELECT * FROM tools ORDER BY category, name").all()) as Tool[];
}
export function addTool(category: ToolCategory, name: string, url = ""): number {
  return Number(db().prepare("INSERT OR IGNORE INTO tools (category, name, url) VALUES (?, ?, ?)").run(category, name, url).lastInsertRowid);
}
export function deleteTool(id: number): void {
  db().prepare("DELETE FROM tools WHERE id = ?").run(id);
}
export function findToolByName(category: ToolCategory, name: string): Tool | undefined {
  return db().prepare("SELECT * FROM tools WHERE category = ? AND ulower(name) = ulower(?)").get(category, name.trim()) as Tool | undefined;
}

// ---- Послуги клієнта
type Row = Omit<ClientService, "details"> & { details_json: string };
const SELECT = `SELECT s.*, t.name AS tool_name, t.url AS tool_url FROM client_services s LEFT JOIN tools t ON t.id = s.tool_id`;
const map = ({ details_json, ...r }: Row): ClientService => ({ ...r, details: JSON.parse(details_json) as Record<string, string> });

export function listServices(clientId: number): ClientService[] {
  return (db().prepare(`${SELECT} WHERE s.client_id = ? ORDER BY s.id`).all(clientId) as Row[])
    .filter((r) => isServiceType(r.type)).map(map);
}
export function getService(clientId: number, type: ServiceType): ClientService | undefined {
  const r = db().prepare(`${SELECT} WHERE s.client_id = ? AND s.type = ?`).get(clientId, type) as Row | undefined;
  return r ? map(r) : undefined;
}
export function enableService(clientId: number, type: ServiceType, startedAt: string | null = null): void {
  db().prepare(`INSERT INTO client_services (client_id, type, started_at) VALUES (?, ?, ?)
    ON CONFLICT(client_id, type) DO UPDATE SET status = 'active'`).run(clientId, type, startedAt);
}
export function removeService(clientId: number, type: ServiceType): void {
  db().prepare("DELETE FROM client_services WHERE client_id = ? AND type = ?").run(clientId, type);
}
export function updateService(clientId: number, type: ServiceType, patch: {
  status?: ClientService["status"]; started_at?: string | null; tool_id?: number | null; details?: Record<string, string>; notes?: string;
}): void {
  const cur = getService(clientId, type);
  if (!cur) enableService(clientId, type);
  const next = { ...(cur ?? { status: "active", started_at: null, tool_id: null, details: {}, notes: "" }), ...patch };
  const details = patch.details ? { ...(cur?.details ?? {}), ...patch.details } : cur?.details ?? {};
  db().prepare(`UPDATE client_services SET status = ?, started_at = ?, tool_id = ?, details_json = ?, notes = ? WHERE client_id = ? AND type = ?`)
    .run(next.status, next.started_at, next.tool_id, JSON.stringify(details), next.notes, clientId, type);
}

// ---- Папки
export function listFolders(clientId: number): Folder[] {
  return db().prepare("SELECT * FROM client_folders WHERE client_id = ? ORDER BY id").all(clientId) as Folder[];
}
export function saveFolder(clientId: number, kind: string, title: string, url: string): void {
  db().prepare(`INSERT INTO client_folders (client_id, kind, title, url) VALUES (?, ?, ?, ?)
    ON CONFLICT(client_id, kind) DO UPDATE SET title = excluded.title, url = excluded.url`).run(clientId, kind, title, url);
}
export function deleteFolder(clientId: number, kind: string): void {
  db().prepare("DELETE FROM client_folders WHERE client_id = ? AND kind = ?").run(clientId, kind);
}
