"use client";
// «Скласти карту ринку зараз» (≈1 хв, з карток радару)
import { useRouter } from "next/navigation";
import { useState } from "react";
import { radarMapAction } from "./actions";

export default function RadarMap() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  return (
    <div className="inline" style={{ marginTop: "0.75rem" }}>
      <button type="button" className="ghost small" disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        const r = await radarMapAction();
        setBusy(false);
        if (r.ok) router.refresh(); else setErr(r.error);
      }}>{busy ? "Джері складає… ~1 хв" : "Скласти заново зараз"}</button>
      {err && <span className="mono" style={{ color: "var(--bad)" }}>{err}</span>}
    </div>
  );
}
