import { db } from "../db";
import { money } from "../config";
import { metaAlerts } from "./meta";
import { crmAlerts } from "./crmAlerts";

export const CLIENT_STATUSES = ["lead", "active", "paused", "archived"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const LEAD_STAGES = ["new", "contacted", "proposal", "negotiation"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const CLIENT_KINDS = { client: "Клієнт", partner: "Партнерство" } as const;
export type ClientKind = keyof typeof CLIENT_KINDS;
export const REVENUE_MODELS = { retainer: "абонплата", profit_share: "частка прибутку", mixed: "абонплата + частка", project: "разова оплата", none: "без оплати" } as const;
export type RevenueModel = keyof typeof REVENUE_MODELS;
// Як заробляю на клієнті — одним рядком для екранів і Джері
export function earnText(c: Pick<Client, "kind" | "revenue_model" | "share_percent" | "fee_monthly">, money: (n: number) => string): string {
  const share = c.share_percent ? `частка ${c.share_percent}%` : "частка";
  const parts = c.revenue_model === "profit_share" ? [share] : c.revenue_model === "mixed" ? [c.fee_monthly ? `${money(c.fee_monthly)}/міс` : "абонплата", share]
    : c.revenue_model === "project" ? ["разова оплата"] : c.revenue_model === "none" ? ["без оплати"] : [c.fee_monthly ? `${money(c.fee_monthly)}/міс` : "абонплату не вказано"];
  return [c.kind === "partner" ? "партнерство" : "", ...parts].filter(Boolean).join(" · ");
}

export type Client = {
  id: number;
  name: string;
  niche: string;
  status: ClientStatus;
  stage: LeadStage;
  fee_monthly: number;
  pay_day: number;
  next_step: string;
  next_step_at: string | null;
  owner_name: string;
  locations: number;
  city: string;
  phone: string;
  email: string;
  work_since: string | null;
  drive_url: string;
  offer: string;
  budget: string;
  contacts: string;
  needs: string;
  client_vision: string;
  my_vision: string;
  notes: string;
  bitwarden_ref: string;
  kind: ClientKind;
  revenue_model: RevenueModel;
  share_percent: number;
  partners: string;
  created_at: string;
  updated_at: string;
};

type Optional = "next_step_at" | "kind" | "revenue_model" | "share_percent" | "partners";
export type ClientInput = Omit<Client, "id" | "created_at" | "updated_at" | Optional> & Partial<Pick<Client, Optional>>;

export const CLIENT_FIELDS = [
  "name", "niche", "status", "stage", "fee_monthly", "pay_day", "next_step", "next_step_at", "offer", "budget", "contacts",
  "owner_name", "locations", "city", "phone", "email", "work_since", "drive_url",
  "needs", "client_vision", "my_vision", "notes", "bitwarden_ref",
  "kind", "revenue_model", "share_percent", "partners",
] as const;

export type ClientRow = Client & {
  open_tasks: number;
  overdue_tasks: number;
  last_work: string | null;
  debt: number;
};

const ROW_SQL = `
  SELECT c.*,
    (SELECT COUNT(*) FROM tasks t WHERE t.client_id = c.id AND t.status != 'done') AS open_tasks,
    (SELECT COUNT(*) FROM tasks t WHERE t.client_id = c.id AND t.status != 'done' AND t.due_date < date('now','localtime')) AS overdue_tasks,
    (SELECT MAX(d) FROM (
      SELECT MAX(substr(done_at,1,10)) d FROM work_log w WHERE w.client_id = c.id
      UNION ALL SELECT MAX(substr(done_at,1,10)) FROM tasks t WHERE t.client_id = c.id AND t.status = 'done'
      UNION ALL SELECT MAX(substr(created_at,1,10)) FROM strategy_items si WHERE si.client_id = c.id AND si.kind = 'log'
      UNION ALL SELECT MAX(substr(created_at,1,10)) FROM meetings mt WHERE mt.client_id = c.id
    )) AS last_work,
    (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.client_id = c.id AND p.paid_at IS NULL AND p.due_date < date('now','localtime')) AS debt
  FROM clients c`;

export function listClients(): ClientRow[] {
  return db().prepare(`${ROW_SQL}
    ORDER BY CASE c.status WHEN 'active' THEN 0 WHEN 'lead' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END, c.name
  `).all() as ClientRow[];
}

export function getClientRow(id: number): ClientRow | undefined {
  return db().prepare(`${ROW_SQL} WHERE c.id = ?`).get(id) as ClientRow | undefined;
}

// Що з клієнтом не так. Кожен бейдж — з причиною (підказка при наведенні) і видом:
// гроші і продажі важливіші за рекламу і роботу — так і сортуємо.
export type FlagKind = "money" | "sales" | "ads" | "work";
export type Flag = { level: "bad" | "warn"; text: string; reason?: string; kind?: FlagKind };
const KIND_RANK: Record<FlagKind, number> = { money: 0, sales: 1, ads: 2, work: 3 };
const ymdKyiv = (d: Date) => d.toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400_000);
const ua = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");
export function clientFlags(c: ClientRow, today = new Date()): Flag[] {
  const flags: Flag[] = [];
  const now = ymdKyiv(today);
  if (c.debt > 0) flags.push({ level: "bad", text: "борг по оплаті", kind: "money", reason: `Неоплачені рахунки з минулою датою: ${money(c.debt)}. Джерело: Гроші.` });
  if (c.overdue_tasks) flags.push({ level: "bad", text: `${c.overdue_tasks} прострочено`, kind: "work", reason: "Відкриті задачі з дедлайном раніше сьогодні. Джерело: Задачі." });
  if (c.status === "active") {
    const days = c.last_work ? dayDiff(now, c.last_work) : null;
    const src = "Рахую останню дію: історія робіт, закриті задачі, хроніка стратегії, зустрічі.";
    if (days === null) flags.push({ level: "warn", text: "ще не було робіт", kind: "work", reason: src });
    else if (days >= 14) flags.push({ level: "warn", text: `${days} дн. без руху`, kind: "work", reason: `Остання дія ${ua(c.last_work!)}. ${src}` });
    if (!c.open_tasks) flags.push({ level: "warn", text: "нема задач", kind: "work", reason: "Нема жодної відкритої задачі по клієнту." });
  }
  if (c.next_step_at && c.next_step && c.next_step_at < now) flags.push({ level: "warn", text: "наступний крок прострочено", kind: "work", reason: `«${c.next_step}» — до ${ua(c.next_step_at)}.` });
  if (c.status === "lead" && !c.next_step) flags.push({ level: "warn", text: "нема наступного кроку", kind: "work" });
  flags.push(...crmAlerts(c.id), ...metaAlerts(c.id));
  return flags.sort((a, b) => (a.level === b.level ? 0 : a.level === "bad" ? -1 : 1) || KIND_RANK[a.kind ?? "work"] - KIND_RANK[b.kind ?? "work"]);
}

export function setStage(id: number, stage: LeadStage): void {
  db().prepare("UPDATE clients SET stage = ?, updated_at = datetime('now') WHERE id = ?").run(stage, id);
}

export function setStatus(id: number, status: ClientStatus): void {
  db().prepare("UPDATE clients SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}

export function getClient(id: number): Client | undefined {
  return db().prepare("SELECT * FROM clients WHERE id = ?").get(id) as Client | undefined;
}

export function findClients(q: string): Client[] {
  return db().prepare("SELECT * FROM clients WHERE name LIKE ? OR niche LIKE ? ORDER BY name LIMIT 20")
    .all(`%${q}%`, `%${q}%`) as Client[];
}

export function createClient(input: ClientInput): number {
  const cols = CLIENT_FIELDS.join(", ");
  const vals = CLIENT_FIELDS.map((f) => "@" + f).join(", ");
  return Number(db().prepare(`INSERT INTO clients (${cols}) VALUES (${vals})`).run({
    ...input, next_step_at: input.next_step_at || null, kind: input.kind || "client", revenue_model: input.revenue_model || "retainer",
    share_percent: Number(input.share_percent) || 0, partners: input.partners || "",
  }).lastInsertRowid);
}

export function updateClient(id: number, input: Partial<ClientInput>): void {
  const keys = CLIENT_FIELDS.filter((f) => input[f] !== undefined);
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = @${k}`).join(", ");
  db().prepare(`UPDATE clients SET ${set}, updated_at = datetime('now') WHERE id = @id`).run({ ...input, id });
}

export function countClientsByStatus(): Record<string, number> {
  const rows = db().prepare("SELECT status, COUNT(*) AS n FROM clients GROUP BY status").all() as { status: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

// Повне видалення клієнта з усім (задачі лишаються без клієнта). Повернути — тільки з бекапу.
export function deleteClient(id: number): void {
  db().prepare("DELETE FROM clients WHERE id = ?").run(id);
}
