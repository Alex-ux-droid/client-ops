// Розділи картки клієнта: ліва «карта» на компʼютері і вкладки на телефоні беруть їх звідси
import { googleConnected } from "@/lib/google";
import type { ClientRow } from "@/lib/repo/clients";
import { clientPlaybooks } from "@/lib/repo/playbooks";
import type { ClientService } from "@/lib/repo/services";
import { listTasks } from "@/lib/repo/tasks";
import { accessCount } from "@/lib/repo/access";
import { chatsForClient } from "@/lib/repo/telegram";
import { SERVICES, type ServiceType } from "@/lib/services";

export type Section = { k: string; label: string; ico: string; group: string; badge?: number; svc?: boolean };

const SVC_ICO: Record<string, string> = {
  meta_ads: "megaphone", google_ads: "megaphone", tiktok_ads: "megaphone", website: "globe",
  crm: "users", telephony: "phone", sales_training: "book", automation: "zap",
};

export function clientSections(c: ClientRow, services: ClientService[]): Section[] {
  const tasks = listTasks("all", c.id).length;
  const pbs = clientPlaybooks(c.id).length;
  return [
    { k: "overview", label: "Огляд", ico: "home", group: "" },
    ...services.map((s) => ({ k: s.type, label: SERVICES[s.type as ServiceType].label, ico: SVC_ICO[s.type] ?? "zap", group: "Послуги", svc: true })),
    ...(chatsForClient(c.id).length ? [{ k: "telegram", label: "Telegram", ico: "send", group: "Звʼязок" }] : []),
    // Пошта — тільки якщо в клієнта є email (і підключено Google)
    ...(c.email && googleConnected() ? [{ k: "mail", label: "Пошта", ico: "mail", group: "Звʼязок" }] : []),
    { k: "tasks", label: "Задачі", ico: "tasks", group: "Робота", badge: tasks },
    { k: "history", label: "Історія", ico: "clock", group: "Робота" },
    { k: "money", label: "Гроші", ico: "wallet", group: "Робота" },
    { k: "files", label: "Файли", ico: "folder", group: "Робота" },
    { k: "access", label: "Доступи", ico: "lock", group: "Робота", badge: accessCount(c.id) },
    { k: "materials", label: "Матеріали", ico: "file", group: "Робота" },
    { k: "playbooks", label: "Плейбуки", ico: "book", group: "Робота", badge: pbs },
    { k: "setup", label: "Налаштування клієнта", ico: "gear", group: "Налаштування" },
  ];
}
