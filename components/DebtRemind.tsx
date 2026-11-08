"use client";
// Кнопка «Нагадування» біля боргу: вікно «Повідомлення клієнту» з шаблоном «Оплата» і сумою. Клієнту нічого не йде само.
import { openClientMessage } from "./tasks";

export default function DebtRemind({ clientId, clientName, note }: { clientId: number; clientName: string; note: string }) {
  return <button type="button" className="ghost small" onClick={() => openClientMessage({ clientId, clientName, template: "оплат", note })}>Нагадування</button>;
}
