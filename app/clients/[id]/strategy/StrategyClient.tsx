"use client";
// Кнопки Стратегії, яким потрібен браузер: скопіювати промпт для Claude Code і вставити витяжку
import { useRouter } from "next/navigation";
import { useState } from "react";
import { copyLater } from "@/components/extractPrompt";
import { importAction, promptAction } from "./actions";

export function PromptCopy({ clientId, partId, label }: { clientId: number; partId: number | null; label?: string }) {
  const [msg, setMsg] = useState("");
  return (
    <span className="inline" style={{ gap: "0.375rem" }}>
      <button type="button" className="ghost small" title="Повний контекст стратегії (і цієї частини) + інструкція наприкінці видати витяжку. Встав на початку роботи в Claude Code / чаті."
        onClick={async () => { const ok = await copyLater(() => promptAction(clientId, partId)); setMsg(ok ? "Скопійовано ✓" : "Не вдалось"); setTimeout(() => setMsg(""), 2500); }}>
        ⇄ {label ?? "Промпт для Claude Code"}
      </button>
      {msg && <span className="mono">{msg}</span>}
    </span>
  );
}

export function ImportBox({ clientId, compact }: { clientId: number; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const router = useRouter();
  if (!open) return <button type="button" className="small" onClick={() => setOpen(true)}>↓ Вставити витяжку</button>;
  return (
    <div className="card st-import">
      <b>Вставити витяжку</b>
      <div className="mono">Блок [CLIENT-OPS:СТРАТЕГІЯ] з Claude Code або будь-який підсумок роботи — Джері розкладе: частина екосистеми, план, хроніка, знання, рішення, висновки.</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="[CLIENT-OPS:СТРАТЕГІЯ] …" style={{ minHeight: "8rem" }} aria-label="Витяжка" />
      <div className="inline" style={{ flexWrap: "wrap" }}>
        <button type="button" disabled={busy || text.trim().length < 20} onClick={async () => { setBusy(true); setRes(null); const r = await importAction(clientId, text); setBusy(false); if (r.ok) { setText(""); setRes({ ok: true, lines: r.summary.length ? r.summary : ["Нового не знайшов"] }); router.refresh(); } else setRes({ ok: false, lines: [r.error] }); }}>{busy ? "Джері розкладає… до 1–2 хв" : "Розкласти по стратегії"}</button>
        {compact && <button type="button" className="ghost small" onClick={() => setOpen(false)}>Згорнути</button>}
      </div>
      {res && <div className={`mono ${res.ok ? "st-ok" : "st-bad"}`}>{res.ok ? "Записав: " : ""}{res.lines.join(" · ")}</div>}
    </div>
  );
}
