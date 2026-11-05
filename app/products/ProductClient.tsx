"use client";
// Кнопки продуктів, яким потрібен браузер: скопіювати промпт / набір і вставити витяжку
import { useRouter } from "next/navigation";
import { useState } from "react";
import { copyLater } from "@/components/extractPrompt";
import { productImportAction, productPromptAction } from "./actions";

export function ProductPrompt({ productId, label }: { productId: number | null; label: string }) {
  const [msg, setMsg] = useState("");
  return (
    <span className="inline" style={{ gap: "0.375rem" }}>
      <button type="button" className="ghost small" onClick={async () => { const ok = await copyLater(() => productPromptAction(productId)); setMsg(ok ? "Скопійовано ✓" : "Не вдалось"); setTimeout(() => setMsg(""), 2500); }}>⇄ {label}</button>
      {msg && <span className="mono">{msg}</span>}
    </span>
  );
}

export function CopyBig({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return <button type="button" className="small" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2500); } catch { setOk(false); } }}>{ok ? "Скопійовано ✓" : label}</button>;
}

export function ProductImport({ productId, compact }: { productId: number | null; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const router = useRouter();
  if (!open) return <button type="button" className="small" onClick={() => setOpen(true)}>↓ Вставити витяжку</button>;
  return (
    <div className="card st-import">
      <b>Вставити витяжку</b>
      <div className="mono">Блок [CLIENT-OPS:ПРОДУКТ] з Claude Code — Джері оновить паспорт: що це, як працює, фічі, склад, знання (що ламалось, юридичне), рішення, план.</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="[CLIENT-OPS:ПРОДУКТ] …" style={{ minHeight: "8rem" }} aria-label="Витяжка" />
      <div className="inline" style={{ flexWrap: "wrap" }}>
        <button type="button" disabled={busy || text.trim().length < 20} onClick={async () => {
          setBusy(true); setRes(null);
          const r = await productImportAction(productId, text);
          setBusy(false);
          if (r.ok) { setText(""); setRes({ ok: true, lines: r.summary }); if (!productId) router.push(`/products/${r.id}`); else router.refresh(); }
          else setRes({ ok: false, lines: [r.error] });
        }}>{busy ? "Джері розкладає… ~30 с" : "Розкласти в паспорт"}</button>
        {compact && <button type="button" className="ghost small" onClick={() => setOpen(false)}>Згорнути</button>}
      </div>
      {res && <div className={`mono ${res.ok ? "st-ok" : "st-bad"}`}>{res.ok ? "Записав: " : ""}{res.lines.join(" · ")}</div>}
    </div>
  );
}
