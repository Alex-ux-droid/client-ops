"use client";
// «Новий промпт на креатив»: формат + (необовʼязково) кут і побажання → Джері пише ТЗ для Claude з даних реклами
import { useRouter } from "next/navigation";
import { useState } from "react";
import { genPromptAction } from "@/app/creatives/actions";
import type { CreativeFormat } from "@/lib/creativeLab";

export default function CreativeGen({ clientId, formats }: { clientId: number; formats: Record<string, string> }) {
  const [format, setFormat] = useState<CreativeFormat>("square");
  const [angle, setAngle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();
  return (
    <div className="stack cg-gen" style={{ gap: "0.5rem" }}>
      <div className="mk-form">
        <select value={format} onChange={(e) => setFormat(e.target.value as CreativeFormat)} aria-label="Формат">{Object.entries(formats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="Кут (або порожньо — Джері обере сам)" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Побажання: напр. «мова — німецька», «без цін»" className="wide" />
      </div>
      <div className="inline">
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); setMsg(""); const r = await genPromptAction(clientId, format, angle, note); setBusy(false); if (r.ok) { setAngle(""); setNote(""); setMsg(`Готово ✓ CR-${r.id} — у колонці «Ідеї», відкрий і скопіюй`); router.refresh(); } else setMsg(r.error); }}>{busy ? "Джері пише промпт… ~30 с" : "Скласти промпт креативу"}</button>
        {msg && <span className="mono">{msg}</span>}
      </div>
    </div>
  );
}
