import { db } from "../db";

// Доступи клієнта: ДЕ лежить доступ (Bitwarden), чий акаунт, де 2FA. Паролі — ніколи.
export const ACCESS_OWNERS = { client: "акаунт клієнта", mine: "мій акаунт", shared: "спільний" } as const;
export type AccessOwner = keyof typeof ACCESS_OWNERS;
export const ACCESS_STATUS = { active: "працює", trial: "пробний", paused: "на паузі", off: "відключено" } as const;
export const ACCESS_PERIOD = { month: "щомісяця", year: "щороку", once: "разово", free: "безкоштовно" } as const;
export const ACCESS_PAYER = { client: "з рахунку клієнта", mine: "з мого рахунку" } as const;
export type Access = { id: number; client_id: number; service: string; login: string; url: string; vault_name: string; vault_url: string; owner: AccessOwner; twofa: string; note: string; checked_at: string | null; created_at: string; updated_at: string;
  purpose: string; account_holder: string; connected_at: string | null; status: keyof typeof ACCESS_STATUS; cost: number | null; currency: string; period: keyof typeof ACCESS_PERIOD; payer: keyof typeof ACCESS_PAYER; pay_method: string; next_pay: string | null };
export type AccessLog = { id: number; access_id: number; day: string; text: string; amount: number | null; currency: string };

// Повний номер карти (13–19 цифр, з пробілами/дефісами) не зберігаємо — лише останні 4
export const looksLikeCard = (...vals: string[]) => vals.some((v) => /(?:\d[ -]?){13,19}/.test(v));
export const STALE_DAYS = 180;

// Схоже на пароль у тексті? Тоді не зберігаємо (правило системи: паролі тільки в Bitwarden)
export function looksLikeSecret(...vals: string[]): boolean {
  return vals.some((v) => /(парол\S*|пасв\S*|password|passwd|pwd|pass|pin|пін)\s*[:=—–-]\s*\S{3,}/i.test(v));
}

// Маскування паролів у тексті (Telegram-групи, імпорт): «пароль: qwe123» → «пароль: ••••••». Повертає скільки замасковано.
const SECRET_RE = /((?:парол\S*|пасв\S*|password|passwd|pwd|pass|pin|пін)\s*[:=—–-]\s*)(\S{3,})/gi;
export function maskSecrets(text: string): { text: string; n: number } {
  let n = 0;
  const out = text.replace(SECRET_RE, (_m, head: string) => { n++; return `${head}••••••`; });
  return { text: out, n };
}

export function listAccess(clientId: number): (Access & { stale: boolean })[] {
  const rows = db().prepare(`SELECT *, (COALESCE(checked_at, created_at) < datetime('now', '-${STALE_DAYS} days')) stale FROM client_access WHERE client_id = ? ORDER BY status = 'off', ulower(service)`).all(clientId) as (Access & { stale: number })[];
  return rows.map((r) => ({ ...r, stale: !!r.stale }));
}
export const getAccess = (id: number) => db().prepare("SELECT * FROM client_access WHERE id = ?").get(id) as Access | undefined;
export const accessCount = (clientId: number) => (db().prepare("SELECT COUNT(*) n FROM client_access WHERE client_id = ?").get(clientId) as { n: number }).n;

type Input = { service: string; login?: string; url?: string; vault_name?: string; vault_url?: string; owner?: string; twofa?: string; note?: string;
  purpose?: string; account_holder?: string; connected_at?: string; status?: string; cost?: number | string | null; currency?: string; period?: string; payer?: string; pay_method?: string; next_pay?: string };
