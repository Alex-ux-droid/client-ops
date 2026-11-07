// Логотипи продуктів/клієнтів/стартапів (файл у `files`)
import { db } from "../db";

export const LOGO_KINDS = ["product", "client", "startup"] as const;
export type LogoKind = (typeof LOGO_KINDS)[number];
export const isLogoKind = (k: string): k is LogoKind => (LOGO_KINDS as readonly string[]).includes(k);
export const getLogo = (kind: LogoKind, id: number) => (db().prepare("SELECT file_id FROM logos WHERE kind = ? AND ref_id = ?").get(kind, id) as { file_id: number } | undefined)?.file_id ?? null;
export const logoSrc = (kind: LogoKind, id: number) => { const f = getLogo(kind, id); return f ? `/api/files/${f}` : ""; };
export function logoMap(kind: LogoKind): Map<number, string> {
  return new Map((db().prepare("SELECT ref_id, file_id FROM logos WHERE kind = ?").all(kind) as { ref_id: number; file_id: number }[]).map((r) => [r.ref_id, `/api/files/${r.file_id}`]));
}
export const setLogo = (kind: LogoKind, id: number, fileId: number) => db().prepare("INSERT INTO logos (kind, ref_id, file_id) VALUES (?, ?, ?) ON CONFLICT(kind, ref_id) DO UPDATE SET file_id = excluded.file_id, updated_at = datetime('now')").run(kind, id, fileId);
export const removeLogo = (kind: LogoKind, id: number) => db().prepare("DELETE FROM logos WHERE kind = ? AND ref_id = ?").run(kind, id);
