"use client";
// Кнопка «Встановити» (Chrome / Android / комп'ютер) або інструкція для iPhone
import { useEffect, useState } from "react";

type PromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallApp() {
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const on = (e: Event) => { e.preventDefault(); setEvt(e as PromptEvent); };
    const done = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", on); window.removeEventListener("appinstalled", done); };
  }, []);

  if (installed) return <div className="mono" style={{ color: "var(--ok)" }}>✓ Відкрито як застосунок.</div>;
  if (evt) {
    return <button onClick={async () => { await evt.prompt(); const r = await evt.userChoice; if (r.outcome === "accepted") setInstalled(true); setEvt(null); }}>Встановити застосунок</button>;
  }
  return ios ? (
    <ol className="mono" style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.8 }}>
      <li>Відкрий цю сторінку в <b>Safari</b></li>
      <li>Натисни «Поділитися» (квадрат зі стрілкою) внизу</li>
      <li>«На початковий екран» → «Додати»</li>
    </ol>
  ) : (
    <ol className="mono" style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.8 }}>
      <li>Android: меню Chrome (⋮) → «Встановити застосунок» / «Додати на головний екран»</li>
      <li>Комп'ютер: значок встановлення справа в адресному рядку Chrome</li>
    </ol>
  );
}
