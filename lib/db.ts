import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { dbPath, migrate } from "./migrate.mjs";

// Одне з'єднання на процес; у dev переживає hot reload через globalThis.
const g = globalThis as unknown as { __db?: Database.Database };

export function db(): Database.Database {
  if (!g.__db) {
    const file = dbPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const conn = new Database(file);
    conn.pragma("journal_mode = WAL");
    conn.pragma("foreign_keys = ON");
    // LIKE у SQLite не знає регістр кирилиці — свій lower для пошуку
    conn.function("ulower", { deterministic: true }, (v: unknown) => (typeof v === "string" ? v.toLowerCase() : v));
    migrate(conn, path.join(process.cwd(), "db", "migrations"));
    g.__db = conn;
  }
  return g.__db;
}
