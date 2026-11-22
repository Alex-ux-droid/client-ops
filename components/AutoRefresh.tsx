"use client";
// Поки йде фонова робота — сторінка тихо оновлюється (server components перечитують стан)
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AutoRefresh({ every = 5000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, every);
    return () => clearInterval(t);
  }, [router, every]);
  return null;
}
