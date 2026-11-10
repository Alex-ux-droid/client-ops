"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { diagnoseAction } from "./diagActions";

export default function DiagRun({ clientId, label }: { clientId: number; label: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  return (
    <span className="inline" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
      <button type="button" className="small" disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        const r = await diagnoseAction(clientId).catch(() => ({ ok: false, error: "Не вдалось — спробуй ще раз" }));
        setBusy(false);
        if (r.ok) router.refresh(); else setErr(r.error ?? "Помилка");
      }}>{busy ? "Джері розбирає… до хвилини" : label}</button>
      {err && <span className="mono st-bad">{err}</span>}
    </span>
  );
}
