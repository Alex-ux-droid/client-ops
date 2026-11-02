// Лабораторія → тексти назовні: пропозиція клієнту (markdown для PDF A4) і готові промпти,
// щоб у будь-якому іншому інструменті (Claude, Gamma, Canva…) зібрати презентацію. Без ШІ — миттєво і безкоштовно.
import { money } from "./config";
import { labFinance, PROPOSAL, type LabFull, type LabScenario } from "./repo/lab";

const sc = (s: LabScenario) => [
  `### ${s.title}`,
  s.summary,
  s.timeline && `Терміни: ${s.timeline}`,
  (s.price_setup != null || s.price_month != null) && `Ціна: ${s.price_setup != null ? `впровадження ${money(s.price_setup)}` : ""}${s.price_setup != null && s.price_month != null ? ", " : ""}${s.price_month != null ? `${money(s.price_month)}/міс` : ""}`,
  s.steps_md && `Кроки:\n${s.steps_md}`,
  s.pros && `Плюси: ${s.pros.replace(/\n+/g, "; ")}`,
  s.cons && `Мінуси: ${s.cons.replace(/\n+/g, "; ")}`,
].filter(Boolean).join("\n");

export function proposalMd(l: LabFull): string {
  const p = l.proposal;
  return PROPOSAL.map((x, i) => `## ${i + 1}. ${x.label}\n${p[x.k]?.trim() || "_ще не заповнено_"}`).join("\n\n");
}
export const proposalTitle = (l: LabFull) => l.proposal.title?.trim() || `Пропозиція для ${l.client_name ?? "клієнта"}`;

function context(l: LabFull): string {
  const chosen = l.scenarios.find((s) => s.id === l.chosen_scenario_id);
  const opts = l.options.map((o) => `- ${o.name}${o.about ? ` — ${o.about}` : ""}${o.total != null ? ` (оцінка ${o.total}%)` : ""}${o.price_month != null ? `, ${money(o.price_month)}/міс` : ""}${o.price_setup != null ? `, впровадження ${money(o.price_setup)}` : ""}`).join("\n");
  return [
    `Клієнт: ${l.client_name ?? "—"}`,
    `Задача клієнта:\n${l.brief || "—"}`,
    opts && `Варіанти, які порівнювали:\n${opts}`,
    chosen ? `ОБРАНИЙ СЦЕНАРІЙ:\n${sc(chosen)}` : l.scenarios.length ? `Сценарії:\n${l.scenarios.map(sc).join("\n\n")}` : "",
    l.products.length ? `Що даємо клієнту (продукти):\n${l.products.map((p) => `- ${p.name}${p.about ? ` — ${p.about}` : ""}${p.price_setup != null ? `, разово ${money(p.price_setup)}` : ""}${p.price_month != null ? `, ${money(p.price_month)}/міс` : ""}`).join("\n")}` : "",
    l.products.length ? (() => { const f = labFinance(l.products); return `Ціна для клієнта: разово ${money(f.clientSetup)}, щомісяця ${money(f.clientMonth)}, перший рік ${money(f.clientYear)}.`; })() : "",
    l.stages.length ? `Етапи роботи:\n${l.stages.map((s, i) => `${i + 1}. ${s.title}${s.duration ? ` (${s.duration})` : ""}${s.result ? ` — результат: ${s.result}` : ""}\n${s.steps_md.trim()}`).join("\n\n")}` : "",
    l.conclusion && `Висновок:\n${l.conclusion}`,
  ].filter(Boolean).join("\n\n");
}

export const PROMPT_KINDS = {
  proposal: "Презентація-пропозиція для клієнта (A4)",
  scenarios: "Сценарії рішення для обговорення",
  compare: "Порівняння варіантів",
} as const;
export type PromptKind = keyof typeof PROMPT_KINDS;

