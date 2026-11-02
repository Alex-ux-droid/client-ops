// Лабораторія → тексти назовні: пропозиція клієнту (markdown для PDF A4) і готові промпти,
// щоб у будь-якому іншому інструменті (Claude, Gamma, Canva…) зібрати презентацію. Без ШІ — миттєво і безкоштовно.
import { money } from "./config";
import { getSetting } from "./repo/settings";
import { includesList, labFinance, packageCalc, PROPOSAL, type LabFull, type LabScenario } from "./repo/lab";

const sc = (s: LabScenario) => [
  `### ${s.title}`,
  s.summary,
  s.timeline && `Терміни: ${s.timeline}`,
  (s.price_setup != null || s.price_month != null) && `Ціна: ${s.price_setup != null ? `впровадження ${money(s.price_setup)}` : ""}${s.price_setup != null && s.price_month != null ? ", " : ""}${s.price_month != null ? `${money(s.price_month)}/міс` : ""}`,
  s.steps_md && `Кроки:\n${s.steps_md}`,
  s.pros && `Плюси: ${s.pros.replace(/\n+/g, "; ")}`,
  s.cons && `Мінуси: ${s.cons.replace(/\n+/g, "; ")}`,
].filter(Boolean).join("\n");

// Автоматичні розділи пропозиції з послуг і пакетів: що входить, пакети, вигода проти ринку, рахунок
export function offerMd(l: LabFull): string[] {
  if (!l.products.length) return [];
  const out: string[] = [];
  const chosen = l.packages.find((pk) => pk.id === l.chosen_package_id) ?? null;
  const shown = chosen ? packageCalc(chosen, l.products).items : l.products;
  out.push(`## Що входить\n${shown.map((p) => {
    const inc = includesList(p.includes);
    return `**${p.name}**${p.about ? ` — ${p.about}` : ""}${inc.length ? `\n${inc.map((x) => `- ${x}`).join("\n")}` : ""}`;
  }).join("\n\n")}`);
  if (l.packages.length > 1) {
    const calcs = l.packages.map((pk) => ({ pk, c: packageCalc(pk, l.products) }));
    const head = `| Послуга | ${calcs.map(({ pk }) => `${pk.name}${pk.highlight ? " ★" : ""}`).join(" | ")} |`;
    const sep = `|---|${calcs.map(() => "---").join("|")}|`;
    const rows = l.products.map((p) => `| ${p.name} | ${calcs.map(({ pk }) => (pk.product_ids.includes(p.id) ? "✓" : "—")).join(" | ")} |`);
    const price = `| **Щомісяця** | ${calcs.map(({ c }) => `**${money(c.month)}**`).join(" | ")} |`;
    const setup = calcs.some(({ c }) => c.setup > 0) ? [`| Запуск (разово) | ${calcs.map(({ c }) => (c.setup ? money(c.setup) : "—")).join(" | ")} |`] : [];
    const tags = calcs.filter(({ pk }) => pk.tagline).map(({ pk }) => `- **${pk.name}** — ${pk.tagline}`);
    out.push(`## Пакети\n${[head, sep, ...rows, price, ...setup].join("\n")}${tags.length ? `\n\n${tags.join("\n")}` : ""}`);
  }
  const forSave = chosen ? [chosen] : l.packages;
  const saves = forSave.map((pk) => ({ pk, c: packageCalc(pk, l.products) })).filter(({ c }) => c.hasMarket && c.saveYear > 0);
  if (saves.length) out.push(`## Чому це вигідно\n${saves.map(({ pk, c }) => `- **${pk.name}**: окремо в агенціях і у фрилансерів це ≈ ${money(c.marketMonth)}/міс${c.marketSetup ? ` + ${money(c.marketSetup)} на старті` : ""}. У нас — ${money(c.month)}/міс${c.setup ? ` + ${money(c.setup)}` : ""}. **Економія ${money(c.saveYear)} за перший рік.**`).join("\n")}\n\nІ все в одних руках: реклама, заявки, CRM і звіти — без перекидання відповідальності між підрядниками.`);
  else if (!l.packages.length && l.products.some((p) => p.market_month != null || p.market_setup != null)) {
    const mm = l.products.reduce((a, p) => a + (p.market_month ?? p.price_month ?? 0), 0), ms = l.products.reduce((a, p) => a + (p.market_setup ?? p.price_setup ?? 0), 0);
    const f = labFinance(l.products);
    const save = ms + mm * 12 - f.clientYear;
    if (save > 0) out.push(`## Чому це вигідно\nОкремо на ринку ≈ ${money(mm)}/міс${ms ? ` + ${money(ms)} на старті` : ""}. У нас — ${money(f.clientMonth)}/міс${f.clientSetup ? ` + ${money(f.clientSetup)}` : ""}. **Економія ${money(save)} за перший рік.**`);
  }
  const items = shown;
  const setup = chosen ? packageCalc(chosen, l.products).setup : labFinance(l.products).clientSetup;
  const month = chosen ? packageCalc(chosen, l.products).month : labFinance(l.products).clientMonth;
  out.push(`## Рахунок${chosen ? ` — пакет «${chosen.name}»` : ""}\n| Послуга | Разово | Щомісяця |\n|---|---|---|\n${items.map((p) => `| ${p.name} | ${p.price_setup != null ? money(p.price_setup) : "—"} | ${p.price_month != null ? money(p.price_month) : "—"} |`).join("\n")}${chosen && (chosen.price_month != null || chosen.price_setup != null) ? `\n| **Ціна пакета** | **${money(setup)}** | **${money(month)}** |` : ""}\n\n- Перший платіж (запуск + перший місяць): **${money(setup + month)}**\n- Далі щомісяця: **${money(month)}**`);
  return out;
}

