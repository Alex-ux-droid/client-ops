import fs from "node:fs";
import path from "node:path";
import { db } from "../db";
import { dbPath } from "../migrate.mjs";

export type StoredFile = { id: number; name: string; mime: string; size: number; path: string; client_id: number | null; source: string; created_at: string };

const dir = () => path.join(path.dirname(dbPath()), "files");

// Зберегти файл на диск (поруч з базою) і записати в таблицю
export function saveFile(input: { name: string; mime: string; data: Buffer; client_id?: number | null; source?: string }): StoredFile {
  fs.mkdirSync(dir(), { recursive: true });
  const safe = input.name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120);
  const file = path.join(dir(), `${Date.now()}-${safe}`);
  fs.writeFileSync(file, input.data);
  const id = Number(db().prepare("INSERT INTO files (name, mime, size, path, client_id, source) VALUES (?, ?, ?, ?, ?, ?)")
    .run(safe, input.mime, input.data.length, file, input.client_id ?? null, input.source ?? "assistant").lastInsertRowid);
  return getFile(id)!;
}

export function getFile(id: number): StoredFile | undefined {
  return db().prepare("SELECT * FROM files WHERE id = ?").get(id) as StoredFile | undefined;
}

export function readFile(f: StoredFile): Buffer | null {
  try { return fs.readFileSync(f.path); } catch { return null; }
}
