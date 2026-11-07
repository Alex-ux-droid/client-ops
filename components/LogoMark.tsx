"use client";
// Значок сутності: логотип (якщо завантажений) або кольоровий кружок з першою літерою.
// editable — при наведенні «⋯»: завантажити / прибрати логотип.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PALETTE = ["#2f5e4a", "#3b5b8c", "#7a4b8c", "#8c5a2b", "#2b6f7a", "#8c3b4b", "#4b5563", "#5b6b2b"];
const color = (s: string) => PALETTE[[...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length];
const initial = (s: string) => s.replace(/^Тест:\s*/i, "").replace(/[«»"']/g, "").trim().slice(0, 1).toUpperCase() || "•";

export default function LogoMark({ kind, id, name, src, size = 40, editable }: { kind: "product" | "client" | "startup"; id: number; name: string; src?: string; size?: number; editable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inp = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off); window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); window.removeEventListener("keydown", esc); };
  }, [open]);
  const upload = async (f?: File | null) => {
    if (!f) return;
    setBusy(true); setErr("");
    const fd = new FormData(); fd.set("file", f);
    const r = await fetch(`/api/logo/${kind}/${id}`, { method: "POST", body: fd }).then((x) => x.json()).catch(() => ({ error: "Нема звʼязку" })) as { ok?: boolean; error?: string };
    setBusy(false); setOpen(false);
    if (r.ok) router.refresh(); else setErr(r.error ?? "Не вдалось");
    if (inp.current) inp.current.value = "";
  };
  const remove = async () => { setOpen(false); await fetch(`/api/logo/${kind}/${id}`, { method: "DELETE" }); router.refresh(); };
  const mark = src
    ? <img src={src} alt={name} className="lm-img" />
    : <span className="lm-letter" style={{ background: color(name), fontSize: size * 0.42 }}>{initial(name)}</span>;
  return (
    <span ref={box} className={`lm${editable ? " lm-edit" : ""}`} style={{ width: size, height: size }}>
      {mark}
      {editable && (
        <>
          <button type="button" className="lm-dots" aria-label="Логотип: дії" title="Логотип" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((x) => !x); }}>{busy ? "…" : "⋯"}</button>
          {open && (
            <span className="lm-menu" role="menu" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              <button type="button" role="menuitem" onClick={() => inp.current?.click()}>{src ? "Замінити логотип" : "Завантажити логотип"}</button>
              {src && <button type="button" role="menuitem" className="danger-text" onClick={remove}>Прибрати</button>}
            </span>
          )}
          <input ref={inp} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" hidden onChange={(e) => void upload(e.target.files?.[0])} />
          {err && <span className="lm-err">{err}</span>}
        </>
      )}
    </span>
  );
}
