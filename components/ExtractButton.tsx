"use client";
// Дві кнопки для роботи в іншому чаті (Claude, ChatGPT, Claude Code):
// «Почати з контекстом» — копіює все, що система знає про клієнта/проєкт + інструкцію видати витяжку наприкінці;
// «Витяжка» — тільки промпт підсумку (якщо розмова вже йде). Результат з міткою кидаєш Джері в чат.
import { useState } from "react";
import { contextText, copyLater, extractPrompt } from "./extractPrompt";

export default function ExtractButton({ scope, kind, id }: { scope: string; kind?: "client" | "startup"; id?: number }) {
  const [msg, setMsg] = useState("");
  const done = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };
  const copy = async (text: string, note: string) => { try { await navigator.clipboard.writeText(text); done(note); } catch { done("Браузер не дав скопіювати"); } };
  return (
    <span className="inline" style={{ flexWrap: "wrap", gap: "0.375rem" }}>
      {kind && id ? (
        <button type="button" className="ghost small" title="Повний контекст + інструкція видати витяжку наприкінці. Встав на початку нового чату в Claude/ChatGPT."
          onClick={async () => { done("Збираю контекст…"); const ok = await copyLater(() => contextText(kind, id, extractPrompt(scope))); done(ok ? "Скопійовано ✓ — встав на початку нового чату" : "Браузер не дав скопіювати"); }}>
          ⇄ Почати чат з контекстом
        </button>
      ) : null}
      <button type="button" className="ghost small" title="Встав наприкінці розмови в іншому чаті — він видасть витяжку з міткою. Її кинь Джері: він розкладе по місцях."
        onClick={() => copy(extractPrompt(scope), "Скопійовано ✓ — встав наприкінці розмови")}>
        ⇄ Витяжка з чату
      </button>
      {msg && <span className="mono">{msg}</span>}
    </span>
  );
}
