"use client";
import { openAssistant } from "./assistant";

// Кнопка-підказка: відкриває головного помічника з готовим запитом
export default function AskAssistant({ text, children }: { text: string; children: React.ReactNode }) {
  return <button type="button" className="ghost small" onClick={() => openAssistant(text, true)}>{children}</button>;
}
