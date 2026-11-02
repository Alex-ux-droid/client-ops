"use client";
// Активна вкладка клієнта — завжди видно в смузі вкладок (без стрибків при переході)
import { useEffect } from "react";

export default function TabsScroll({ tab }: { tab: string }) {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".hub-tabs");
    const on = nav?.querySelector<HTMLElement>("a.on");
    if (nav && on) nav.scrollTo({ left: Math.max(0, on.offsetLeft - nav.clientWidth / 2 + on.clientWidth / 2), behavior: "auto" });
  }, [tab]);
  return null;
}
