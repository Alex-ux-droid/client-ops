"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import Bot from "@/components/Bot";
import { openAssistant } from "@/components/assistant";

const KICKOFF = (id: number) => `Розгорни сесію лабораторії lab_id ${id}: визнач, що підбираємо, додай критерії з вагами і 2–4 варіанти під проблему і бюджет клієнта.`;

// Помічник прямо в лабораторії: після створення сесії сам розгортає ідею, далі — кнопки-підказки
export default function LabAssistant({ id, empty }: { id: number; empty: boolean }) {
  const sp = useSearchParams();
  const router = useRouter();
  const fired = useRef(false);
  useEffect(() => {
    if (sp.get("start") !== "1" || fired.current) return;
    fired.current = true;
    router.replace(`/lab/${id}`, { scroll: false });
    openAssistant(KICKOFF(id), true);
  }, [sp, id, router]);

  const asks: [string, string, boolean][] = empty
    ? [["Розгорнути ідею", KICKOFF(id), true]]
    : [
        ["Що ще порівняти?", `Сесія lab_id ${id}: чого бракує в порівнянні — варіантів чи критеріїв? Додай.`, true],
        ["Постав оцінки", `Сесія lab_id ${id}: постав оцінки варіантам там, де маєш підстави, і скажи, де це припущення.`, true],
        ["Напиши висновок", `Сесія lab_id ${id}: напиши висновок — що обрати, чому, ризики, наступні кроки.`, true],
        ["Свій запит…", "", false],
      ];

  return (
    <div className="card lab-bot">
      <Bot size={56} />
      <div className="grow" style={{ minWidth: 0 }}>
        <b>Помічник у цій сесії</b>
        <div className="row-sub">{empty ? "Натисни — він розбере проблему і накидає варіанти з критеріями." : "Скажи голосом або обери підказку."}</div>
        <div className="chips" style={{ marginTop: "0.625rem" }}>
          {asks.map(([label, text, send]) => (
            <button key={label} className={label === asks[0][0] ? "small" : "ghost small"} onClick={() => openAssistant(text, send)}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
