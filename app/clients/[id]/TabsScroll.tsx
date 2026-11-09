"use client";
// Активна вкладка клієнта — завжди видно в смузі вкладок (без стрибків при переході).
// Запасне закріплення: якщо браузер (старий Safari) не тримає position: sticky — фіксуємо смугу під верхньою панеллю самі.
import { useEffect } from "react";

export default function TabsScroll({ tab }: { tab: string }) {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".hub-tabs");
    const on = nav?.querySelector<HTMLElement>("a.on");
    if (nav && on) nav.scrollTo({ left: Math.max(0, on.offsetLeft - nav.clientWidth / 2 + on.clientWidth / 2), behavior: "auto" });
  }, [tab]);

  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".hub-tabs");
    if (!nav || getComputedStyle(nav).display === "none") return;
    const spacer = document.createElement("div");
    nav.before(spacer);
    let fixed = false;
    const barH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h")) || 60;
    const check = () => {
      const top = barH();
      const anchor = spacer.getBoundingClientRect().top;
      const shouldFix = anchor < top;
      // sticky працює — смуга сама стоїть на top; не чіпаємо
      if (!fixed && shouldFix && Math.abs(nav.getBoundingClientRect().top - top) < 2) return;
      if (shouldFix && !fixed) { spacer.style.height = `${nav.offsetHeight}px`; nav.classList.add("hub-tabs-fixed"); nav.style.top = `${top}px`; fixed = true; }
      else if (!shouldFix && fixed) { spacer.style.height = "0"; nav.classList.remove("hub-tabs-fixed"); nav.style.top = ""; fixed = false; }
    };
    window.addEventListener("scroll", check, { passive: true });
    check();
    return () => { window.removeEventListener("scroll", check); spacer.remove(); nav.classList.remove("hub-tabs-fixed"); nav.style.top = ""; };
  }, []);
  return null;
}
