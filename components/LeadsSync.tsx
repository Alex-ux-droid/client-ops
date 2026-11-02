"use client";
import { useState } from "react";
import { syncLeadsAction } from "@/app/leads/actions";

export default function LeadsSync() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="inline" style={{ flexWrap: "wrap" }}>
      <button type="button" className="ghost small" disabled={busy} onClick={async () => { setBusy(true); setMsg(""); const r = await syncLeadsAction(); setBusy(false); setMsg(r.error ? r.error : `Готово: нових заявок ${r.added}`); }}>{busy ? "Перевіряю…" : "Перевірити заявки зараз"}</button>
      {msg && <span className="mono">{msg}</span>}
    </div>
  );
}
