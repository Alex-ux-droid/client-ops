// Брендбук клієнта: тексти, кольори, шрифти, файли (логотипи, гайдлайни)
import { db } from "../db";

export const BRAND_FIELDS = {
  positioning: { label: "Позиціонування", hint: "Хто клієнт і чим відрізняється від інших — 2–3 речення" },
  audience: { label: "Для кого", hint: "Хто купує: вік, ситуація, що болить, що хоче" },
  offer: { label: "Що рекламуємо", hint: "Продукт, оффер, ціни, переваги, адреса" },
  promise: { label: "Головне обіцяння", hint: "Одне речення: що клієнт отримає (УТП)" },
  tone: { label: "Тон спілкування", hint: "Як говоримо: на «ви»/«ти», спокійно/драйвово, слова, яких уникаємо" },
  rules: { label: "Можна / не можна", hint: "Обовʼязково: …\nЗаборонено: …" },
  notes: { label: "Візуальний стиль", hint: "Фото, графіка, настрій, приклади, що ще важливо" },
} as const;
export type BrandField = keyof typeof BRAND_FIELDS;
export type Brand = Record<BrandField, string> & { client_id: number; updated_at: string };
export const COLOR_ROLES = { primary: "Основний", secondary: "Другий", accent: "Акцент", background: "Фон", text: "Текст" } as const;
export const FONT_ROLES = { headings: "Заголовки", body: "Текст", accent: "Акцент" } as const;
export const ASSET_KINDS = { logo: "Логотип", font: "Шрифт", guide: "Гайдлайн", photo: "Фото", other: "Інше" } as const;
export type BrandColor = { id: number; client_id: number; name: string; hex: string; role: string; position: number };
export type BrandFont = { id: number; client_id: number; name: string; role: string; url: string; note: string };
export type BrandAsset = { id: number; client_id: number; kind: string; title: string; file_id: number | null; url: string; note: string; created_at: string; mime?: string | null; size?: number | null };

const EMPTY = (clientId: number): Brand => ({ client_id: clientId, positioning: "", audience: "", offer: "", promise: "", tone: "", rules: "", notes: "", updated_at: "" });
export const getBrand = (clientId: number): Brand => (db().prepare("SELECT * FROM brand WHERE client_id = ?").get(clientId) as Brand | undefined) ?? EMPTY(clientId);
export function saveBrand(clientId: number, patch: Partial<Record<BrandField, string>>): void {
  const keys = (Object.keys(patch) as BrandField[]).filter((k) => k in BRAND_FIELDS);
  if (!keys.length) return;
  db().prepare("INSERT OR IGNORE INTO brand (client_id) VALUES (?)").run(clientId);
  db().prepare(`UPDATE brand SET ${keys.map((k) => `${k} = @${k}`).join(", ")}, updated_at = datetime('now') WHERE client_id = @client_id`).run({ ...Object.fromEntries(keys.map((k) => [k, String(patch[k] ?? "").trim()])), client_id: clientId });
}

export const normHex = (h: string) => { const m = String(h).trim().replace(/^#?/, "#").match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i); if (!m) return null; const x = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1]; return `#${x.toUpperCase()}`; };
export const listColors = (clientId: number) => db().prepare("SELECT * FROM brand_colors WHERE client_id = ? ORDER BY position, id").all(clientId) as BrandColor[];
export function addColor(clientId: number, c: { hex: string; name?: string; role?: string }): number | null {
  const hex = normHex(c.hex); if (!hex) return null;
  if (listColors(clientId).some((x) => x.hex === hex)) return null;
  const pos = listColors(clientId).length;
  return Number(db().prepare("INSERT INTO brand_colors (client_id, name, hex, role, position) VALUES (?, ?, ?, ?, ?)").run(clientId, (c.name ?? "").slice(0, 60), hex, c.role && c.role in COLOR_ROLES ? c.role : "", pos).lastInsertRowid);
}
export const deleteColor = (id: number) => db().prepare("DELETE FROM brand_colors WHERE id = ?").run(id);

export const listFonts = (clientId: number) => db().prepare("SELECT * FROM brand_fonts WHERE client_id = ? ORDER BY id").all(clientId) as BrandFont[];
export function addFont(clientId: number, f: { name: string; role?: string; url?: string; note?: string }): number | null {
  const name = f.name.trim().slice(0, 80); if (!name) return null;
  if (listFonts(clientId).some((x) => x.name.toLowerCase() === name.toLowerCase() && x.role === (f.role ?? ""))) return null;
  return Number(db().prepare("INSERT INTO brand_fonts (client_id, name, role, url, note) VALUES (?, ?, ?, ?, ?)").run(clientId, name, f.role && f.role in FONT_ROLES ? f.role : "", (f.url ?? "").slice(0, 400), (f.note ?? "").slice(0, 300)).lastInsertRowid);
}
export const deleteFont = (id: number) => db().prepare("DELETE FROM brand_fonts WHERE id = ?").run(id);

export const listAssets = (clientId: number) => db().prepare("SELECT a.*, f.mime, f.size FROM brand_assets a LEFT JOIN files f ON f.id = a.file_id WHERE a.client_id = ? ORDER BY CASE a.kind WHEN 'logo' THEN 0 WHEN 'guide' THEN 1 WHEN 'font' THEN 2 WHEN 'photo' THEN 3 ELSE 4 END, a.id").all(clientId) as BrandAsset[];
export const getAsset = (id: number) => db().prepare("SELECT * FROM brand_assets WHERE id = ?").get(id) as BrandAsset | undefined;
export function addAsset(clientId: number, a: { kind: string; title: string; file_id?: number | null; url?: string; note?: string }): number {
  return Number(db().prepare("INSERT INTO brand_assets (client_id, kind, title, file_id, url, note) VALUES (?, ?, ?, ?, ?, ?)").run(clientId, a.kind in ASSET_KINDS ? a.kind : "other", a.title.slice(0, 160), a.file_id ?? null, (a.url ?? "").slice(0, 500), (a.note ?? "").slice(0, 300)).lastInsertRowid);
}
export const deleteAsset = (id: number) => db().prepare("DELETE FROM brand_assets WHERE id = ?").run(id);
export const brandFilled = (clientId: number) => { const b = getBrand(clientId); return (Object.keys(BRAND_FIELDS) as BrandField[]).filter((k) => b[k].trim()).length; };
