import { db } from "../db";

export const MATERIAL_KINDS = ["chat", "ads", "brief", "other"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];
export type Material = { id: number; client_id: number; kind: MaterialKind; title: string; content: string; created_at: string };

export function listMaterials(clientId: number): Material[] {
  return db().prepare("SELECT * FROM materials WHERE client_id = ? ORDER BY id DESC").all(clientId) as Material[];
}

export function getMaterial(id: number): Material | undefined {
  return db().prepare("SELECT * FROM materials WHERE id = ?").get(id) as Material | undefined;
}

export function addMaterial(input: { client_id: number; kind: MaterialKind; title: string; content: string }): number {
  return Number(db().prepare("INSERT INTO materials (client_id, kind, title, content) VALUES (@client_id, @kind, @title, @content)").run(input).lastInsertRowid);
}

export function deleteMaterial(id: number): void {
  db().prepare("DELETE FROM materials WHERE id = ?").run(id);
}
