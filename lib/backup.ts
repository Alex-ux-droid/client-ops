// Щоденний бекап бази на Google Диск: «Client Ops — клієнти» → «_Бекапи бази», стиснутий .db.gz, тримаємо 30 останніх.
// Локальний бекап на сервері (deploy, 03:30) лишається — це друга копія поза сервером.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { db } from "./db";
import { deleteFile, ensureSubfolder, folderExists, folderUrl, googleConnected, listFolderFiles, rootFolder, uploadBig } from "./google";
import { logError } from "./log";
import { getSetting, setSetting } from "./repo/settings";

const KEEP = 30;
const kyivNow = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" });
export const backupInfo = () => ({ last: getSetting("backup.last") ?? "", error: getSetting("backup.error") ?? "", size: getSetting("backup.size") ?? "", folder: getSetting("backup.folder") ?? "" });

async function backupFolder(): Promise<string> {
  const saved = getSetting("backup.folder");
  if (saved && (await folderExists(saved))) return saved;
  const id = await ensureSubfolder(await rootFolder(), "_Бекапи бази");
  setSetting("backup.folder", id);
  return id;
}

export async function backupToDrive(): Promise<void> {
  if (!googleConnected()) throw new Error("Google не підключено");
  const tmp = path.join(os.tmpdir(), `client-ops-${Date.now()}.db`);
  try {
    await db().backup(tmp); // цілісна копія навіть під час роботи
    const gz = gzipSync(fs.readFileSync(tmp), { level: 9 });
    const folder = await backupFolder();
    await uploadBig(folder, `client-ops ${kyivNow().slice(0, 16).replace(":", "-")}.db.gz`, gz, "application/gzip");
    // старі — геть
    const files = (await listFolderFiles(folder)).filter((f) => f.name.startsWith("client-ops "));
    for (const f of files.slice(KEEP)) await deleteFile(f.id).catch(() => {});
    setSetting("backup.last", new Date().toISOString());
    setSetting("backup.size", String(gz.length));
    setSetting("backup.error", "");
  } catch (e) {
    setSetting("backup.error", e instanceof Error ? e.message : "помилка");
    throw e;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

export const backupFolderUrl = () => { const f = getSetting("backup.folder"); return f ? folderUrl(f) : ""; };

// Щохвилини: о 04:00 за Києвом раз на добу
export async function backupTick(): Promise<void> {
  if (!googleConnected()) return;
  const now = kyivNow();
  if (now.slice(11, 16) < "04:00") return;
  const last = getSetting("backup.last");
  const lastDay = last ? new Date(last).toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10) : "";
  const tried = getSetting("backup.tried");
  if (lastDay === now.slice(0, 10) || tried === now.slice(0, 10)) return;
  setSetting("backup.tried", now.slice(0, 10)); // одна спроба на день, щоб не довбати Google при помилці
  try { await backupToDrive(); } catch (e) { logError("backup", e); }
}
