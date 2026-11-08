// Відкрити вікно задачі з будь-якого місця: openTask(id)
export const OPEN_TASK = "task:open";
export function openTask(id: number) {
  window.dispatchEvent(new CustomEvent(OPEN_TASK, { detail: id }));
}

// Повідомлення клієнту по шаблону: openClientMessage({ clientId, clientName, taskId })
export const OPEN_CLIENT_MSG = "clientmsg:open";
// template — частина назви шаблону, який відкрити одразу (напр. «Оплата»); note — що сказати (підставляється в поле)
export type ClientMsgTarget = { clientId: number; clientName: string; taskId?: number | null; template?: string; note?: string };
export function openClientMessage(t: ClientMsgTarget) {
  window.dispatchEvent(new CustomEvent(OPEN_CLIENT_MSG, { detail: t }));
}
