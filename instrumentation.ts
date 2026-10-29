// Фонові задачі сервера: синхронізація Meta Ads кожні 2 години (тільки якщо Meta підключена)
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { syncAll } = await import("./lib/meta");
  const { logError } = await import("./lib/log");
  const run = () => syncAll().catch((e) => logError("meta-sync", e));
  setTimeout(run, 60_000);
  setInterval(run, 2 * 60 * 60_000);
}
