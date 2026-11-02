"use client";
// Автовихід на «чужому компʼютері»: якщо 30 хв нічого не робили — на сторінку входу (дані не лишаються на екрані).
// Поки людина щось робить — раз на 4 хв пінгуємо сервер, щоб сесія продовжувалась і без переходів по сторінках.
import { useEffect } from "react";

const IDLE_MS = 30 * 60_000, PING_MS = 4 * 60_000;

export default function SessionGuard() {
  useEffect(() => {
    let idle = false, last = Date.now(), pinged = Date.now(), stop = false;
    fetch("/api/ping", { cache: "no-store" }).then((r) => r.json()).then((d: { idle?: boolean }) => { idle = !!d.idle; }).catch(() => {});
    const out = () => { stop = true; window.location.href = "/login"; };
    const act = () => {
      if (!idle || stop) return;
      const now = Date.now();
      if (now - last > IDLE_MS) return out();
      last = now;
      if (now - pinged > PING_MS) { pinged = now; fetch("/api/ping", { cache: "no-store" }).then((r) => { if (r.status === 401) out(); }).catch(() => {}); }
    };
    const tick = () => { if (idle && !stop && Date.now() - last > IDLE_MS) out(); };
    const ev = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    ev.forEach((e) => window.addEventListener(e, act, { passive: true }));
    document.addEventListener("visibilitychange", tick);
    const t = setInterval(tick, 30_000);
    return () => { ev.forEach((e) => window.removeEventListener(e, act)); document.removeEventListener("visibilitychange", tick); clearInterval(t); };
  }, []);
  return null;
}
