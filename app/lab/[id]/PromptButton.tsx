"use client";
import { useState } from "react";

// «Промпт»: готовий текст з даних сесії — скопіювати і зібрати презентацію в іншому інструменті
const KINDS = [
  { k: "proposal", l: "Презентація-пропозиція для клієнта (A4)" },
  { k: "scenarios", l: "Сценарії рішення" },
  { k: "compare", l: "Порівняння варіантів" },
] as const;

export default function PromptButton({ labId, kind, label = "Промпт" }: { labId: number; kind?: (typeof KINDS)[number]["k"]; label?: string }) {
  const [menu, setMenu] = useState(false);
  const [data, setData] = useState<{ title: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const open = async (k: string) => {
    setMenu(false);
    const r = await fetch(`/api/lab/${labId}/prompt?kind=${k}`, { cache: "no-store" });
    if (r.ok) { setData(await r.json()); setCopied(false); }
  };
  const copy = async () => {
    if (!data) return;
    try { await navigator.clipboard.writeText(data.text); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span className="pr-wrap">
      <button type="button" className="ghost small" onClick={() => (kind ? open(kind) : setMenu((m) => !m))}>✦ {label}</button>
      {menu && (
        <>
          <div className="chat-menu-shade" onClick={() => setMenu(false)} />
          <div className="chat-menu pr-menu" role="menu">
            {KINDS.map((x) => <button key={x.k} type="button" role="menuitem" onClick={() => open(x.k)}><span>{x.l}</span></button>)}
          </div>
        </>
      )}
      {data && (
        <div className="tm-over" onClick={() => setData(null)} role="dialog" aria-modal>
          <div className="tm-box pr-box" onClick={(e) => e.stopPropagation()}>
            <div className="tm-head"><b className="grow">Промпт: {data.title}</b><button type="button" className="ghost small" onClick={() => setData(null)} aria-label="Закрити">✕</button></div>
            <p className="lab-muted" style={{ margin: 0 }}>Скопіюй і встав у Claude, Gamma чи інший інструмент — там збереться презентація з даних цієї сесії.</p>
            <textarea readOnly value={data.text} className="pr-text" />
            <div className="inline"><button type="button" onClick={copy}>{copied ? "Скопійовано ✓" : "Копіювати промпт"}</button></div>
          </div>
        </div>
      )}
    </span>
  );
}
