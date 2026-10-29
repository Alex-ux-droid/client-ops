// Загальні налаштування. Валюта одна на всю систему, щоб суми додавались чесно.
import { getSetting } from "./repo/settings";

export const CURRENCIES = ["$", "€", "₴", "zł"] as const;

export function currency(): string {
  return getSetting("currency") || process.env.APP_CURRENCY || "$";
}

export function money(n: number | null | undefined): string {
  const cur = currency();
  const v = Math.round((n ?? 0) * 100) / 100;
  const s = v.toLocaleString("uk-UA", { maximumFractionDigits: v % 1 ? 2 : 0 });
  return cur === "$" || cur === "€" ? `${cur}${s}` : `${s} ${cur}`;
}
