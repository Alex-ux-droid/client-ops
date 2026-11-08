// Фонові задачі сервера:
// - синхронізація Meta Ads кожні 2 години (тільки якщо Meta підключена)
// - щохвилинний «годинник»: ранкове зведення в Telegram, нічний бекап бази на Google Диск, одноразові дрібниці
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { syncAll } = await import("./lib/meta");
  const { logError } = await import("./lib/log");
  try { (await import("./lib/secrets")).ensureAgentTokenExpiry(); } catch (e) { logError("agent-token", e); }
  const run = () => syncAll().catch((e) => logError("meta-sync", e));
  setTimeout(run, 60_000);
  setInterval(run, 2 * 60 * 60_000);

  const { digestTick } = await import("./lib/digest");
  const { backupTick } = await import("./lib/backup");
  const { avatarsOnce, ensureWebhookUpdates } = await import("./lib/telegram");
  const { monitorTick } = await import("./lib/startupMonitor");
  const { tipsTick } = await import("./lib/tips");
  const { leadsTick } = await import("./lib/metaLeads");
  const { weeklyReportTick } = await import("./lib/clientReport");
  const { crmTick } = await import("./lib/crm");
  const { radarTick } = await import("./lib/aiRadar");
  const { competitorTick } = await import("./lib/competitors");
  const { invoiceTick } = await import("./lib/invoices");
  const { confirmTick } = await import("./lib/confirmQueue");
  const { metricsTick } = await import("./lib/metricsTick");
  const { usageTick } = await import("./lib/usageAlert");
  const { housekeepingTick } = await import("./lib/housekeeping");
  const tick = async () => {
    await digestTick().catch((e) => logError("digest", e));
    await backupTick().catch((e) => logError("backup", e));
    await avatarsOnce().catch((e) => logError("tg-avatar", e));
    await ensureWebhookUpdates().catch((e) => logError("tg-webhook", e));
    await monitorTick().catch((e) => logError("startup-monitor", e));
    await tipsTick().catch((e) => logError("tips", e));
    await leadsTick().catch((e) => logError("leads", e));
    await weeklyReportTick().catch((e) => logError("weekly-report", e));
    await crmTick().catch((e) => logError("crm", e));
    await radarTick().catch((e) => logError("ai-radar", e));
    await competitorTick().catch((e) => logError("competitor-check", e));
    await invoiceTick().catch((e) => logError("invoices", e));
    await confirmTick().catch((e) => logError("confirm-queue", e));
    await metricsTick().catch((e) => logError("metrics", e));
    await usageTick().catch((e) => logError("usage", e));
    await housekeepingTick().catch((e) => logError("housekeeping", e));
  };
  setTimeout(tick, 90_000);
  setInterval(tick, 60_000);
}
