"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Bot from "./Bot";
import { openAssistant } from "./assistant";

// Поради від Джері: поки Саша працює, раз на N хв (Налаштування → «Можливості») біля робота виринає коротка порада.
// Інтервал тримає сервер (/api/tips/next), тут — тільки «чи Саша зараз тут»: вкладка видима і щось робив останні 3 хв.
type Tip = { id: number; topic: string; topic_label: string; title: string; body: string };
const ASK = ["Знав це?", "Чув про таке?", "Нове для тебе?", "Як тобі таке?"];
const THANKS: Record<string, string> = { knew: "Ок, значить беру глибше 💪", new: "Клас, більше такого", boring: "Зрозумів, такого менше" };

export default function JerryTip({ hidden }: { hidden: boolean }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [ask, setAsk] = useState(ASK[0]);
  const [done, setDone] = useState("");
  const [leaving, setLeaving] = useState(false);
  const active = useRef(Date.now());
  const shown = useRef(false);
  shown.current = !!tip;

  const load = useCallback(async (force = false) => {
    try {
      const r = await fetch(`/api/tips/next${force ? "?force=1" : ""}`, { cache: "no-store" });
      const d = (await r.json()) as { tip: Tip | null };
      if (d.tip) { setAsk(ASK[Math.floor(Math.random() * ASK.length)]); setDone(""); setLeaving(false); setTip(d.tip); }
    } catch {}
  }, []);

  useEffect(() => {
    const mark = () => { active.current = Date.now(); };
    const ev = ["pointerdown", "keydown", "scroll", "pointermove"] as const;
    ev.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const check = () => {
      if (shown.current || document.hidden || Date.now() - active.current > 3 * 60_000) return;
      load();
    };
    const first = setTimeout(check, 2 * 60_000); // не одразу при відкритті
    const iv = setInterval(check, 60_000);
    const onForce = () => load(true);
    window.addEventListener("tips:show", onForce);
    return () => { ev.forEach((e) => window.removeEventListener(e, mark)); clearTimeout(first); clearInterval(iv); window.removeEventListener("tips:show", onForce); };
  }, [load]);

  const close = () => { setLeaving(true); setTimeout(() => setTip(null), 220); };
  const react = (reaction: string) => {
    if (!tip) return;
    fetch(`/api/tips/${tip.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reaction }) }).catch(() => {});
    if (reaction === "more") {
      openAssistant(`Розкажи детальніше про пораду «${tip.title}»: ${tip.body}\nЯк це застосувати в моїй роботі з клієнтами? Дай живий приклад.`, true);
      close();
      return;
    }
    setDone(THANKS[reaction] ?? "Записав");
    setTimeout(close, 1600);
  };

  if (!tip || hidden) return null;
  return (
    <div className={`jtip ${leaving ? "out" : ""}`} role="status" aria-live="polite">
      <div className="jtip-head">
        <Bot size={34} state="idle" />
        <div className="grow">
          <span className="jtip-topic">{tip.topic_label}</span>
          <div className="jtip-from">Джері: {ask}</div>
        </div>
        <button className="icon-btn jtip-x" onClick={close} aria-label="Сховати">×</button>
      </div>
      <h3 className="jtip-title">{tip.title}</h3>
      <p className="jtip-body">{tip.body}</p>
      {done ? (
        <div className="jtip-done">{done}</div>
      ) : (
        <div className="jtip-actions">
          <button className="ghost small" onClick={() => react("knew")}>Знав</button>
          <button className="small jtip-new" onClick={() => react("new")}>Нове для мене</button>
          <button className="ghost small" onClick={() => react("boring")}>Не цікаво</button>
          <button className="ghost small jtip-more" onClick={() => react("more")}>Детальніше →</button>
        </div>
      )}
    </div>
  );
}

// Кнопка «Показати пораду зараз» (Налаштування)
export function TipNowButton() {
  return <button type="button" className="ghost small" onClick={() => window.dispatchEvent(new Event("tips:show"))}>Показати пораду зараз</button>;
}
