"use client";
import { useState } from "react";

export function CopyText({ text, label = "Копіювати" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="ghost small" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* браузер не дав */ }
    }}>{ok ? "Скопійовано ✓" : label}</button>
  );
}
