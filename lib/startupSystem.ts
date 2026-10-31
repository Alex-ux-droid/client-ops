// Опори стартапу як система: Ідея (формула, стрес-тест, докази), Маркетинг (сегменти, кути, канали, воронка),
// Технічна (модулі, інфраструктура з цінами, релізи з промптами), Фінанси (тягнуть цифри з маркетингу і техніки).
// Чисті функції і константи — працюють і на сервері, і в браузері.

// ---------- Ідея
export const FORMULA = [
  { k: "who", label: "Для кого", ph: "відділів продажу забудовників на 50–300 квартир" },
  { k: "pain", label: "У кого біль", ph: "менеджери ведуть шахматку в Excel і гублять ліди" },
  { k: "product", label: "Продукт", ph: "Шахматка Pro" },
  { k: "category", label: "Це", ph: "CRM з шахматкою квартир" },
  { k: "result", label: "Що дає", ph: "бачить усі квартири і ліди в одному місці і продає на 20% швидше" },
  { k: "alternative", label: "На відміну від", ph: "Excel і важких CRM на кшталт Bitrix24" },
  { k: "difference", label: "Ми", ph: "налаштовуємо за день і підключаємо рекламу з Facebook одразу" },
] as const;
export type FormulaKey = (typeof FORMULA)[number]["k"];

export function formulaText(f: Partial<Record<FormulaKey, string>>): string {
  const v = (k: FormulaKey) => f[k]?.trim();
  if (!v("who") && !v("product")) return "";
  return [
    `Для ${v("who") || "…"}${v("pain") ? `, у яких ${v("pain")}` : ""}, ${v("product") || "наш продукт"} — це ${v("category") || "…"}${v("result") ? `, що ${v("result")}` : ""}.`,
    v("alternative") || v("difference") ? `На відміну від ${v("alternative") || "…"}, ми ${v("difference") || "…"}.` : "",
  ].filter(Boolean).join(" ");
}

export const STRESS = [
  { k: "pain", label: "Біль реальна", q: "Люди самі скаржаться на це? Шукають рішення? Є докази, а не здогадки?" },
  { k: "pay", label: "За це платять", q: "Хтось уже платить за рішення (гроші, час, людей)? Чи готові платити нам?" },
  { k: "market", label: "Ринок", q: "Скільки таких клієнтів можемо досягти? Вистачить, щоб це був бізнес?" },
  { k: "why_us", label: "Чому ми", q: "Маємо перевагу: досвід, клієнтів, канал, навички? Чи будь-хто зробить те саме?" },
  { k: "competition", label: "Конкуренція", q: "Чи можемо виграти в альтернатив? Чим, і чи це важливо клієнту?" },
  { k: "build", label: "Здійсненність", q: "Чи реально зробити MVP нашими силами і бюджетом за 1–2 місяці?" },
  { k: "money", label: "Економіка", q: "Чи сходяться гроші: ціна vs витрати на клієнта і залучення?" },
] as const;
export type StressKey = (typeof STRESS)[number]["k"];

export type IdeaData = {
  formula: Partial<Record<FormulaKey, string>>;
  stress: Partial<Record<StressKey, { score: number; why: string }>>;
  verdict: string;
};
export function normIdea(raw: unknown): IdeaData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const formula: IdeaData["formula"] = {};
  const fr = (r.formula ?? {}) as Record<string, unknown>;
  for (const f of FORMULA) if (typeof fr[f.k] === "string") formula[f.k] = (fr[f.k] as string).slice(0, 400);
  const stress: IdeaData["stress"] = {};
  const sr = (r.stress ?? {}) as Record<string, { score?: unknown; why?: unknown }>;
  for (const s of STRESS) {
    const v = sr[s.k];
    const score = Math.round(Number(v?.score));
    if (v && score >= 1 && score <= 5) stress[s.k] = { score, why: String(v.why ?? "").slice(0, 1000) };
  }
  return { formula, stress, verdict: typeof r.verdict === "string" ? r.verdict.slice(0, 2000) : "" };
}
export function stressScore(d: IdeaData): { pct: number | null; scored: number; weak: StressKey[] } {
  const vals = STRESS.map((s) => d.stress[s.k]).filter(Boolean) as { score: number }[];
  return {
    pct: vals.length ? Math.round((vals.reduce((a, v) => a + v.score, 0) / (vals.length * 5)) * 100) : null,
    scored: vals.length,
    weak: STRESS.filter((s) => (d.stress[s.k]?.score ?? 5) <= 2).map((s) => s.k),
  };
}

