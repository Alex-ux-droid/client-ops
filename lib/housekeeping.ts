// Прибирання і перевірки: кошик клієнтів (30 днів) і щомісячна перевірка, що бекап справді відкривається.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { logError } from "./log";
import { dbPath } from "./migrate.mjs";
import { purgeTrash } from "./repo/clients";
import { getSetting, setSetting } from "./repo/settings";
import { tg, tgOwner } from "./telegram";

export type BackupCheck = { at: string; file: string; ok: boolean; note: string };
export const lastBackupCheck = (): BackupCheck | null => { try { return JSON.parse(getSetting("backup.verify") || "null"); } catch { return null; } };

// Беремо найсвіжішу локальну копію, відкриваємо тільки на читання, integrity_check + чи є клієнти і міграції
export function verifyBackup(): BackupCheck {
  const dir = path.join(path.dirname(dbPath()), "backups");
  const at = new Date().toISOString();
  let files: string[] = [];
  try { files = fs.readdirSync(dir).filter((f) => f.startsWith("app-") && f.endsWith(".db")).sort(); } catch { /* нема папки */ }
  const file = files.at(-1);
  if (!file) return { at, file: "", ok: false, note: "Локальних копій нема (папка backups порожня) — таймер бекапу не працює?" };
  try {
    const d = new Database(path.join(dir, file), { readonly: true, fileMustExist: true });
    const integrity = (d.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check;
    const clients = (d.prepare("SELECT COUNT(*) n FROM clients").get() as { n: number }).n;
    const migr = (d.prepare("SELECT COUNT(*) n FROM _migrations").get() as { n: number }).n;
    d.close();
    const ok = integrity === "ok" && migr > 0;
    return { at, file, ok, note: ok ? `відкривається, цілісність ок, клієнтів ${clients}, міграцій ${migr}` : `перевірка: ${integrity}` };
  } catch (e) {
    return { at, file, ok: false, note: e instanceof Error ? e.message : "не відкривається" };
  }
}

export async function housekeepingTick(now = new Date()): Promise<void> {
  const day = now.toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
  if (getSetting("housekeep.day") === day) return;
  setSetting("housekeep.day", day);
  try { purgeTrash(); } catch (e) { logError("trash", e); }
  try { (await import("./sitePulse")).purgeSiteEvents(); } catch (e) { logError("site-purge", e); }
  // Раз на місяць (з 2-го числа, після нічного бекапу) — перевірка відновлення
  const month = day.slice(0, 7);
  if (Number(day.slice(8)) >= 2 && getSetting("backup.verify_month") !== month && process.env.NODE_ENV === "production") {
    setSetting("backup.verify_month", month);
    const r = verifyBackup();
    setSetting("backup.verify", JSON.stringify(r));
    const owner = tgOwner();
    if (!r.ok && owner && process.env.TELEGRAM_BOT_TOKEN) await tg("sendMessage", { chat_id: owner, text: `⚠️ Щомісячна перевірка бекапу: НЕ ок.\n${r.file || "—"}: ${r.note}\nНалаштування → Система.` }).catch(() => {});
  }
}
