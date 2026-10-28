import type { Database } from "better-sqlite3";
export function migrate(db: Database, dir: string): void;
export function dbPath(): string;
