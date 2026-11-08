// Раз на день (після 21:00 Київ) записуємо значення всіх автоматичних метрик клієнтів — для тренду і тривоги «впала за 2 тижні»
import { getSetting, setSetting } from "./repo/settings";
import { snapshotMetrics } from "./repo/metrics";

export async function metricsTick(now = new Date()): Promise<void> {
  const k = now.toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" });
  const day = k.slice(0, 10);
  if (Number(k.slice(11, 13)) < 21 || getSetting("metrics.day_last") === day) return;
  setSetting("metrics.day_last", day);
  snapshotMetrics(day);
}