export function labPrompt(l: LabFull, kind: PromptKind): string {
  if (kind === "proposal") {
    const p = l.proposal;
    const filled = PROPOSAL.filter((x) => p[x.k]?.trim());
    return `Зроби комерційну пропозицію-презентацію для клієнта у форматі A4 (вертикально), 5–7 сторінок. Мова — українська. Стиль: чистий, діловий, сучасний; темно-синій/чорний з акцентом #3d6bff, шрифт без засічок (Onest або схожий), багато повітря, крупні заголовки, на кожній сторінці одна думка. Пиши для власника бізнесу: простими словами, вигоди замість технічних деталей. Не вигадуй цифр і фактів, яких нема в даних нижче; де бракує — залиш помітне місце «[уточнити]».

Структура (строго в такому порядку):
1. Обкладинка: «${proposalTitle(l)}»${p.subtitle ? `, підзаголовок «${p.subtitle}»` : ""}, для ${l.client_name ?? "клієнта"}.
2. Проблема — що зараз не так.
3. Чому це проблема саме у вас — що бізнес втрачає без рішення (гроші, ліди, час, контроль), бажано з цифрами.
4. Що ми дамо — перелік результатів, які отримає клієнт (можна іконками/картками).
5. Ціна і підтримка — впровадження, щомісячна підтримка, що в неї входить, терміни (таблиця або картки з цінами).
6. Бонуси на підтримці — що отримає додатково, якщо лишиться на підтримці.
7. Наступний крок — один чіткий заклик (зустріч / старт).

${filled.length ? `ТЕКСТИ РОЗДІЛІВ (основа, можна стилістично причесати, зміст не міняти):\n${PROPOSAL.map((x) => `## ${x.label}\n${p[x.k]?.trim() || "[ще не заповнено — сформулюй з контексту нижче]"}`).join("\n\n")}\n\n` : ""}КОНТЕКСТ (для розуміння, клієнту напряму не показувати внутрішні оцінки):\n${context(l)}`;
  }
  if (kind === "scenarios") {
    return `Зроби коротку презентацію (A4 або слайди 16:9 — як зручніше) з ${l.scenarios.length || 3} сценаріями рішення для обговорення з клієнтом ${l.client_name ?? ""}. Українською, просто, без технічного жаргону. Для кожного сценарію: суть одним реченням, що клієнт отримає, кроки впровадження, терміни, ціна (разово / щомісяця), плюси і мінуси. В кінці — порівняльна таблиця сценаріїв і наша рекомендація з поясненням. Не вигадуй цифр, яких нема в даних; де бракує — «[уточнити]».

ДАНІ:
Задача клієнта:
${l.brief || "—"}

${l.scenarios.length ? l.scenarios.map(sc).join("\n\n") : "Сценаріїв ще нема — запропонуй 3 (швидкий старт / оптимальний / максимальний) на основі варіантів нижче."}

Варіанти інструментів:
${l.options.map((o) => `- ${o.name}${o.about ? ` — ${o.about}` : ""}${o.price_month != null ? `, ${money(o.price_month)}/міс` : ""}`).join("\n") || "—"}`;
  }
  const crit = l.criteria.map((c) => `${c.name} (вага ${c.weight})`).join(", ");
  return `Зроби наочне порівняння варіантів для клієнта ${l.client_name ?? ""} (A4 або слайд): таблиця з оцінками, ціни, плюси/мінуси і висновок. Українською, просто. Не вигадуй цифр.

Що треба клієнту:
${l.brief || "—"}

Критерії: ${crit || "—"}

${l.options.map((o) => `### ${o.name}${o.total != null ? ` — разом ${o.total}%` : ""}\n${o.about}\nЦіна: ${o.price_month != null ? `${money(o.price_month)}/міс` : "—"}${o.price_setup != null ? `, впровадження ${money(o.price_setup)}` : ""}\nОцінки: ${l.criteria.map((c) => `${c.name}: ${o.scores[c.id] ?? "—"}/5`).join("; ")}\nПлюси: ${o.pros.replace(/\n+/g, "; ") || "—"}\nМінуси: ${o.cons.replace(/\n+/g, "; ") || "—"}`).join("\n\n")}

${l.conclusion ? `Наш висновок:\n${l.conclusion}` : ""}`;
}
