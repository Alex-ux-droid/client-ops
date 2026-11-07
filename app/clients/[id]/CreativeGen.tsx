"use client";
// «Новий креатив»: формат + (необовʼязково) кут і побажання → Джері пише ТЗ для Claude з даних реклами; готовий промпт — одразу «Скопіювати»
import { useRouter } from "next/navigation";
import { useState } from "react";
import { genPromptAction } from "@/app/creatives/actions";
import { CopyText } from "@/app/startups/[id]/CopyText";
import type { CreativeFormat } from "@/lib/creativeLab";

export default function CreativeGen({ clientId, formats }: { clientId: number; formats: Record<string, string> }) {
  const [format, setFormat] = useState<CreativeFormat>("square");
  const [angle, setAngle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ id: number; title: string; prompt: string } | null>(null);
  const router = useRouter();
  if (done) return (
    <div className="stack cg-done" style={{ gap: "0.75rem" }}>
      <div className="cg-ok"><span className="cs-code">CR-{done.id}</span><b>{done.title}</b></div>
      <p className="mono" style={{ margin: 0 }}>Встав у той самий чат Claude, де «Контекст клієнта». Код CR-{done.id} впиши в назву оголошення в Meta — цифри підтягнуться самі.</p>
      <div className="inline"><CopyText text={done.prompt} label="Скопіювати промпт" className="small" /><button type="button" className="ghost small" onClick={() => setDone(null)}>Ще один</button></div>
    </div>
  );
  return (
    <div className="stack cg-gen" style={{ gap: "0.625rem" }}>
      <label className="cg-f"><span>Формат</span><select value={format} onChange={(e) => setFormat(e.target.value as CreativeFormat)}>{Object.entries(formats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="cg-f"><span>Кут <i>необовʼязково — Джері обере сам</i></span><input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="напр. «грант до 2,5 млн»" /></label>
      <label className="cg-f"><span>Побажання <i>необовʼязково</i></span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="напр. «без цін», «мова — німецька»" /></label>
      <div className="inline">
        <button type="button" className="small" disabled={busy} onClick={async () => { setBusy(true); setErr(""); const r = await genPromptAction(clientId, format, angle, note); setBusy(false); if (r.ok) { setAngle(""); setNote(""); setDone({ id: r.id, title: r.title, prompt: r.prompt }); router.refresh(); } else setErr(r.error); }}>{busy ? "Джері пише… ~30 с" : "Скласти промпт"}</button>
        {err && <span className="mono" style={{ color: "var(--bad)" }}>{err}</span>}
      </div>
    </div>
  );
}
