"use client";
import { useState } from "react";

export function CopyText({ text, label = "Копіювати", className = "ghost small" }: { text: string; label?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className={className} onClick={async () => {
      try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* браузер не дав */ }
    }}>{ok ? "Скопійовано ✓" : label}</button>
  );
}
