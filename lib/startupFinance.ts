// Фінанси стартапу: калькулятор окупності. Чисті функції — працюють і на сервері (Джері, експорт), і в браузері (живий калькулятор).

export type FinModel = "sub" | "once";
export type Finance = {
  model: FinModel;     // sub — підписка щомісяця; once — разовий продаж
  price: number;       // ціна для клієнта: за місяць (sub) або за продаж (once)
  setup: number;       // разове підключення (тільки sub)
  unit_cost: number;   // витрати на одного клієнта: за місяць (sub) або на один продаж (once)
  fixed: number;       // постійні витрати на місяць: сервери, сервіси, люди
  marketing: number;   // реклама на місяць
  new_clients: number; // нових клієнтів (продажів) у перший місяць
  growth: number;      // зростання продажів, % на місяць
  churn: number;       // відтік клієнтів, % на місяць (sub)
  invest: number;      // стартові вкладення: розробка, дизайн, юристи
  goal: number;        // бажаний прибуток на місяць
};

export const FIN_FIELDS: { k: Exclude<keyof Finance, "model">; label: string; hint: string; pct?: boolean; count?: boolean; only?: FinModel }[] = [
  { k: "price", label: "Ціна", hint: "за місяць підписки або за один продаж" },
  { k: "setup", label: "Підключення", hint: "разово з нового клієнта", only: "sub" },
  { k: "unit_cost", label: "Витрати на клієнта", hint: "сервер, API, підтримка — на 1 клієнта/міс (або на продаж)" },
  { k: "fixed", label: "Постійні витрати / міс", hint: "сервери, сервіси, люди — незалежно від клієнтів" },
  { k: "marketing", label: "Реклама / міс", hint: "бюджет на залучення" },
  { k: "new_clients", label: "Нових клієнтів / міс", hint: "у перший місяць продажів", count: true },
  { k: "growth", label: "Ріст продажів", hint: "% на місяць", pct: true },
  { k: "churn", label: "Відтік", hint: "% клієнтів, що йдуть щомісяця", pct: true, only: "sub" },
  { k: "invest", label: "Стартові вкладення", hint: "розробка, дизайн, юристи — до першого продажу" },
  { k: "goal", label: "Хочу заробляти / міс", hint: "чистими — порахуємо, скільки треба клієнтів" },
];

export const FIN_DEFAULT: Finance = { model: "sub", price: 0, setup: 0, unit_cost: 0, fixed: 0, marketing: 0, new_clients: 0, growth: 0, churn: 5, invest: 0, goal: 0 };

export function normFinance(raw: Record<string, unknown> | null | undefined): Finance {
  const f = { ...FIN_DEFAULT };
  if (!raw) return f;
  if (raw.model === "once" || raw.model === "sub") f.model = raw.model;
  for (const { k } of FIN_FIELDS) {
    const n = Number(String(raw[k] ?? "").replace(",", ".").replace(/[^\d.-]/g, ""));
    if (raw[k] !== undefined && raw[k] !== "" && Number.isFinite(n)) f[k] = Math.max(0, n);
  }
  return f;
}
export const hasFinance = (f: Finance) => f.price > 0;

export type FinMonth = { m: number; sales: number; clients: number; revenue: number; costs: number; profit: number; cumulative: number };
export type FinResult = {
  months: FinMonth[];          // 24 місяці
  year: { revenue: number; costs: number; profit: number; clients: number; sales: number };
  payback: number | null;      // місяць, коли вкладення повернулись (null — не за 36 міс)
  margin: number;              // скільки лишається з одного клієнта/продажу після витрат на нього
  cac: number | null;          // ціна залучення клієнта
  ltv: number | null;          // скільки приносить клієнт за весь час (sub)
  breakEven: number | null;    // скільки клієнтів (sub) або продажів на місяць (once), щоб вийти в нуль
  forGoal: number | null;      // скільки — щоб заробляти goal
};