// ---------- Маркетинг: воронка
export type MktStage = { name: string; conv: number }; // conv — % тих, хто з попереднього кроку перейшов сюди
export type MktData = { stages: MktStage[]; target: number; cpl: number };
export const MKT_DEFAULT: MktData = {
  stages: [{ name: "Кваліфікований лід", conv: 60 }, { name: "Дзвінок / демо", conv: 50 }, { name: "Оплата", conv: 30 }],
  target: 0, cpl: 0,
};
export function normMkt(raw: unknown): MktData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
  const stages = Array.isArray(r.stages)
    ? (r.stages as { name?: unknown; conv?: unknown }[]).filter((s) => s && String(s.name ?? "").trim()).slice(0, 8).map((s) => ({ name: String(s.name).slice(0, 60), conv: Math.min(100, num(s.conv)) }))
    : MKT_DEFAULT.stages;
  return { stages, target: num(r.target), cpl: num(r.cpl) };
}

export type Channel = { budget: number; cpl: number; active: boolean };
export type FunnelResult = {
  conv: number;            // лід → оплата, частка 0..1
  cpl: number;             // середня ціна ліда (з каналів за бюджетом або вручну)
  leadsNeeded: number | null; budgetNeeded: number | null; cac: number | null;
  plannedBudget: number; plannedLeads: number; plannedClients: number; // що дають канали з поточними бюджетами
  steps: { name: string; count: number | null }[]; // скільки людей на кожному кроці під ціль
};
export function calcFunnel(m: MktData, channels: Channel[]): FunnelResult {
  const conv = m.stages.reduce((a, s) => a * (s.conv / 100), 1);
  const live = channels.filter((c) => c.active && c.budget > 0 && c.cpl > 0);
  const plannedBudget = live.reduce((a, c) => a + c.budget, 0);
  const plannedLeads = live.reduce((a, c) => a + c.budget / c.cpl, 0);
  const cpl = plannedLeads > 0 ? plannedBudget / plannedLeads : m.cpl;
  const leadsNeeded = m.target > 0 && conv > 0 ? m.target / conv : null;
  let cur = leadsNeeded;
  const steps = [{ name: "Ліди", count: leadsNeeded }, ...m.stages.map((s) => ({ name: s.name, count: cur == null ? null : (cur = cur * (s.conv / 100)) }))];
  return {
    conv, cpl, leadsNeeded,
    budgetNeeded: leadsNeeded != null && cpl > 0 ? leadsNeeded * cpl : null,
    cac: conv > 0 && cpl > 0 ? cpl / conv : null,
    plannedBudget, plannedLeads, plannedClients: plannedLeads * conv,
    steps,
  };
}

// Що Фінанси беруть з інших опор: клієнти і бюджет — з воронки (під ціль або з бюджетів каналів), постійні — з інфраструктури
type ItemData = { kind: string; status: string; data: Record<string, string> };
export function finLinks(mkt: MktData, items: ItemData[]): { mktClients: number | null; mktBudget: number | null; techFixed: number | null } {
  const ch = items.filter((i) => i.kind === "channel").map((c) => ({ budget: Number(c.data.budget) || 0, cpl: Number(c.data.cpl) || 0, active: c.status !== "stopped" }));
  const f = calcFunnel(mkt, ch);
  const infra = items.filter((i) => i.kind === "infra").reduce((a, i) => a + (Number(i.data.cost) || 0), 0);
  const byTarget = mkt.target > 0 && f.budgetNeeded != null;
  return {
    mktClients: byTarget ? mkt.target : f.plannedClients > 0 ? f.plannedClients : null,
    mktBudget: byTarget ? f.budgetNeeded : f.plannedBudget > 0 ? f.plannedBudget : null,
    techFixed: infra > 0 ? infra : null,
  };
}

