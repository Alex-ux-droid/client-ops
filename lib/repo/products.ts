// Наші продукти + розвиток організації. Весь доступ до таблиць products*, org_items — тут.
import { db } from "../db";
import { getSetting, setSetting } from "./settings";

export const PRODUCT_KINDS = { app: "Програми", kit: "Набори й інструкції", service: "Послуги" } as const;
export type ProductKind = keyof typeof PRODUCT_KINDS;
export const PRODUCT_STATUS = { idea: "ідея", building: "будуємо", live: "працює", improving: "покращуємо", paused: "пауза" } as const;
export type ProductStatus = keyof typeof PRODUCT_STATUS;
export const P_KNOW = { fix: "Зламалось → виправили", integration: "Інтеграція / API", legal: "Юридичне / доступи / платежі", lesson: "Урок / правило" } as const;
export const P_ITEM_KINDS = ["log", "knowledge", "decision", "idea", "plan", "update"] as const;
export type PItemKind = (typeof P_ITEM_KINDS)[number];

export type Product = { id: number; name: string; kind: ProductKind; status: ProductStatus; summary: string; how: string; features: string; stack: string; pros: string; cons: string; next_step: string; links: string; kit_md: string; last_event_at: string | null; position: number; created_at: string; updated_at: string };
export type PItem = { id: number; product_id: number; kind: PItemKind; cat: string; title: string; body: string; done: number; source: string; created_at: string; ver: number | null };
export const PF = ["name", "kind", "status", "summary", "how", "features", "stack", "pros", "cons", "next_step", "links", "kit_md"] as const;
export type ProductPatch = Partial<Pick<Product, (typeof PF)[number]>>;

export const listProducts = () => db().prepare("SELECT * FROM products ORDER BY position, status = 'paused', name").all() as Product[];
export const getProduct = (id: number) => db().prepare("SELECT * FROM products WHERE id = ?").get(id) as Product | undefined;
export function findProduct(name: string): Product | undefined {
  const n = name.trim().toLowerCase();
  return listProducts().find((p) => p.name.toLowerCase() === n);
}
const clean = (p: ProductPatch) => Object.fromEntries(Object.entries(p).filter(([k, v]) => (PF as readonly string[]).includes(k) && v != null)) as ProductPatch;
export function addProduct(p: ProductPatch & { name: string }): number {
  const x = clean(p);
  const keys = Object.keys(x);
  return Number(db().prepare(`INSERT INTO products (${keys.join(", ")}) VALUES (${keys.map((k) => `@${k}`).join(", ")})`).run(x).lastInsertRowid);
}
export function updateProduct(id: number, p: ProductPatch): void {
  const x = clean(p);
  const keys = Object.keys(x);
  if (!keys.length) return;
  db().prepare(`UPDATE products SET ${keys.map((k) => `${k} = @${k}`).join(", ")}, updated_at = datetime('now') WHERE id = @id`).run({ ...x, id });
}
export const deleteProduct = (id: number) => db().prepare("DELETE FROM products WHERE id = ?").run(id);

