"use client";
// «Перевірити зараз»: радар іде у фоні (10–25 хв на 6 напрямків); поки йде — сторінка сама оновлюється
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { radarRunAction } from "./actions";

export default function RadarRun({ running, error, area }: { running: boolean; error: string; area?: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => router.refresh(), 20000);
    return () => clearInterval(t);
  }, [running, router]);
  return (
    <span className="inline" style={{ flexWrap: "wrap" }}>
      <button type="button" className="small" disabled={busy || running} onClick={async () => {
        setBusy(true);
        await radarRunAction(area);
        setBusy(false);
        router.refresh();
      }}>{running ? "Джері шукає…" : area ? "Перевірити цей напрямок" : "Перевірити зараз"}</button>
      {running && <span className="mono">{area ? "≈3–7 хв" : "≈10–25 хв"} у фоні — можна піти, нове прийде в Telegram.</span>}
      {!running && error && <span className="mono" style={{ color: "var(--bad)" }}>{error}</span>}
    </span>
  );
}
