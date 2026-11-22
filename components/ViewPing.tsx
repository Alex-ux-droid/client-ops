"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// Трекер користування → Налаштування → «Користування»: відкриті розділи і натиснуті кнопки/посилання (лише підпис, без даних)
const send = (body: object) => fetch("/api/view", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});

export default function ViewPing() {
  const path = usePathname();
  const sp = useSearchParams();
  const search = sp.toString();
  useEffect(() => {
    const t = setTimeout(() => send({ path, search }), 1500);
    return () => clearTimeout(t);
  }, [path, search]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest("a, button, summary, [role=button], [role=tab]") as HTMLElement | null;
      if (!el || el.closest("[data-no-track]")) return;
      const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").replace(/\s+/g, " ").trim().slice(0, 60);
      if (label && !/^\d+$/.test(label)) send({ path: location.pathname, search: location.search.slice(1), label });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
