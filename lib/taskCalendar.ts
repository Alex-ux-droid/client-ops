// Задача → Google Календар: подія на день дедлайну з нагадуванням напередодні.
// Ручна кнопка у вікні задачі (і інструмент Джері); якщо подія вже є — оновлюється сама при зміні задачі.
import { calendarDelete, calendarUpsert } from "./google";
import { logError } from "./log";
import { getTask, setTaskEvent, taskItems } from "./repo/tasks";

export async function taskToCalendar(id: number, baseUrl = ""): Promise<void> {
  const t = getTask(id);
  if (!t) throw new Error("Задачі нема");
  if (!t.due_date) throw new Error("Спершу постав задачі дедлайн — подія ставиться на цей день");
  const items = taskItems(id);
  const description = [
    t.client_name ? `Клієнт: ${t.client_name}` : "",
    items.length ? `Підзадачі:\n${items.map((i) => `${i.done ? "✓" : "☐"} ${i.text}`).join("\n")}` : "",
    t.details ? t.details.slice(0, 1500) : "",
    baseUrl ? `Відкрити задачу: ${baseUrl}/tasks?view=all&task=${id}` : "",
  ].filter(Boolean).join("\n\n");
  const summary = `${t.status === "done" ? "✓ " : ""}${t.title}${t.client_name ? ` · ${t.client_name}` : ""}`;
  setTaskEvent(id, await calendarUpsert({ summary, description, date: t.due_date }, t.gcal_event_id));
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