export function proposalMd(l: LabFull): string {
  const p = l.proposal;
  const auto = offerMd(l);
  const parts: string[] = [];
  let n = 1;
  for (const x of PROPOSAL) {
    const body = p[x.k]?.trim();
    if (body || !auto.length || (x.k !== "price")) parts.push(`## ${n++}. ${x.label}\n${body || "_ще не заповнено_"}`);
    if (x.k === "offer") for (const a of auto) parts.push(a.replace(/^## /, `## ${n++}. `));
  }
  return parts.join("\n\n");
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
    l.products.length ? `Що даємо клієнту (послуги):\n${l.products.map((p) => `- ${p.name}${p.about ? ` — ${p.about}` : ""}${includesList(p.includes).length ? ` (входить: ${includesList(p.includes).join("; ")})` : ""}${p.price_setup != null ? `, разово ${money(p.price_setup)}` : ""}${p.price_month != null ? `, ${money(p.price_month)}/міс` : ""}`).join("\n")}` : "",
    l.products.length ? (() => { const f = labFinance(l.products); return `Ціна для клієнта: разово ${money(f.clientSetup)}, щомісяця ${money(f.clientMonth)}, перший рік ${money(f.clientYear)}.`; })() : "",
    l.packages.length ? `Пакети:\n${l.packages.map((pk) => { const c = packageCalc(pk, l.products); return `- ${pk.name}${pk.highlight ? " (рекомендуємо)" : ""}${pk.id === l.chosen_package_id ? " [обраний]" : ""}: ${money(c.month)}/міс${c.setup ? ` + ${money(c.setup)} запуск` : ""}; входить: ${c.items.map((p) => p.name).join(", ") || "—"}${pk.tagline ? `; для кого: ${pk.tagline}` : ""}${c.hasMarket && c.saveYear > 0 ? `; на ринку ≈ ${money(c.marketMonth)}/міс, економія ${money(c.saveYear)} за рік` : ""}`; }).join("\n")}` : "",
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
    const auto = offerMd(l);
    return `Зроби комерційну пропозицію для клієнта: ОДИН HTML-файл (artifact), сторінки строго формату A4 вертикально (210×297 мм; кожна сторінка — окремий блок 210mm×297mm з page-break-after, щоб друк/«Зберегти як PDF» дав рівно A4). Клієнт дивиться з телефона — тому крупні заголовки, короткі абзаци, одна думка на блок. Мова — українська. Пиши для власника бізнесу: вигоди, а не технічні деталі. Не вигадуй цифр і фактів, яких нема в даних; де бракує — помітне «[уточнити]».

ДИЗАЙН — строго фірмовий, однаковий для всіх пропозицій (не вигадуй інший стиль):
- Фон сторінок #070a14 (майже чорний синюватий) з мʼяким синім світінням у правому верхньому куті (radial-gradient #3d6bff ~30% → прозоро).
- Текст #f2f4fa, другорядний #a3acc2, дрібний #6f7a94. Акцент #3d6bff. Позитив/економія #2fd0a7.
- Шрифт Onest (Google Fonts), заголовки Bold звичайним регістром (без КАПСУ), мітки над заголовком — номер розділу «01», «02» акцентом.
- Під кожним заголовком — коротка акцентна смужка 36×3 px.
- Картки: фон #10162a, рамка 1px #24304f, радіус 12px; виділена картка — фон #141c34, рамка #3d6bff.
- Галочки списків — зелені #2fd0a7, маркери — сині кружечки.
- Поля сторінки ~15 мм, внизу колонтитул: «${getSetting("proposal.from") || "[від кого]"}» зліва і номер сторінки справа, дрібно.

СТРУКТУРА (строго в такому порядку, порожні розділи пропускай):
1. Обкладинка: мітка «КОМЕРЦІЙНА ПРОПОЗИЦІЯ · дата», великий заголовок «${proposalTitle(l)}»${p.subtitle ? `, підзаголовок «${p.subtitle}»` : ""}, «Для: ${l.client_name ?? "клієнта"}»${l.chosen_package_id ? `; внизу виділена картка «РЕКОМЕНДУЄМО — пакет, ціна /міс, запуск»` : ""}.
2. Яку проблему вирішуємо + виділена картка «Чому це важливо саме для вас».
3. Що ви отримаєте — список результатів.
4. Що входить — картка на кожну послугу: назва, одне речення, що входить (галочки у 2 колонки).
5. Як ми це зробимо — таймлайн етапів (номер у кружечку, назва, термін справа, результат).
6. Пакети — 2–3 картки в ряд: назва, для кого, ціна /міс великим, запуск, галочки послуг, «Економія за рік»; рекомендований виділений з плашкою «РЕКОМЕНДУЄМО».
7. Чому це вигідно — 3 картки-цифри: «Окремо на ринку», «У нас», «Ваша економія» (зелена).
8. Рахунок — таблиця «Послуга / Разово / Щомісяця» + 2 картки: «Перший платіж» і «Далі щомісяця».
9. Ціна і підтримка, бонуси на підтримці.
10. Наступний крок — виділена картка з одним закликом.

${filled.length ? `ТЕКСТИ РОЗДІЛІВ (основа — можна стилістично причесати, зміст і цифри не міняти):\n${PROPOSAL.map((x) => `## ${x.label}\n${p[x.k]?.trim() || "[ще не заповнено — сформулюй з контексту нижче]"}`).join("\n\n")}\n\n` : ""}${auto.length ? `ПОСЛУГИ, ПАКЕТИ, ВИГОДА І РАХУНОК (цифри — точно як тут):\n${auto.join("\n\n")}\n\n` : ""}${l.stages.length ? `ЕТАПИ:\n${l.stages.map((s, i) => `${i + 1}. ${s.title}${s.duration ? ` — ${s.duration}` : ""}${s.result ? `; результат: ${s.result}` : ""}`).join("\n")}\n\n` : ""}КОНТЕКСТ (для розуміння; клієнту НЕ показувати нашу собівартість, маржу і внутрішні оцінки):\n${context(l)}`;
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
