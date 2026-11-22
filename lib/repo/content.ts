import { db } from "../db";
import type { Format } from "./social";

export type Pillar = { id: number; client_id: number; name: string; goal: string; color: string; share: number; position: number; archived: number };
export type PostStatus = "idea" | "making" | "review" | "scheduled" | "published" | "failed" | "rejected";
export const POST_STATUS: Record<PostStatus, string> = { idea: "Ідея", making: "Готується", review: "На апрув", scheduled: "Заплановано", published: "Вийшло", failed: "Помилка", rejected: "Відхилено" };
export const PIPELINE: PostStatus[] = ["idea", "making", "review", "scheduled", "published"];
export type Post = { id: number; client_id: number; pillar_id: number | null; format: Format; topic: string; hook: string; caption: string; template_key: string; spec_json: string; asset_ids: string; status: PostStatus; scheduled_at: string | null; published_at: string | null; ig_media_id: string; fb_post_id: string; note: string; created_at: string; updated_at: string };
export type Asset = { id: number; client_id: number; drive_id: string; name: string; path: string; mime: string; kind: AssetKind; tags: string; size: number | null; link: string; hidden: number; used: number; modified_at: string | null };
export const ASSET_KINDS = { render: "Рендер", plan: "Планування", photo: "Фото", logo: "Лого", video: "Відео", doc: "Документ", other: "Інше" } as const;
export type AssetKind = keyof typeof ASSET_KINDS;
export type Template = { id: number; key: string; name: string; format: Format; track: "production" | "rnd"; status: "planned" | "trial" | "active" | "retired"; description: string; slots: string; version: number };
export const TPL_STATUS = { planned: "У розробці", trial: "Проба", active: "Робочий", retired: "Знятий" } as const;

// ---- Рубрики (пілари)
export const listPillars = (clientId: number) => db().prepare("SELECT * FROM content_pillars WHERE client_id = ? AND archived = 0 ORDER BY position, id").all(clientId) as Pillar[];
export function addPillar(clientId: number, p: { name: string; goal?: string; color?: string; share?: number }): void {
  const pos = (db().prepare("SELECT COALESCE(MAX(position), 0) + 1 p FROM content_pillars WHERE client_id = ?").get(clientId) as { p: number }).p;
  db().prepare("INSERT INTO content_pillars (client_id, name, goal, color, share, position) VALUES (?, ?, ?, ?, ?, ?)").run(clientId, p.name, p.goal ?? "", p.color ?? "#2d8a52", p.share ?? 20, pos);
}
export function updatePillar(id: number, clientId: number, p: Partial<Pick<Pillar, "name" | "goal" | "color" | "share" | "archived">>): void {
  const keys = (["name", "goal", "color", "share", "archived"] as const).filter((k) => p[k] !== undefined);
  if (keys.length) db().prepare(`UPDATE content_pillars SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id AND client_id = @client_id`).run({ ...p, id, client_id: clientId });
}

// ---- Тижні (тема тижня)
export const weekThemes = (clientId: number, from: string, to: string) => Object.fromEntries((db().prepare("SELECT week_start, theme FROM content_weeks WHERE client_id = ? AND week_start BETWEEN ? AND ?").all(clientId, from, to) as { week_start: string; theme: string }[]).map((r) => [r.week_start, r.theme]));
export const setWeekTheme = (clientId: number, week: string, theme: string) => db().prepare("INSERT INTO content_weeks (client_id, week_start, theme) VALUES (?, ?, ?) ON CONFLICT(client_id, week_start) DO UPDATE SET theme = excluded.theme").run(clientId, week, theme);

