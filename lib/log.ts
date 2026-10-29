// Помилки: в пам'яті процесу (для /api/status) і в журнал системи (щоб потрапили в експорт для Claude).
import { addErrorEntry } from "./repo/devlog";

const g = globalThis as unknown as { __errors?: { at: string; where: string; message: string }[] };

export function logError(where: string, e: unknown): void {
  const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  const list = (g.__errors ??= []);
  list.push({ at: new Date().toISOString(), where, message });
  if (list.length > 50) list.shift();
  console.error(where, e);
  try { addErrorEntry(where, message.slice(0, 250)); } catch { /* журнал не повинен валити систему */ }
}

export function recentErrors() {
  return [...(g.__errors ?? [])].reverse();
}
