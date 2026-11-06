"use client";
// Попап: на екрані — коротко (trigger), по кліку — повна інформація у віконці посередині екрана.
// Esc / клік повз / × — закрити. Вміст може бути серверним (передається як children).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function Pop({ trigger, title, sub, children, className = "pop-trigger", wide }: {
  trigger: React.ReactNode; title?: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode; className?: string; wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    // Відкрили Джері з попапу — попап закриваємо, щоб чат не опинився під ним
    const close = () => setOpen(false);
    document.documentElement.classList.add("locked");
    window.addEventListener("keydown", esc);
    window.addEventListener("assistant:open", close);
    return () => { document.documentElement.classList.remove("locked"); window.removeEventListener("keydown", esc); window.removeEventListener("assistant:open", close); };
  }, [open]);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{trigger}</button>
      {open && createPortal(
        <div className="pop-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className={`pop${wide ? " wide" : ""}`} role="dialog" aria-modal="true">
            <div className="pop-head">
              <div style={{ minWidth: 0 }}>{title && <h3>{title}</h3>}{sub && <div className="mono">{sub}</div>}</div>
              <button type="button" className="ghost small" onClick={() => setOpen(false)} aria-label="Закрити">✕</button>
            </div>
            <div className="pop-body">{children}</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
