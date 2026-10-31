// Фонові задачі сервера:
// - синхронізація Meta Ads кожні 2 години (тільки якщо Meta підключена)
// - щохвилинний «годинник»: ранкове зведення в Telegram, нічний бекап бази на Google Диск, одноразові дрібниці
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { syncAll } = await import("./lib/meta");
  const { logError } = await import("./lib/log");
  const run = () => syncAll().catch((e) => logError("meta-sync", e));
  setTimeout(run, 60_000);
  setInterval(run, 2 * 60 * 60_000);

  const { digestTick } = await import("./lib/digest");
  const { backupTick } = await import("./lib/backup");
  const { avatarsOnce } = await import("./lib/telegram");
  const { monitorTick } = await import("./lib/startupMonitor");
  const { tipsTick } = await import("./lib/tips");
  const tick = async () => {
    await digestTick().catch((e) => logError("digest", e));
    await backupTick().catch((e) => logError("backup", e));
    await avatarsOnce().catch((e) => logError("tg-avatar", e));
    await monitorTick().catch((e) => logError("startup-monitor", e));
    await tipsTick().catch((e) => logError("tips", e));
  };
  setTimeout(tick, 90_000);
  setInterval(tick, 60_000);
}
