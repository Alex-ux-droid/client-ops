"use client";
// Імпорт Excel і «Перевірити зараз» для конкурентів
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { competitorCheckAction } from "@/app/competitors/actions";

export function CompImport({ clientId }: { clientId: number }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const inp = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const send = async (f?: File | null) => {
    if (!f) return;
    setBusy(true); setMsg(null);
    const fd = new FormData(); fd.set("file", f);
    try {
      const r = await fetch(`/api/competitors/${clientId}`, { method: "POST", body: fd });
      const j = (await r.json()) as { ok?: boolean; added?: number; updated?: number; insights?: number; levels?: number; error?: string };
      setMsg(j.ok ? { ok: true, t: `Нових ${j.added}, оновлено ${j.updated}${j.levels ? `, рівнів ${j.levels}` : ""}${j.insights ? `, висновків ${j.insights}` : ""}` } : { ok: false, t: j.error ?? "Не вдалось" });
      if (j.ok) router.refresh();
    } catch { setMsg({ ok: false, t: "Нема звʼязку" }); }
    setBusy(false);
    if (inp.current) inp.current.value = "";
  };
  return (
    <div className="bb-up" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void send(e.dataTransfer.files[0]); }}>
      <button type="button" className="small" disabled={busy} onClick={() => inp.current?.click()}>{busy ? "Читаю файл…" : "Імпорт з Excel"}</button>
      <span className="mono">.xlsx — колонки «Компанія», «Рівень», «Сайт», «Загроза»… знайдуться самі; повтори оновлюються</span>
      <input ref={inp} type="file" accept=".xlsx" hidden onChange={(e) => void send(e.target.files?.[0])} />
      {msg && <span className="mono" style={{ color: msg.ok ? "var(--ok)" : "var(--bad)" }}>{msg.t}</span>}
    </div>
  );
}

export function CompCheck({ id }: { id: number }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();
  return (
    <span className="inline">
      <button type="button" className="small" disabled={busy} onClick={async () => { setBusy(true); setMsg(""); const r = await competitorCheckAction(id); setBusy(false); setMsg(r.ok ? "Готово — у журналі" : r.error); router.refresh(); }}>{busy ? "Джері дивиться… ~1–2 хв" : "Перевірити зараз"}</button>
      {msg && <span className="mono">{msg}</span>}
    </span>
  );
}
