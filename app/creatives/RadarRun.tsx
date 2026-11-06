"use client";
// «Перевірити зараз»: прогін AI-радару (1–3 хв: пошук по вебу + GitHub)
import { useRouter } from "next/navigation";
import { useState } from "react";
import { radarRunAction } from "./actions";

export default function RadarRun() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();
  return (
    <span className="inline">
      <button type="button" className="small" disabled={busy} onClick={async () => {
        setBusy(true); setMsg("");
        const r = await radarRunAction();
        setBusy(false);
        setMsg(r.ok ? (r.added ? `Нових карток: ${r.added}` : "Нічого суттєвого нового") : r.error);
        router.refresh();
      }}>{busy ? "Джері шукає… 1–3 хв" : "Перевірити зараз"}</button>
      {msg && <span className="mono">{msg}</span>}
    </span>
  );
}
