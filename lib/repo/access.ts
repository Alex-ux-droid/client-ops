import { db } from "../db";

// Доступи клієнта: ДЕ лежить доступ (Bitwarden), чий акаунт, де 2FA. Паролі — ніколи.
export const ACCESS_OWNERS = { client: "акаунт клієнта", mine: "мій акаунт", shared: "спільний" } as const;
export type AccessOwner = keyof typeof ACCESS_OWNERS;
export type Access = { id: number; client_id: number; service: string; login: string; url: string; vault_name: string; vault_url: string; owner: AccessOwner; twofa: string; note: string; checked_at: string | null; created_at: string; updated_at: string };
export const STALE_DAYS = 180;

// Схоже на пароль у тексті? Тоді не зберігаємо (правило системи: паролі тільки в Bitwarden)
export function looksLikeSecret(...vals: string[]): boolean {
  return vals.some((v) => /(парол\S*|пасв\S*|password|passwd|pwd|pass|pin|пін)\s*[:=—–-]\s*\S{3,}/i.test(v));
}

export function listAccess(clientId: number): (Access & { stale: boolean })[] {
  const rows = db().prepare(`SELECT *, (COALESCE(checked_at, created_at) < datetime('now', '-${STALE_DAYS} days')) stale FROM client_access WHERE client_id = ? ORDER BY ulower(service)`).all(clientId) as (Access & { stale: number })[];
  return rows.map((r) => ({ ...r, stale: !!r.stale }));
}
export const getAccess = (id: number) => db().prepare("SELECT * FROM client_access WHERE id = ?").get(id) as Access | undefined;
export const accessCount = (clientId: number) => (db().prepare("SELECT COUNT(*) n FROM client_access WHERE client_id = ?").get(clientId) as { n: number }).n;

type Input = { service: string; login?: string; url?: string; vault_name?: string; vault_url?: string; owner?: string; twofa?: string; note?: string };
const clean = (i: Input) => ({
  service: i.service.trim().slice(0, 120), login: (i.login ?? "").trim().slice(0, 200), url: (i.url ?? "").trim().slice(0, 500),
  vault_name: (i.vault_name ?? "").trim().slice(0, 200), vault_url: (i.vault_url ?? "").trim().slice(0, 500),
  owner: (i.owner && i.owner in ACCESS_OWNERS ? i.owner : "client") as AccessOwner, twofa: (i.twofa ?? "").trim().slice(0, 200), note: (i.note ?? "").trim().slice(0, 1000),
});

export function saveAccess(clientId: number, input: Input, id?: number | null): number {
  const v = clean(input);
  if (!v.service) throw new Error("Вкажи сервіс");
  if (looksLikeSecret(v.login, v.note, v.twofa, v.vault_name)) throw new Error("Схоже на пароль — паролі тільки в Bitwarden, сюди лише назва запису");
  if (id) {
    db().prepare("UPDATE client_access SET service=@service, login=@login, url=@url, vault_name=@vault_name, vault_url=@vault_url, owner=@owner, twofa=@twofa, note=@note, updated_at=datetime('now') WHERE id=@id").run({ ...v, id });
    return id;
  }
  return Number(db().prepare("INSERT INTO client_access (client_id, service, login, url, vault_name, vault_url, owner, twofa, note, checked_at) VALUES (@client_id, @service, @login, @url, @vault_name, @vault_url, @owner, @twofa, @note, datetime('now'))").run({ ...v, client_id: clientId }).lastInsertRowid);
}
export const markAccessChecked = (id: number) => db().prepare("UPDATE client_access SET checked_at = datetime('now') WHERE id = ?").run(id);
export const deleteAccess = (id: number) => db().prepare("DELETE FROM client_access WHERE id = ?").run(id);
