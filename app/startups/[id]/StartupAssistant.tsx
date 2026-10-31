"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { openAssistant } from "@/components/assistant";

// Щойно розгорнута ідея / перенесене з Лабораторії: Джері сам відкривається і розгортає фундамент
export default function StartupAssistant({ id }: { id: number }) {
  const sp = useSearchParams();
  const router = useRouter();
  const fired = useRef(false);
  useEffect(() => {
    if (sp.get("expand") !== "1" || fired.current) return;
    fired.current = true;
    router.replace(`/startups/${id}`, { scroll: false });
    openAssistant(
      "Розгорни цей стартап: дай робочу назву і одне речення суті. Заповни опору «Ідея» повністю (біль, для кого, рішення, цінність, чому саме ми — з урахуванням того, що ти знаєш про мене і мої навички, конкуренти, метрика, ризики). У «Маркетингу» — позиціонування, оффер і канали. У «Фінансах» — модель грошей і стартові цифри калькулятора (обережно, з поясненням). Запиши 3–5 відкритих питань, 2–3 гіпотези для перевірки і перший етап плану з 3–5 задачами. Технічну частину і ТЗ поки не чіпай. Потім коротко скажи, що думаєш: варто чи ні і чому.",
      true,
    );
  }, [sp, id, router]);
  return null;
}
