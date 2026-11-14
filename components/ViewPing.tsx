"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// Рахує відкриті розділи (без даних, тільки адреса) → Налаштування → Витрати → «Що відкриваєш»
export default function ViewPing() {
  const path = usePathname();
  const sp = useSearchParams();
  const search = sp.toString();
  useEffect(() => {
    const t = setTimeout(() => { fetch("/api/view", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, search }), keepalive: true }).catch(() => {}); }, 1500);
    return () => clearTimeout(t);
  }, [path, search]);
  return null;
}
