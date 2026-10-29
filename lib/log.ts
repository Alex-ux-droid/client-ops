// Останні помилки в пам'яті процесу — щоб бачити їх через /api/status без доступу до сервера.
const g = globalThis as unknown as { __errors?: { at: string; where: string; message: string }[] };

export function logError(where: string, e: unknown): void {
  const list = (g.__errors ??= []);
  list.push({ at: new Date().toISOString(), where, message: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
  if (list.length > 50) list.shift();
  console.error(where, e);
}

export function recentErrors() {
  return [...(g.__errors ?? [])].reverse();
}
