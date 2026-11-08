// Відмінки після числа: plural(1, ["оплата","оплати","оплат"]) → «оплата»; 3 → «оплати»; 5, 11, 0 → «оплат»
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const a = Math.abs(Math.trunc(n)), d = a % 10, h = a % 100;
  if (d === 1 && h !== 11) return one;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
}
export const pl = (n: number, forms: [string, string, string]) => `${n} ${plural(n, forms)}`;
