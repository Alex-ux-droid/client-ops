"use client";
// Витяжка [CLIENT-OPS:КРЕАТИВ] з чату Claude → картка креативу (результат, файл, «Зроблено»)
import { useRouter } from "next/navigation";
import { useState } from "react";
import { importCreativeAction } from "@/app/creatives/actions";

export default function CreativeImport({ clientId }: { clientId: number }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const router = useRouter();
  return (
    <div className="stack" style={{ gap: "0.5rem" }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Встав блок [CLIENT-OPS:КРЕАТИВ] … [/CLIENT-OPS] з кінця чату" style={{ minHeight: "5.5rem" }} />
      <div className="inline">
        <button type="button" disabled={busy || text.trim().length < 10} onClick={async () => {
          setBusy(true); setMsg(null);
          const r = await importCreativeAction(clientId, text);
          setBusy(false);
          if (r.ok) { setText(""); setMsg({ ok: true, t: r.msg }); router.refresh(); } else setMsg({ ok: false, t: r.error });
        }}>{busy ? "Записую…" : "Записати"}</button>
        {msg && <span className="mono" style={{ color: msg.ok ? "var(--ok)" : "var(--bad)" }}>{msg.t}</span>}
      </div>
    </div>
  );
}
