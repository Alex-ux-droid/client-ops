// Дати як YYYY-MM-DD у локальному часі.
export function ymd(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(n: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

// Кінець поточного тижня (неділя)
export function endOfWeek(from: Date = new Date()): string {
  const day = from.getDay(); // 0 = неділя
  return addDays(day === 0 ? 0 : 7 - day, from);
}

export function fmtDate(s: string | null): string {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}.${m}.${y.slice(2)}`;
}
