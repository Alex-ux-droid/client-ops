"use client";
// Дрібні інтерактивні шматки брендбуку: плашка кольору (клік — копія HEX), завантаження файлів, вставка витяжки
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { brandImportAction } from "@/app/brand/actions";

export function ColorChip({ hex, name, role }: { hex: string; name: string; role: string }) {
  const [ok, setOk] = useState(false);
  const light = (() => { const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return r * 0.299 + g * 0.587 + b * 0.114 > 160; })();
  return (
    <button type="button" className="bb-chip" title="Клік — скопіювати HEX" onClick={async () => { try { await navigator.clipboard.writeText(hex); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* ok */ } }}>
      <span className="bb-sw" style={{ background: hex, color: light ? "#111" : "#fff" }}>{ok ? "скопійовано" : ""}</span>
      <b>{name || hex}</b>
      <span className="mono">{hex}{role ? ` · ${role}` : ""}</span>
    </button>
  );
}

export function BrandUpload({ clientId, kinds }: { clientId: number; kinds: Record<string, string> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [kind, setKind] = useState("logo");
  const inp = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const send = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.set("kind", kind);
    for (const f of Array.from(files)) fd.append("files", f);
    try {
      const r = await fetch(`/api/brand/${clientId}`, { method: "POST", body: fd });
      const j = (await r.json()) as { ok?: boolean; added?: number; error?: string };
      setMsg(j.ok ? { ok: true, t: `Додано файлів: ${j.added}` } : { ok: false, t: j.error ?? "Не вдалось" });
      if (j.ok) router.refresh();
    } catch { setMsg({ ok: false, t: "Нема звʼязку" }); }
    setBusy(false);
    if (inp.current) inp.current.value = "";
  };
  return (
    <div className="bb-up" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void send(e.dataTransfer.files); }}>
      <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Що це">{Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <button type="button" className="small" disabled={busy} onClick={() => inp.current?.click()}>{busy ? "Завантажую…" : "Завантажити файли"}</button>
      <span className="mono">або перетягни сюди · до 20 МБ</span>
      <input ref={inp} type="file" multiple hidden onChange={(e) => void send(e.target.files)} />
      {msg && <span className="mono" style={{ color: msg.ok ? "var(--ok)" : "var(--bad)" }}>{msg.t}</span>}
    </div>
  );
}

export function BrandImport({ clientId }: { clientId: number }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const router = useRouter();
  return (
    <div className="stack" style={{ gap: "0.5rem" }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Встав блок [CLIENT-OPS:БРЕНД] з Claude або просто опис бренду своїми словами" style={{ minHeight: "7rem" }} />
      <div className="inline">
        <button type="button" disabled={busy || text.trim().length < 15} onClick={async () => {
          setBusy(true); setMsg(null);
          const r = await brandImportAction(clientId, text);
          setBusy(false);
          if (r.ok) { setText(""); setMsg({ ok: true, t: `Записав: ${r.summary.join(" · ")}` }); router.refresh(); } else setMsg({ ok: false, t: r.error });
        }}>{busy ? "Джері розкладає…" : "Розкласти в брендбук"}</button>
        {msg && <span className="mono" style={{ color: msg.ok ? "var(--ok)" : "var(--bad)" }}>{msg.t}</span>}
      </div>
    </div>
  );
}
