"use client";
// Посилання від Саші (пост, відео, репо) → Джері відкриває і робить картку радару
import { useRouter } from "next/navigation";
import { useState } from "react";
import { radarLinkAction } from "./actions";

export default function RadarLink() {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const router = useRouter();
  return (
    <div className="card stack rd-link" style={{ gap: "0.5rem" }}>
      <b>Кинути посилання в радар</b>
      <div className="inline" style={{ flexWrap: "wrap" }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… пост, відео, репо, стаття" style={{ flex: 2, minWidth: "12rem" }} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Чому цікаво (необовʼязково)" style={{ flex: 1, minWidth: "10rem" }} />
        <button type="button" className="small" disabled={busy || !url.trim()} onClick={async () => {
          setBusy(true); setMsg(null);
          const r = await radarLinkAction(url, note);
          setBusy(false);
          if (r.ok) { setUrl(""); setNote(""); setMsg({ ok: true, t: `Картка: ${r.title}` }); router.refresh(); } else setMsg({ ok: false, t: r.error });
        }}>{busy ? "Джері читає… ~1 хв" : "Розібрати"}</button>
      </div>
      {msg ? <span className="mono" style={{ color: msg.ok ? "var(--ok)" : "var(--bad)" }}>{msg.t}</span> : <span className="mono">Або в Telegram Джері: посилання + слово «радар».</span>}
    </div>
  );
}
