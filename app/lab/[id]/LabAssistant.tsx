"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { openAssistant } from "@/components/assistant";

// Щойно створена сесія: головний помічник сам відкривається і розгортає ідею. Нічого не малює.
export default function LabAssistant({ id }: { id: number }) {
  const sp = useSearchParams();
  const router = useRouter();
  const fired = useRef(false);
  useEffect(() => {
    if (sp.get("start") !== "1" || fired.current) return;
    fired.current = true;
    router.replace(`/lab/${id}`, { scroll: false });
    openAssistant(`Розгорни цю сесію: визнач, що підбираємо, додай критерії з вагами і 2–4 варіанти під проблему і бюджет клієнта.`, true);
  }, [sp, id, router]);
  return null;
}
