// Ліміт витрат на API за місяць (settings usage.limit_month, у доларах): на 80% і 100% — повідомлення в Telegram, раз на рівень.
// Нічого не вимикаємо самі — рішення за Сашею.
import { usageSummary } from "./ai";
import { getSetting, setSetting } from "./repo/settings";
import { tg, tgOwner } from "./telegram";

export async function usageTick(): Promise<void> {
  const limit = Number(getSetting("usage.limit_month")) || 0;
  const owner = tgOwner();
  if (!limit || !owner || !process.env.TELEGRAM_BOT_TOKEN) return;
  const { month } = usageSummary();
  const ym = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 7);
  for (const lvl of [100, 80]) {
    if (month < (limit * lvl) / 100) continue;
    const key = `usage.alerted.${ym}.${lvl}`;
    if (getSetting(key)) return;
    setSetting(key, "1");
    await tg("sendMessage", { chat_id: owner, text: `💸 API за ${ym}: ${month.toFixed(2)} $ — це ${lvl}% місячного ліміту ${limit} $. Деталі: Налаштування → Витрати.` }).catch(() => {});
    return;
  }
}
