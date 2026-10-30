// Відкрити вікно задачі з будь-якого місця: openTask(id)
export const OPEN_TASK = "task:open";
export function openTask(id: number) {
  window.dispatchEvent(new CustomEvent(OPEN_TASK, { detail: id }));
}
