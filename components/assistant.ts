// Відкрити помічника з будь-якого місця: openAssistant("текст", true) — одразу надіслати
export type AssistantSeed = { text: string; send: boolean; n: number };
export function openAssistant(text = "", send = false) {
  window.dispatchEvent(new CustomEvent("assistant:open", { detail: { text, send } }));
}