export function calcFinance(f: Finance): FinResult {
  const sub = f.model === "sub";
  const churn = sub ? Math.min(f.churn, 100) / 100 : 0;
  const months: FinMonth[] = [];
  let clients = 0, cum = -f.invest, payback: number | null = f.invest <= 0 ? 0 : null;
  for (let m = 1; m <= 36; m++) {
    const sales = f.new_clients * Math.pow(1 + f.growth / 100, m - 1);
    clients = sub ? clients * (1 - churn) + sales : 0;
    const revenue = sub ? clients * f.price + sales * f.setup : sales * f.price;
    const costs = f.fixed + f.marketing + (sub ? clients * f.unit_cost : sales * f.unit_cost);
    const profit = revenue - costs;
    cum += profit;
    if (payback == null && cum >= 0) payback = m;
    if (m <= 24) months.push({ m, sales, clients, revenue, costs, profit, cumulative: cum });
  }
  const y = months.slice(0, 12);
  const sum = (k: keyof FinMonth) => y.reduce((a, x) => a + (x[k] as number), 0);
  const margin = f.price - f.unit_cost;
  const cac = f.new_clients > 0 && f.marketing > 0 ? f.marketing / f.new_clients : null;
  const ltv = sub && churn > 0 ? margin / churn + f.setup : null;
  const need = (extra: number) => (margin > 0 ? (f.fixed + f.marketing + extra) / margin : null);
  return {
    months, payback,
    year: { revenue: sum("revenue"), costs: sum("costs"), profit: sum("profit"), clients: y[11]?.clients ?? 0, sales: sum("sales") },
    margin, cac, ltv, breakEven: need(0), forGoal: f.goal > 0 ? need(f.goal) : null,
  };
}

// Коротко текстом — для Джері, експорту і PDF
export function financeSummary(f: Finance, fmt: (n: number) => string): string {
  if (!hasFinance(f)) return "Цифр ще нема.";
  const r = calcFinance(f);
  const unit = f.model === "sub" ? "клієнтів" : "продажів на місяць";
  return [
    `Модель: ${f.model === "sub" ? `підписка ${fmt(f.price)}/міс${f.setup ? ` + підключення ${fmt(f.setup)}` : ""}` : `разовий продаж ${fmt(f.price)}`}.`,
    `Витрати: на клієнта ${fmt(f.unit_cost)}, постійні ${fmt(f.fixed)}/міс, реклама ${fmt(f.marketing)}/міс, стартові вкладення ${fmt(f.invest)}.`,
    `План: ${Math.round(f.new_clients)} нових/міс, ріст ${f.growth}%/міс${f.model === "sub" ? `, відтік ${f.churn}%/міс` : ""}.`,
    `Перший рік: виручка ${fmt(r.year.revenue)}, витрати ${fmt(r.year.costs)}, прибуток ${fmt(r.year.profit)}${f.model === "sub" ? `, клієнтів на кінець року ${Math.round(r.year.clients)}` : `, продажів ${Math.round(r.year.sales)}`}.`,
    `Окупність: ${r.payback == null ? "не окупається за 3 роки" : r.payback === 0 ? "вкладень нема" : `на ${r.payback}-й місяць`}.`,
    r.breakEven != null ? `Вихід у нуль: ${Math.ceil(r.breakEven)} ${unit}.` : "З одного клієнта нічого не лишається — ціна нижча за витрати на нього.",
    r.forGoal != null ? `Щоб заробляти ${fmt(f.goal)}/міс: ${Math.ceil(r.forGoal)} ${unit}.` : "",
    r.cac != null ? `Ціна залучення клієнта (CAC): ${fmt(r.cac)}.` : "",
    r.ltv != null ? `Клієнт приносить за весь час (LTV): ${fmt(r.ltv)}${r.cac ? `, LTV/CAC = ${(r.ltv / r.cac).toFixed(1)}` : ""}.` : "",
  ].filter(Boolean).join("\n");
}
