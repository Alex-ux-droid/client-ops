import { db } from "../db";

export type ChangelogEntry = { id: number; title: string; body: string; created_at: string };

export function listChangelog(limit = 100): ChangelogEntry[] {
  return db().prepare("SELECT * FROM changelog ORDER BY created_at DESC, id DESC LIMIT ?").all(limit) as ChangelogEntry[];
}