// ---- Пости
export const listPosts = (clientId: number) => db().prepare("SELECT * FROM content_posts WHERE client_id = ? ORDER BY COALESCE(scheduled_at, '9999'), id").all(clientId) as Post[];
export const postsBetween = (clientId: number, from: string, to: string) => db().prepare("SELECT * FROM content_posts WHERE client_id = ? AND scheduled_at >= ? AND scheduled_at < ? AND status != 'rejected' ORDER BY scheduled_at").all(clientId, from, to) as Post[];
export const getPost = (id: number) => db().prepare("SELECT * FROM content_posts WHERE id = ?").get(id) as Post | undefined;
const PF = ["pillar_id", "format", "topic", "hook", "caption", "template_key", "status", "scheduled_at", "note"] as const;
export type PostPatch = Partial<Pick<Post, (typeof PF)[number]>>;
export function addPost(clientId: number, p: PostPatch): number {
  return Number(db().prepare("INSERT INTO content_posts (client_id, pillar_id, format, topic, hook, template_key, status, scheduled_at, note) VALUES (@client_id, @pillar_id, @format, @topic, @hook, @template_key, @status, @scheduled_at, @note)")
    .run({ client_id: clientId, pillar_id: null, format: "carousel", topic: "", hook: "", template_key: "", status: "idea", scheduled_at: null, note: "", ...p }).lastInsertRowid);
}
export function updatePost(id: number, clientId: number, p: PostPatch): void {
  const keys = PF.filter((k) => p[k] !== undefined);
  if (keys.length) db().prepare(`UPDATE content_posts SET ${keys.map((k) => `${k} = @${k}`).join(", ")}, updated_at = datetime('now') WHERE id = @id AND client_id = @client_id`).run({ ...p, id, client_id: clientId });
}
export const deletePost = (id: number, clientId: number) => db().prepare("DELETE FROM content_posts WHERE id = ? AND client_id = ?").run(id, clientId);
export function statusCounts(clientId: number): Record<string, number> {
  return Object.fromEntries((db().prepare("SELECT status, COUNT(*) n FROM content_posts WHERE client_id = ? GROUP BY status").all(clientId) as { status: string; n: number }[]).map((r) => [r.status, r.n]));
}

// ---- Матеріали (з Диску)
export const listAssets = (clientId: number, withHidden = false) => db().prepare(`SELECT * FROM content_assets WHERE client_id = ? ${withHidden ? "" : "AND hidden = 0"} ORDER BY kind, path`).all(clientId) as Asset[];
export const getAsset = (id: number) => db().prepare("SELECT * FROM content_assets WHERE id = ?").get(id) as Asset | undefined;
export function upsertAsset(clientId: number, a: { drive_id: string; name: string; path: string; mime: string; kind: AssetKind; size: number | null; link: string; modified_at: string | null }): void {
  // тип і теги, які Саша поправив руками, не перезаписуємо
  db().prepare(`INSERT INTO content_assets (client_id, drive_id, name, path, mime, kind, size, link, modified_at) VALUES (@client_id, @drive_id, @name, @path, @mime, @kind, @size, @link, @modified_at)
    ON CONFLICT(client_id, drive_id) DO UPDATE SET kind = CASE WHEN kind = 'other' THEN excluded.kind ELSE kind END, name = excluded.name, path = excluded.path, mime = excluded.mime, size = excluded.size, link = excluded.link, modified_at = excluded.modified_at, synced_at = datetime('now')`).run({ ...a, client_id: clientId });
}
export function updateAsset(id: number, clientId: number, p: Partial<Pick<Asset, "kind" | "tags" | "hidden">>): void {
  const keys = (["kind", "tags", "hidden"] as const).filter((k) => p[k] !== undefined);
  if (keys.length) db().prepare(`UPDATE content_assets SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id AND client_id = @client_id`).run({ ...p, id, client_id: clientId });
}
// Зникли з папки — прибираємо (крім тих, що вже в постах)
export function pruneAssets(clientId: number, keep: string[]): number {
  const all = db().prepare("SELECT id, drive_id FROM content_assets WHERE client_id = ? AND used = 0").all(clientId) as { id: number; drive_id: string }[];
  const set = new Set(keep);
  const gone = all.filter((a) => !set.has(a.drive_id));
  for (const g of gone) db().prepare("DELETE FROM content_assets WHERE id = ?").run(g.id);
  return gone.length;
}
export const assetCounts = (clientId: number) => Object.fromEntries((db().prepare("SELECT kind, COUNT(*) n FROM content_assets WHERE client_id = ? AND hidden = 0 GROUP BY kind").all(clientId) as { kind: string; n: number }[]).map((r) => [r.kind, r.n]));

// ---- Шаблони (спільні для всіх клієнтів)
export const listTemplates = () => db().prepare("SELECT * FROM content_templates ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'trial' THEN 1 WHEN 'planned' THEN 2 ELSE 3 END, format, name").all() as Template[];