const day = (v?: string) => (/^\d{4}-\d{2}-\d{2}$/.test((v ?? "").trim()) ? v!.trim() : null);
const money = (v: unknown) => { const n = Number(String(v ?? "").replace(",", ".").replace(/[^\d.]/g, "")); return String(v ?? "").trim() && Number.isFinite(n) ? n : null; };
const clean = (i: Input) => ({
  service: i.service.trim().slice(0, 120), login: (i.login ?? "").trim().slice(0, 200), url: (i.url ?? "").trim().slice(0, 500),
  vault_name: (i.vault_name ?? "").trim().slice(0, 200), vault_url: (i.vault_url ?? "").trim().slice(0, 500),
  owner: (i.owner && i.owner in ACCESS_OWNERS ? i.owner : "client") as AccessOwner, twofa: (i.twofa ?? "").trim().slice(0, 200), note: (i.note ?? "").trim().slice(0, 1000),
  purpose: (i.purpose ?? "").trim().slice(0, 300), account_holder: (i.account_holder ?? "").trim().slice(0, 200), connected_at: day(i.connected_at),
  status: i.status && i.status in ACCESS_STATUS ? i.status : "active", cost: money(i.cost), currency: (i.currency ?? "UAH").trim().toUpperCase().slice(0, 5) || "UAH",
  period: i.period && i.period in ACCESS_PERIOD ? i.period : "month", payer: i.payer && i.payer in ACCESS_PAYER ? i.payer : "client",
  pay_method: (i.pay_method ?? "").trim().slice(0, 200), next_pay: day(i.next_pay),
});
const FIELDS = ["service", "login", "url", "vault_name", "vault_url", "owner", "twofa", "note", "purpose", "account_holder", "connected_at", "status", "cost", "currency", "period", "payer", "pay_method", "next_pay"] as const;

export function saveAccess(clientId: number, input: Input, id?: number | null): number {
  const v = clean(input);
  if (!v.service) throw new Error("Вкажи сервіс");
  if (looksLikeSecret(v.login, v.note, v.twofa, v.vault_name, v.pay_method, v.purpose, v.account_holder)) throw new Error("Схоже на пароль — паролі тільки в Bitwarden, сюди лише назва запису");
  if (looksLikeCard(v.pay_method, v.note, v.purpose, v.login)) throw new Error("Повний номер карти не зберігаємо — впиши лише останні 4 цифри, напр. «карта клієнта Моно •••• 4521»");
  if (id) {
    db().prepare(`UPDATE client_access SET ${FIELDS.map((f) => `${f}=@${f}`).join(", ")}, updated_at=datetime('now') WHERE id=@id`).run({ ...v, id });
    return id;
  }
  return Number(db().prepare(`INSERT INTO client_access (client_id, ${FIELDS.join(", ")}, checked_at) VALUES (@client_id, ${FIELDS.map((f) => `@${f}`).join(", ")}, datetime('now'))`).run({ ...v, client_id: clientId }).lastInsertRowid);
}

// ---- Журнал сервісу: що зробили / скільки заплатили
export const accessLog = (accessId: number) => db().prepare("SELECT * FROM client_access_log WHERE access_id = ? ORDER BY day DESC, id DESC").all(accessId) as AccessLog[];
export function addAccessLog(accessId: number, e: { day?: string; text: string; amount?: number | string | null; currency?: string }): number {
  const text = e.text.trim().slice(0, 500);
  if (!text) throw new Error("Напиши, що сталось");
  if (looksLikeSecret(text)) throw new Error("Схоже на пароль — паролі тільки в Bitwarden");
  if (looksLikeCard(text)) throw new Error("Повний номер карти не зберігаємо — лише останні 4 цифри");
  const a = getAccess(accessId);
  if (!a) throw new Error("Сервісу нема");
  const today = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
  return Number(db().prepare("INSERT INTO client_access_log (access_id, day, text, amount, currency) VALUES (?, ?, ?, ?, ?)").run(accessId, day(e.day) ?? today, text, money(e.amount), money(e.amount) != null ? (e.currency || a.currency || "UAH").toUpperCase().slice(0, 5) : "").lastInsertRowid);
}
export const deleteAccessLog = (id: number) => db().prepare("DELETE FROM client_access_log WHERE id = ?").run(id);

// Скільки на місяць іде на сервіси (річні — /12), окремо клієнта і мої, по валютах
export function monthlyCost(list: Access[]): { client: Record<string, number>; mine: Record<string, number> } {
  const out = { client: {} as Record<string, number>, mine: {} as Record<string, number> };
  for (const a of list) {
    if (a.cost == null || a.status === "off" || a.period === "once" || a.period === "free") continue;
    const m = a.period === "year" ? a.cost / 12 : a.cost;
    const b = out[a.payer === "mine" ? "mine" : "client"];
    b[a.currency] = Math.round(((b[a.currency] ?? 0) + m) * 100) / 100;
  }
  return out;
}
export const markAccessChecked = (id: number) => db().prepare("UPDATE client_access SET checked_at = datetime('now') WHERE id = ?").run(id);
export const deleteAccess = (id: number) => db().prepare("DELETE FROM client_access WHERE id = ?").run(id);
