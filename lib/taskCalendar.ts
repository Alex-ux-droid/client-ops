// Задача → Google Календар: є час (due_time або «до 19:00» у назві) — подія на цей час з нагадуваннями за 2 і 1 год; нема — на весь день з нагадуванням напередодні.
// Ручна кнопка у вікні задачі (і інструмент Джері); якщо подія вже є — оновлюється сама при зміні задачі.
import { calendarDelete, calendarUpsert } from "./google";
import { logError } from "./log";
import { getTask, setTaskEvent, taskItems, updateTask } from "./repo/tasks";

// «до 19:00», «о 9.30», «на 18:00» → HH:MM
export function timeFromText(text: string): string | null {
  // крапка — тільки після «до/о/на…» (щоб «2.10» не ставало часом), двокрапка — завжди
  const m = text.match(/(?:^|[\s(])(?:(?:до|о|об|на|в|at)\s*([01]?\d|2[0-3])[:.]([0-5]\d)|([01]?\d|2[0-3]):([0-5]\d))(?!\d)/i);
  if (!m) return null;
  const h = m[1] ?? m[3], mm = m[2] ?? m[4];
  return `${h.padStart(2, "0")}:${mm}`;
}
export const normTime = (v: unknown): string | null => {
  const m = String(v ?? "").trim().match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
};

export async function taskToCalendar(id: number, baseUrl = "", opts: { time?: string | null; reminders?: number[] } = {}): Promise<void> {
  let t = getTask(id);
  if (!t) throw new Error("Задачі нема");
  if (!t.due_date) throw new Error("Спершу постав задачі дедлайн — подія ставиться на цей день");
  // час: явно переданий → збережений у задачі → з назви
  const time = normTime(opts.time) ?? t.due_time ?? timeFromText(t.title);
  if (time && time !== t.due_time) { updateTask(id, { due_time: time }); t = getTask(id)!; }
  const items = taskItems(id);
  const description = [
    t.client_name ? `Клієнт: ${t.client_name}` : "",
    items.length ? `Підзадачі:\n${items.map((i) => `${i.done ? "✓" : "☐"} ${i.text}`).join("\n")}` : "",
    t.details ? t.details.slice(0, 1500) : "",
    baseUrl ? `Відкрити задачу: ${baseUrl}/tasks?view=all&task=${id}` : "",
  ].filter(Boolean).join("\n\n");
  const summary = `${t.status === "done" ? "✓ " : ""}${t.title}${t.client_name ? ` · ${t.client_name}` : ""}`;
  setTaskEvent(id, await calendarUpsert({ summary, description, date: t.due_date!, time, reminders: opts.reminders }, t.gcal_event_id));
}

// Після зміни задачі: якщо вона вже в календарі — оновити (без помилок для Саші)
export async function refreshTaskEvent(id: number, baseUrl = ""): Promise<void> {
  const t = getTask(id);
  if (!t?.gcal_event_id) return;
  try {
    if (!t.due_date) { await calendarDelete(t.gcal_event_id); setTaskEvent(id, null); return; }
    await taskToCalendar(id, baseUrl);
  } catch (e) {
    logError("calendar", e);
  }
}

export async function removeTaskEvent(eventId: string | null): Promise<void> {
  if (eventId) await calendarDelete(eventId).catch((e) => logError("calendar", e));
}
