// Щомісячні рахунки (очікувані оплати) самі: з 1-го числа місяця за Києвом, один раз на місяць.
// Дублі не створюються — createMonthInvoices пропускає клієнтів, у кого вже є «щомісячна оплата» на цей місяць.
import { autoOn } from "./agent/caps";
import { createMonthInvoices } from "./repo/payments";
import { getSetting, setSetting } from "./repo/settings";
import { tg, tgOwner } from "./telegram";

export async function invoiceTick(now = new Date()): Promise<void> {
  if (!autoOn("invoices")) return;
  const month = now.toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 7);
  if (getSetting("invoices.month_last") === month) return;
  setSetting("invoices.month_last", month);
  const n = createMonthInvoices(month);
  const owner = tgOwner();
  if (n && owner && process.env.TELEGRAM_BOT_TOKEN) await tg("sendMessage", { chat_id: owner, text: `🧾 Створив ${n} очікуваних оплат на ${month} (абонплата клієнтів). Гроші → цей місяць.` }).catch(() => {});
}
