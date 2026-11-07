"use client";
// «Перевірити зараз»: радар іде у фоні (кілька хвилин пошуку по вебу); поки йде — сторінка сама оновлюється
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { radarRunAction } from "./actions";

export default function RadarRun({ running, error }: { running: boolean; error: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(t);
  }, [running, router]);
  return (
    <span className="inline" style={{ flexWrap: "wrap" }}>
      <button type="button" className="small" disabled={busy || running} onClick={async () => {
        setBusy(true);
        await radarRunAction();
        setBusy(false);
        router.refresh();
      }}>{running ? "Джері шукає… 3–7 хв" : "Перевірити зараз"}</button>
      {running && <span className="mono">Можна піти зі сторінки — нове прийде в Telegram.</span>}
      {!running && error && <span className="mono" style={{ color: "var(--bad)" }}>{error}</span>}
    </span>
  );
}
