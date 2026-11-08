// Розділи картки клієнта: ліва «карта» на компʼютері і вкладки на телефоні беруть їх звідси
import { googleConnected } from "@/lib/google";
import { db } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/repo/settings";
import { getCrmLink } from "@/lib/repo/crm";
import type { ClientRow } from "@/lib/repo/clients";
import { clientPlaybooks } from "@/lib/repo/playbooks";
import type { ClientService } from "@/lib/repo/services";
import { listTasks } from "@/lib/repo/tasks";
import { accessCount } from "@/lib/repo/access";
import { chatsForClient } from "@/lib/repo/telegram";
import { SERVICES, type ServiceType } from "@/lib/services";
import { accountsForClient } from "@/lib/repo/meta";
import { listCompetitors } from "@/lib/repo/competitors";
const competitorsCount = (id: number) => listCompetitors(id).length;

// hidden — розділ без даних: не показуємо, поки Саша не ввімкне «+ Розділ» (settings client.tabs.<id>) або не відкриє його
export type Section = { k: string; label: string; ico: string; group: string; badge?: number; svc?: boolean; hidden?: boolean };
const has = (sql: string, id: number) => { try { return !!db().prepare(sql).get(id); } catch { return false; } };
export const enabledTabs = (id: number) => (getSetting(`client.tabs.${id}`) ?? "").split(",").filter(Boolean);
export function enableClientTab(id: number, k: string): void {
  const cur = enabledTabs(id);
  if (!cur.includes(k)) setSetting(`client.tabs.${id}`, [...cur, k].join(","));
}

const SVC_ICO: Record<string, string> = {
  meta_ads: "megaphone", google_ads: "megaphone", tiktok_ads: "megaphone", website: "globe",
  crm: "users", telephony: "phone", sales_training: "book", automation: "zap",
};

export function clientSections(c: ClientRow, services: ClientService[]): Section[] {
  const tasks = listTasks("all", c.id).length;
  const pbs = clientPlaybooks(c.id).length;
  const on = enabledTabs(c.id);
  const hide = (k: string, hasData: boolean) => !hasData && !on.includes(k);
  const comp = competitorsCount(c.id), acc = accessCount(c.id);
  return [
    { k: "overview", label: "Огляд", ico: "home", group: "" },
    { k: "strategy", label: "Стратегія", ico: "zap", group: "" },
    { k: "sales", label: "Продажі", ico: "wallet", group: "", hidden: hide("sales", !!getCrmLink(c.id)) },
    { k: "brand", label: "Бренд", ico: "palette", group: "", hidden: hide("brand", has("SELECT 1 FROM brand WHERE client_id = ? AND (positioning || audience || offer || promise || tone || rules || notes) <> ''", c.id) || has("SELECT 1 FROM brand_colors WHERE client_id = ?", c.id) || has("SELECT 1 FROM brand_assets WHERE client_id = ?", c.id)) },
    { k: "competitors", label: "Конкуренти", ico: "flag", group: "", badge: comp || undefined, hidden: hide("competitors", comp > 0) },
    ...services.map((s) => ({ k: s.type, label: SERVICES[s.type as ServiceType].label, ico: SVC_ICO[s.type] ?? "zap", group: "Послуги", svc: true })),
    ...(chatsForClient(c.id).length ? [{ k: "telegram", label: "Telegram", ico: "send", group: "Звʼязок" }] : []),
    // Пошта — тільки якщо в клієнта є email (і підключено Google)
    ...(c.email && googleConnected() ? [{ k: "mail", label: "Пошта", ico: "mail", group: "Звʼязок" }] : []),
    { k: "tasks", label: "Задачі", ico: "tasks", group: "Робота", badge: tasks },
    { k: "history", label: "Історія", ico: "clock", group: "Робота" },
    { k: "money", label: "Гроші", ico: "wallet", group: "Робота" },
    { k: "files", label: "Файли", ico: "folder", group: "Робота", hidden: hide("files", !!c.drive_url || has("SELECT 1 FROM client_folders WHERE client_id = ?", c.id)) },
    { k: "access", label: "Доступи", ico: "lock", group: "Робота", badge: acc, hidden: hide("access", acc > 0) },
    { k: "materials", label: "Матеріали", ico: "file", group: "Робота", hidden: hide("materials", has("SELECT 1 FROM materials WHERE client_id = ?", c.id)) },
    { k: "playbooks", label: "Плейбуки", ico: "book", group: "Робота", badge: pbs, hidden: hide("playbooks", pbs > 0) },
    { k: "setup", label: "Налаштування клієнта", ico: "gear", group: "Налаштування" },
  ];
}
