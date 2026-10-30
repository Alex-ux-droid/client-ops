import { db } from "../db";

export type KbArticle = { id: number; title: string; category: string; body_md: string; created_at: string; updated_at: string };

export function listKb(q = ""): KbArticle[] {
  if (!q.trim()) return db().prepare("SELECT * FROM kb_articles ORDER BY category, title").all() as KbArticle[];
  const like = `%${q.trim()}%`;
  return db().prepare("SELECT * FROM kb_articles WHERE ulower(title) LIKE ulower(?) OR ulower(body_md) LIKE ulower(?) OR ulower(category) LIKE ulower(?) ORDER BY title")
    .all(like, like, like) as KbArticle[];
}

export function getKb(id: number): KbArticle | undefined {
  return db().prepare("SELECT * FROM kb_articles WHERE id = ?").get(id) as KbArticle | undefined;
}

export function kbCategories(): string[] {
  return (db().prepare("SELECT DISTINCT category FROM kb_articles ORDER BY category").all() as { category: string }[]).map((r) => r.category);
}

export function saveKb(input: { id?: number | null; title: string; category: string; body_md: string }): number {
  if (input.id) {
    db().prepare("UPDATE kb_articles SET title = ?, category = ?, body_md = ?, updated_at = datetime('now') WHERE id = ?")
      .run(input.title, input.category, input.body_md, input.id);
    return input.id;
  }
  return Number(db().prepare("INSERT INTO kb_articles (title, category, body_md) VALUES (?, ?, ?)").run(input.title, input.category, input.body_md).lastInsertRowid);
}

export function deleteKb(id: number): void {
  db().prepare("DELETE FROM kb_articles WHERE id = ?").run(id);
}
