// Налаштування застосунку. Валюта одна на всю систему, щоб суми додавались чесно.
export const CURRENCY = process.env.APP_CURRENCY || "$";

export function money(n: number | null | undefined): string {
  const v = Math.round((n ?? 0) * 100) / 100;
  const s = v.toLocaleString("uk-UA", { maximumFractionDigits: v % 1 ? 2 : 0 });
  return CURRENCY === "$" || CURRENCY === "€" ? `${CURRENCY}${s}` : `${s} ${CURRENCY}`;
}
