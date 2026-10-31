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
      "Розгорни цей стартап. 1) Ідея: заповни формулу (idea.formula), додай 2–4 альтернативи (competitor), проведи чесний стрес-тест (idea.stress + verdict). 2) Маркетинг: 1–2 сегменти з болем їхніми словами і оффером, 4–6 кутів для реклами, 1–2 канали з бюджетом і ціною ліда, воронку з ціллю клієнтів (mkt). 3) Фінанси: модель і ціна, витрати на клієнта, стартові вкладення; увімкни link_mkt. Технічну поки не чіпай. 4) Запиши 3–5 відкритих питань і найважливіші гіпотези. Потім коротко і чесно: варто чи ні, і що перевірити першим (які розмови з клієнтами провести).",
      true,
    );
  }, [sp, id, router]);
  return null;
}