// ---------- Технічна: інфраструктура (стандартний чекліст; кожен пункт — вибір + ціна на місяць)
export const INFRA = [
  { k: "server", label: "Сервер / хостинг", hint: "де живе застосунок (Hetzner, Vercel, Railway…)" },
  { k: "domain", label: "Домен і HTTPS", hint: "адреса, сертифікат (Caddy/Let's Encrypt, Cloudflare)" },
  { k: "db", label: "База і бекапи", hint: "яка база, куди і як часто бекап, як відновити" },
  { k: "deploy", label: "Деплой і оновлення", hint: "як нова версія потрапляє на сервер: автодеплой з main, без простою, відкат" },
  { k: "migrations", label: "Міграції бази", hint: "як змінюється схема без втрати даних" },
  { k: "monitoring", label: "Моніторинг і помилки", hint: "хто дізнається, що лягло: uptime, логи, сповіщення в Telegram" },
  { k: "auth", label: "Вхід і доступи", hint: "як користувачі входять, ролі, де лежать ключі (.env)" },
  { k: "mail", label: "Пошта і повідомлення", hint: "листи, SMS, Telegram-бот" },
  { k: "payments", label: "Оплата", hint: "як клієнт платить: Stripe, WayForPay, LiqPay, рахунки" },
  { k: "analytics", label: "Аналітика", hint: "звідки клієнти і що вони роблять" },
  { k: "ai", label: "ШІ / зовнішні API", hint: "Claude, ElevenLabs тощо — ліміти і ціна" },
] as const;

// ---------- Готовність опор: замість «x блоків заповнено» — кроки, які реально щось означають
export type Step = { label: string; done: boolean };
type ItemLike = { kind: string; status: string; body: string; data: Record<string, string> };
export function pillarSteps(p: "idea" | "marketing" | "tech" | "finance", ctx: { idea: IdeaData; mkt: MktData; items: ItemLike[]; spec: string; financeSet: boolean }): Step[] {
  const n = (k: string) => ctx.items.filter((i) => i.kind === k).length;
  const it = (k: string) => ctx.items.filter((i) => i.kind === k);
  if (p === "idea") {
    const st = stressScore(ctx.idea);
    const conf = it("interview").filter((i) => i.data.pain === "yes").length;
    return [
      { label: "Формула ідеї", done: !!formulaText(ctx.idea.formula) && !!ctx.idea.formula.result },
      { label: "Альтернативи (2+)", done: n("competitor") >= 2 },
      { label: "Стрес-тест", done: st.scored >= STRESS.length },
      { label: "Розмови з клієнтами (5+)", done: n("interview") >= 5 },
      { label: "Біль підтвердили 3+", done: conf >= 3 },
    ];
  }
  if (p === "marketing") {
    return [
      { label: "Сегмент з оффером", done: it("segment").some((s) => s.data.offer_result) },
      { label: "Кути для реклами (3+)", done: n("angle") >= 3 },
      { label: "Канали з бюджетом", done: it("channel").some((c) => Number(c.data.budget) > 0 && Number(c.data.cpl) > 0) },
      { label: "Воронка і ціль", done: ctx.mkt.target > 0 && ctx.mkt.stages.length > 0 },
      { label: "Перший тест з результатом", done: it("angle").some((a) => a.status === "win" || a.status === "lose") },
    ];
  }
  if (p === "tech") {
    const infraDone = it("infra").filter((i) => i.status === "done").length;
    return [
      { label: "Модулі (3+)", done: n("module") >= 3 },
      { label: "Інфраструктура вирішена (6+)", done: it("infra").filter((i) => i.data.choice).length >= 6 },
      { label: "Перший реліз описаний", done: it("release").some((r) => r.body.trim()) },
      { label: "CLAUDE.md проєкту", done: !!ctx.spec.trim() },
      { label: "Промпт першого релізу", done: it("release").some((r) => r.data.prompt) },
      { label: "Інфраструктура запущена (6+)", done: infraDone >= 6 },
    ];
  }
  return [
    { label: "Ціна", done: ctx.financeSet },
    { label: "Інфраструктура з цінами", done: it("infra").some((i) => Number(i.data.cost) > 0) },
    { label: "Залучення з маркетингу", done: ctx.mkt.target > 0 },
  ];
}
