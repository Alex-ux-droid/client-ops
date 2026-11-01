"use client";
import { useState } from "react";

// Текст «скопіюй і встав»: тонка рамка, підпис, кнопка копіювати весь блок
export default function MdCopy({ label, text }: { label: string; text: string }) {
  const [ok, setOk] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setOk(true); setTimeout(() => setOk(false), 1500);
  };
  return (
    <div className="md-copy">
      <div className="md-copy-head">
        <span>{label || "Текст"}</span>
        <button type="button" onClick={copy} className={ok ? "ok" : ""}>{ok ? "Скопійовано ✓" : "Копіювати"}</button>
      </div>
      <div className="md-copy-text">{text}</div>
    </div>
  );
}