export function listPItems(productId: number, kind?: PItemKind, limit = 200): PItem[] {
  return (kind
    ? db().prepare("SELECT * FROM product_items WHERE product_id = ? AND kind = ? ORDER BY id DESC LIMIT ?").all(productId, kind, limit)
    : db().prepare("SELECT * FROM product_items WHERE product_id = ? ORDER BY id DESC LIMIT ?").all(productId, limit)) as PItem[];
}
// Оновлення продукту (Оновлення 1, 2, …) і номер наступного; «старт» — чи вже був повний паспорт з витяжки
export const productUpdates = (productId: number) => db().prepare("SELECT * FROM product_items WHERE product_id = ? AND kind = 'update' ORDER BY ver, id").all(productId) as PItem[];
export const nextUpdateVer = (productId: number) => ((db().prepare("SELECT MAX(ver) v FROM product_items WHERE product_id = ? AND kind = 'update'").get(productId) as { v: number | null }).v ?? 0) + 1;
export const hasPassport = (productId: number) => !!db().prepare("SELECT 1 FROM product_items WHERE product_id = ? AND source = 'extract' LIMIT 1").get(productId);
// Хронологія по порядку (найстаріше спершу)
export const productTimeline = (productId: number) => db().prepare("SELECT * FROM product_items WHERE product_id = ? AND kind = 'log' ORDER BY created_at, id").all(productId) as PItem[];
export const getPItem = (id: number) => db().prepare("SELECT * FROM product_items WHERE id = ?").get(id) as PItem | undefined;
export function addPItem(productId: number, i: { kind: PItemKind; title: string; body?: string; cat?: string; source?: string; at?: string | null; ver?: number | null }): number {
  const at = i.at && /^\d{4}-\d{2}-\d{2}/.test(i.at) ? i.at.slice(0, 10) + " 12:00:00" : null;
  const id = Number(db().prepare("INSERT INTO product_items (product_id, kind, cat, title, body, source, created_at, ver) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)").run(productId, i.kind, i.cat ?? "", i.title, i.body ?? "", i.source ?? "manual", at, i.ver ?? null).lastInsertRowid);
  db().prepare("UPDATE products SET updated_at = datetime('now') WHERE id = ?").run(productId);
  return id;
}
export function updatePItem(id: number, p: Partial<Pick<PItem, "title" | "body" | "cat" | "done">>): void {
  const keys = Object.keys(p).filter((k) => ["title", "body", "cat", "done"].includes(k));
  if (keys.length) db().prepare(`UPDATE product_items SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...p, id });
}
export const deletePItem = (id: number) => db().prepare("DELETE FROM product_items WHERE id = ?").run(id);

// Які клієнти користуються продуктом
export const productClients = (productId: number) => db().prepare("SELECT pc.client_id, pc.note, c.name FROM product_clients pc JOIN clients c ON c.id = pc.client_id WHERE pc.product_id = ? ORDER BY c.name").all(productId) as { client_id: number; note: string; name: string }[];
export const clientProducts = (clientId: number) => db().prepare("SELECT p.id, p.name, p.status, pc.note FROM product_clients pc JOIN products p ON p.id = pc.product_id WHERE pc.client_id = ? ORDER BY p.name").all(clientId) as { id: number; name: string; status: ProductStatus; note: string }[];
export function setProductClient(productId: number, clientId: number, on: boolean, note = ""): void {
  if (on) db().prepare("INSERT INTO product_clients (product_id, client_id, note) VALUES (?, ?, ?) ON CONFLICT(product_id, client_id) DO UPDATE SET note = excluded.note").run(productId, clientId, note);
  else db().prepare("DELETE FROM product_clients WHERE product_id = ? AND client_id = ?").run(productId, clientId);
}

// CRM клієнта підключили → клієнт користується нашим продуктом Oselya CRM (тільки додає, нічого не відвʼязує)
export function linkCrmProduct(clientId: number): void {
  const p = db().prepare("SELECT id FROM products WHERE lower(name) LIKE '%oselya%' ORDER BY id LIMIT 1").get() as { id: number } | undefined;
  if (p) db().prepare("INSERT OR IGNORE INTO product_clients (product_id, client_id, note) VALUES (?, ?, 'CRM підключена')").run(p.id, clientId);
}

// Події від підключених програм
export function addProductEvent(e: { event_id: string; product_id: number; event: string; summary: string; data_json: string; occurred_at: string }): boolean {
  const ok = db().prepare("INSERT OR IGNORE INTO product_events (event_id, product_id, event, summary, data_json, occurred_at) VALUES (@event_id, @product_id, @event, @summary, @data_json, @occurred_at)").run(e).changes > 0;
  if (ok) db().prepare("UPDATE products SET last_event_at = datetime('now') WHERE id = ?").run(e.product_id);
  return ok;
}
export const productEvents = (productId: number, limit = 30) => db().prepare("SELECT * FROM product_events WHERE product_id = ? ORDER BY received_at DESC LIMIT ?").all(productId, limit) as { event_id: string; event: string; summary: string; data_json: string; occurred_at: string; received_at: string }[];
export const productEventCounts = (productId: number, days = 7) => db().prepare("SELECT event, COUNT(*) n FROM product_events WHERE product_id = ? AND received_at >= datetime('now', ?) GROUP BY event").all(productId, `-${days} days`) as { event: string; n: number }[];

// ---- Розвиток організації
export const ORG_FIELDS = {
  who: { label: "Хто ми і для кого", hint: "Одним абзацом: кому допомагаємо і з чим" },
  positioning: { label: "Позиціонування", hint: "Чим ми відрізняємось, чому до нас ідуть" },
  services: { label: "Що надаємо", hint: "Послуги по рядку: що входить, для кого" },
  approach: { label: "Наш підхід", hint: "Як працюємо: від заявки до прибутку клієнта, кейси, цифри" },
  direction: { label: "Куди рухаємось (6–12 міс)", hint: "Ціль, які продукти будуємо, яких клієнтів хочемо" },
  focus: { label: "Головне зараз", hint: "1–3 речі, на яких фокус цього місяця" },
} as const;
export type OrgKey = keyof typeof ORG_FIELDS;
export const getOrg = (): Record<OrgKey, string> => Object.fromEntries(Object.keys(ORG_FIELDS).map((k) => [k, getSetting(`org.${k}`) ?? ""])) as Record<OrgKey, string>;
export function saveOrg(p: Partial<Record<OrgKey, string>>): void {
  for (const [k, v] of Object.entries(p)) if (k in ORG_FIELDS && v != null) setSetting(`org.${k}`, v.trim());
}

export const ORG_HORIZONS = { now: "Зараз", next: "Далі", later: "Потім", done: "Зроблено" } as const;
export const ORG_KINDS = { plan: "План", decision: "Рішення", lesson: "Урок", idea: "Ідея" } as const;
export type OrgItem = { id: number; kind: keyof typeof ORG_KINDS; horizon: string; title: string; body: string; product_id: number | null; created_at: string; done_at: string | null };
export const listOrgItems = (kind?: string) => (kind ? db().prepare("SELECT * FROM org_items WHERE kind = ? ORDER BY id DESC").all(kind) : db().prepare("SELECT * FROM org_items ORDER BY id DESC").all()) as OrgItem[];
export const getOrgItem = (id: number) => db().prepare("SELECT * FROM org_items WHERE id = ?").get(id) as OrgItem | undefined;
export function addOrgItem(i: { kind: string; title: string; body?: string; horizon?: string; product_id?: number | null }): number {
  const kind = i.kind in ORG_KINDS ? i.kind : "plan";
  const horizon = kind === "plan" ? (i.horizon && i.horizon in ORG_HORIZONS ? i.horizon : "now") : "";
  return Number(db().prepare("INSERT INTO org_items (kind, horizon, title, body, product_id) VALUES (?, ?, ?, ?, ?)").run(kind, horizon, i.title, i.body ?? "", i.product_id ?? null).lastInsertRowid);
}
export function updateOrgItem(id: number, p: Partial<Pick<OrgItem, "title" | "body" | "horizon">>): void {
  if (p.horizon && !(p.horizon in ORG_HORIZONS)) delete p.horizon;
  const keys = Object.keys(p).filter((k) => ["title", "body", "horizon"].includes(k));
  if (!keys.length) return;
  db().prepare(`UPDATE org_items SET ${keys.map((k) => `${k} = @${k}`).join(", ")}${p.horizon === "done" ? ", done_at = datetime('now')" : p.horizon ? ", done_at = NULL" : ""} WHERE id = @id`).run({ ...p, id });
}
export const deleteOrgItem = (id: number) => db().prepare("DELETE FROM org_items WHERE id = ?").run(id);
