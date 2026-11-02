import { db } from "../db";

export const LAB_CATEGORIES = {
  crm: { label: "CRM", tool: "crm" },
  telephony: { label: "Телефонія", tool: "telephony" },
  site: { label: "Сайт", tool: "site" },
  other: { label: "Інше", tool: null },
} as const;
export type LabCategory = keyof typeof LAB_CATEGORIES;
export const isLabCategory = (c: string): c is LabCategory => c in LAB_CATEGORIES;

// Стартові критерії — потім Саша правит під клієнта
const TEMPLATES: Record<LabCategory, [string, number][]> = {
  crm: [
    ["Ціна під бюджет клієнта", 3], ["Простота для менеджерів", 3], ["Воронки і автоматизації", 2],
    ["Інтеграція з телефонією", 2], ["Ліди з сайту і реклами", 2], ["Мобільний додаток", 1],
    ["Українська мова і підтримка", 1], ["Швидкість впровадження", 2],
  ],
  telephony: [
    ["Ціна (номери + хвилини)", 3], ["Запис і прослуховування дзвінків", 3], ["Інтеграція з CRM", 3],
    ["Черги і переадресація", 2], ["Коллтрекінг", 1], ["Якість зв'язку", 2],
  ],
  site: [
    ["Ціна розробки і підтримки", 3], ["Швидкість запуску", 2], ["Клієнт сам редагує", 2],
    ["SEO і швидкість сайту", 2], ["Інтеграції (CRM, форми, оплати)", 2],
  ],
  other: [],
};

export type LabSession = {
  id: number; client_id: number | null; client_name: string | null; title: string; category: LabCategory; status: "open" | "done";
  brief: string; notes: string; conclusion: string; chosen_option_id: number | null; created_at: string; done_at: string | null;
  proposal_json: string; chosen_scenario_id: number | null; mode: "choose" | "solution"; chosen_package_id: number | null;
  options_count?: number;
};
export type LabCriterion = { id: number; session_id: number; name: string; weight: number };
export type LabOption = {
  id: number; session_id: number; name: string; tool_id: number | null; link: string;
  price_month: number | null; price_setup: number | null; pros: string; cons: string; notes: string; about: string;
};
// Сценарій — покроковий варіант рішення з ціною і термінами
export type LabScenario = { id: number; session_id: number; title: string; summary: string; steps_md: string; timeline: string; price_setup: number | null; price_month: number | null; pros: string; cons: string; position: number };
// Пропозиція клієнту (A4): 5 розділів
export const PROPOSAL = [
  { k: "problem", label: "Проблема", q: "Яку проблему вирішуємо — коротко і зрозуміло клієнту" },
  { k: "why", label: "Чому це проблема саме у вас", q: "Що клієнт втрачає без рішення: гроші, ліди, час, контроль. Конкретно про його бізнес, з цифрами, якщо є" },
  { k: "offer", label: "Що ми дамо", q: "Перелік: що отримає клієнт, по пунктах — результат, а не технічні деталі" },
  { k: "price", label: "Ціна і підтримка", q: "Скільки коштує впровадження, щомісячна підтримка, що в неї входить, терміни" },
  { k: "bonuses", label: "Бонуси на підтримці", q: "Що додатково отримає, якщо лишиться на підтримці: плюшки, пріоритет, щомісячні звіти тощо" },
] as const;
export type ProposalKey = (typeof PROPOSAL)[number]["k"];
export type Proposal = Partial<Record<ProposalKey | "title" | "subtitle", string>>;
export const parseProposal = (j: string | null | undefined): Proposal => { try { return JSON.parse(j || "{}") as Proposal; } catch { return {}; } };

// Режим «рішення»: складові (продукти) з ціною для клієнта і собівартістю, етапи покроково
export const PRODUCT_TYPES = { ours: "наша робота", service: "сервіс", contractor: "підрядник" } as const;
export type LabProduct = { id: number; session_id: number; name: string; about: string; ptype: keyof typeof PRODUCT_TYPES; price_setup: number | null; price_month: number | null; cost_setup: number | null; cost_month: number | null; notes: string; position: number;
  includes: string; market_setup: number | null; market_month: number | null };
// Пакет послуг: набір послуг з однією ціною (null — сума послуг)
export type LabPackage = { id: number; session_id: number; name: string; tagline: string; price_setup: number | null; price_month: number | null; highlight: number; position: number; product_ids: number[] };
export type ServiceTemplate = { id: number; name: string; about: string; includes: string; ptype: string; price_setup: number | null; price_month: number | null; cost_setup: number | null; cost_month: number | null; market_setup: number | null; market_month: number | null; updated_at: string };
export const includesList = (s: string) => s.split("\n").map((x) => x.replace(/^\s*([-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
// Ціна пакета: власна або сума послуг; ринкова — сума ринкових (де не вказано — ціна послуги); економія для клієнта
export function packageCalc(pk: LabPackage, products: LabProduct[]) {
  const items = products.filter((p) => pk.product_ids.includes(p.id));
  const sum = (k: "price_setup" | "price_month" | "cost_setup" | "cost_month") => items.reduce((a, p) => a + (p[k] ?? 0), 0);
  const setup = pk.price_setup ?? sum("price_setup"), month = pk.price_month ?? sum("price_month");
  const mSetup = items.reduce((a, p) => a + (p.market_setup ?? p.price_setup ?? 0), 0);
  const mMonth = items.reduce((a, p) => a + (p.market_month ?? p.price_month ?? 0), 0);
  const hasMarket = items.some((p) => p.market_month != null || p.market_setup != null);
  return {
    items, setup, month, year: setup + month * 12, costSetup: sum("cost_setup"), costMonth: sum("cost_month"),
    marginMonth: month - sum("cost_month"), marginYear: setup + month * 12 - sum("cost_setup") - sum("cost_month") * 12,
    marketSetup: mSetup, marketMonth: mMonth, marketYear: mSetup + mMonth * 12, hasMarket,
    saveYear: hasMarket ? mSetup + mMonth * 12 - (setup + month * 12) : 0,
  };
}
export type LabStage = { id: number; session_id: number; title: string; steps_md: string; result: string; duration: string; product_id: number | null; position: number };
// Чи етап прописаний: є кроки (2+), результат і термін
export function stageGaps(st: LabStage): string[] {
  const steps = st.steps_md.split("\n").filter((l) => /^\s*(\d+[.)]|[-*•]|- \[[ xX]\])\s+\S/.test(l)).length;
  return [steps < 2 && "кроки", !st.result.trim() && "результат", !st.duration.trim() && "термін"].filter(Boolean) as string[];
}
export function labFinance(products: LabProduct[]) {
  const sum = (k: "price_setup" | "price_month" | "cost_setup" | "cost_month") => products.reduce((a, p) => a + (p[k] ?? 0), 0);
  const clientSetup = sum("price_setup"), clientMonth = sum("price_month"), costSetup = sum("cost_setup"), costMonth = sum("cost_month");
  return {
    clientSetup, clientMonth, clientYear: clientSetup + clientMonth * 12,
    costSetup, costMonth, costYear: costSetup + costMonth * 12,
    marginSetup: clientSetup - costSetup, marginMonth: clientMonth - costMonth,
    marginYear: clientSetup - costSetup + (clientMonth - costMonth) * 12,
    missingPrice: products.filter((p) => p.price_setup == null && p.price_month == null).map((p) => p.name),
    missingCost: products.filter((p) => p.cost_setup == null && p.cost_month == null).map((p) => p.name),
  };
}

export type LabFull = LabSession & {
  scenarios: LabScenario[];
  products: LabProduct[];
  packages: LabPackage[];
  stages: LabStage[];
  proposal: Proposal;
  criteria: LabCriterion[];
  options: (LabOption & { scores: Record<number, number>; total: number | null })[];
};

const SELECT = `SELECT s.*, c.name AS client_name FROM lab_sessions s LEFT JOIN clients c ON c.id = s.client_id`;

export function listLab(): LabSession[] {
  return db().prepare(`${SELECT.replace("SELECT s.*", "SELECT s.*, (SELECT COUNT(*) FROM lab_options o WHERE o.session_id = s.id) AS options_count")}
    ORDER BY s.status = 'done', s.id DESC LIMIT 200`).all() as LabSession[];
}

export function listLabForClient(clientId: number): LabSession[] {
  return db().prepare(`${SELECT} WHERE s.client_id = ? ORDER BY s.id DESC`).all(clientId) as LabSession[];
}

// Оцінка варіанта: зважена сума оцінок 1..5 → відсоток від максимуму (тільки по оцінених критеріях)
function total(scores: Record<number, number>, criteria: LabCriterion[]): number | null {
  let got = 0, max = 0;
  for (const c of criteria) {
    const sc = scores[c.id];
    if (!sc) continue;
    got += sc * c.weight;
    max += 5 * c.weight;
  }
  return max ? Math.round((got / max) * 100) : null;
}

export function getLab(id: number): LabFull | undefined {
  const s = db().prepare(`${SELECT} WHERE s.id = ?`).get(id) as LabSession | undefined;
  if (!s) return undefined;
  const criteria = db().prepare("SELECT * FROM lab_criteria WHERE session_id = ? ORDER BY id").all(id) as LabCriterion[];
  const opts = db().prepare("SELECT * FROM lab_options WHERE session_id = ? ORDER BY id").all(id) as LabOption[];
  const rows = db().prepare(`SELECT sc.* FROM lab_scores sc JOIN lab_options o ON o.id = sc.option_id WHERE o.session_id = ?`).all(id) as { option_id: number; criterion_id: number; score: number }[];
  const options = opts.map((o) => {
    const scores = Object.fromEntries(rows.filter((r) => r.option_id === o.id).map((r) => [r.criterion_id, r.score]));
    return { ...o, scores, total: total(scores, criteria) };
  });
  const scenarios = db().prepare("SELECT * FROM lab_scenarios WHERE session_id = ? ORDER BY position, id").all(id) as LabScenario[];
  const products = db().prepare("SELECT * FROM lab_products WHERE session_id = ? ORDER BY position, id").all(id) as LabProduct[];
  const packages = (db().prepare("SELECT * FROM lab_packages WHERE session_id = ? ORDER BY position, id").all(id) as Omit<LabPackage, "product_ids">[]).map((pk) => ({
    ...pk, product_ids: (db().prepare("SELECT product_id FROM lab_package_items WHERE package_id = ?").all(pk.id) as { product_id: number }[]).map((r) => r.product_id),
  }));
  const stages = db().prepare("SELECT * FROM lab_stages WHERE session_id = ? ORDER BY position, id").all(id) as LabStage[];
  return { ...s, criteria, options, scenarios, products, stages, packages, proposal: parseProposal(s.proposal_json) };
}

export function createLab(input: { client_id: number | null; title: string; category: LabCategory; brief?: string }): number {
  const tx = db().transaction(() => {
    const id = Number(db().prepare("INSERT INTO lab_sessions (client_id, title, category, brief) VALUES (?, ?, ?, ?)")
      .run(input.client_id, input.title, input.category, input.brief ?? "").lastInsertRowid);
    const ins = db().prepare("INSERT INTO lab_criteria (session_id, name, weight) VALUES (?, ?, ?)");
    for (const [name, w] of TEMPLATES[input.category]) ins.run(id, name, w);
    return id;
  });
  return tx();
}

export function updateLab(id: number, patch: Partial<Pick<LabSession, "client_id" | "title" | "category" | "brief" | "notes" | "conclusion" | "chosen_option_id">>): void {
  const keys = (["client_id", "title", "category", "brief", "notes", "conclusion", "chosen_option_id"] as const).filter((k) => patch[k] !== undefined);
  if (!keys.length) return;
  db().prepare(`UPDATE lab_sessions SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...patch, id });
}

export function setChosenScenario(id: number, scenarioId: number | null): void {
  db().prepare("UPDATE lab_sessions SET chosen_scenario_id = ? WHERE id = ?").run(scenarioId, id);
}
export function saveProposal(id: number, patch: Proposal): void {
  const cur = parseProposal((db().prepare("SELECT proposal_json FROM lab_sessions WHERE id = ?").get(id) as { proposal_json: string } | undefined)?.proposal_json);
  const next: Proposal = { ...cur };
  for (const [k, v] of Object.entries(patch)) if (typeof v === "string") (next as Record<string, string>)[k] = v.slice(0, 8000);
  db().prepare("UPDATE lab_sessions SET proposal_json = ? WHERE id = ?").run(JSON.stringify(next), id);
}
const SC_FIELDS = ["title", "summary", "steps_md", "timeline", "price_setup", "price_month", "pros", "cons"] as const;
type ScInput = Partial<Pick<LabScenario, (typeof SC_FIELDS)[number]>>;
export function addScenario(sessionId: number, input: ScInput & { title: string }): number {
  const pos = (db().prepare("SELECT COALESCE(MAX(position), 0) p FROM lab_scenarios WHERE session_id = ?").get(sessionId) as { p: number }).p + 1;
  return Number(db().prepare(`INSERT INTO lab_scenarios (session_id, title, summary, steps_md, timeline, price_setup, price_month, pros, cons, position)
    VALUES (@session_id, @title, @summary, @steps_md, @timeline, @price_setup, @price_month, @pros, @cons, @position)`)
    .run({ session_id: sessionId, title: input.title.slice(0, 160), summary: input.summary ?? "", steps_md: input.steps_md ?? "", timeline: input.timeline ?? "", price_setup: input.price_setup ?? null, price_month: input.price_month ?? null, pros: input.pros ?? "", cons: input.cons ?? "", position: pos }).lastInsertRowid);
}
export function updateScenario(id: number, patch: ScInput): void {
  const keys = SC_FIELDS.filter((k) => patch[k] !== undefined);
  if (!keys.length) return;
  db().prepare(`UPDATE lab_scenarios SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...patch, id });
}
export const getScenario = (id: number) => db().prepare("SELECT * FROM lab_scenarios WHERE id = ?").get(id) as LabScenario | undefined;
export function deleteScenario(id: number): void {
  db().prepare("UPDATE lab_sessions SET chosen_scenario_id = NULL WHERE chosen_scenario_id = ?").run(id);
  db().prepare("DELETE FROM lab_scenarios WHERE id = ?").run(id);
}

export function setLabMode(id: number, mode: "choose" | "solution"): void {
  db().prepare("UPDATE lab_sessions SET mode = ? WHERE id = ?").run(mode, id);
}
const PR_F = ["name", "about", "ptype", "price_setup", "price_month", "cost_setup", "cost_month", "notes", "includes", "market_setup", "market_month"] as const;
type PrIn = Partial<Pick<LabProduct, (typeof PR_F)[number]>>;
const nextPos = (table: string, sid: number) => (db().prepare(`SELECT COALESCE(MAX(position), 0) p FROM ${table} WHERE session_id = ?`).get(sid) as { p: number }).p + 1;
export function addProduct(sid: number, i: PrIn & { name: string }): number {
  return Number(db().prepare(`INSERT INTO lab_products (session_id, name, about, ptype, price_setup, price_month, cost_setup, cost_month, notes, includes, market_setup, market_month, position) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(sid, i.name.slice(0, 120), i.about ?? "", i.ptype && i.ptype in PRODUCT_TYPES ? i.ptype : "ours", i.price_setup ?? null, i.price_month ?? null, i.cost_setup ?? null, i.cost_month ?? null, i.notes ?? "", i.includes ?? "", i.market_setup ?? null, i.market_month ?? null, nextPos("lab_products", sid)).lastInsertRowid);
}

// ── Пакети
export function savePackage(sid: number, p: { id?: number | null; name: string; tagline?: string; price_setup?: number | null; price_month?: number | null; highlight?: boolean; product_ids?: number[] }): number {
  const own = new Set((db().prepare("SELECT id FROM lab_products WHERE session_id = ?").all(sid) as { id: number }[]).map((r) => r.id));
  let id = p.id ?? 0;
  if (id) db().prepare("UPDATE lab_packages SET name = ?, tagline = ?, price_setup = ?, price_month = ?, highlight = ? WHERE id = ? AND session_id = ?").run(p.name.slice(0, 80), p.tagline ?? "", p.price_setup ?? null, p.price_month ?? null, p.highlight ? 1 : 0, id, sid);
  else id = Number(db().prepare("INSERT INTO lab_packages (session_id, name, tagline, price_setup, price_month, highlight, position) VALUES (?,?,?,?,?,?,?)").run(sid, p.name.slice(0, 80), p.tagline ?? "", p.price_setup ?? null, p.price_month ?? null, p.highlight ? 1 : 0, nextPos("lab_packages", sid)).lastInsertRowid);
  if (p.highlight) db().prepare("UPDATE lab_packages SET highlight = 0 WHERE session_id = ? AND id != ?").run(sid, id);
  if (p.product_ids) {
    db().prepare("DELETE FROM lab_package_items WHERE package_id = ?").run(id);
    const ins = db().prepare("INSERT OR IGNORE INTO lab_package_items (package_id, product_id) VALUES (?, ?)");
    for (const pid of p.product_ids) if (own.has(pid)) ins.run(id, pid);
  }
  return id;
}
export const getPackage = (id: number) => db().prepare("SELECT * FROM lab_packages WHERE id = ?").get(id) as Omit<LabPackage, "product_ids"> | undefined;
export function deletePackage(id: number): void {
  db().prepare("UPDATE lab_sessions SET chosen_package_id = NULL WHERE chosen_package_id = ?").run(id);
  db().prepare("DELETE FROM lab_packages WHERE id = ?").run(id);
}
export function choosePackage(sid: number, id: number | null): void {
  db().prepare("UPDATE lab_sessions SET chosen_package_id = ? WHERE id = ?").run(id, sid);
}

// ── Мої послуги (шаблони)
export function listTemplates(): ServiceTemplate[] {
  return db().prepare("SELECT * FROM service_templates ORDER BY name").all() as ServiceTemplate[];
}
export const getTemplate = (id: number) => db().prepare("SELECT * FROM service_templates WHERE id = ?").get(id) as ServiceTemplate | undefined;
// Зберегти послугу з лабораторії як шаблон (та сама назва — оновити)
export function productToTemplate(p: LabProduct): number {
  const ex = db().prepare("SELECT id FROM service_templates WHERE name = ?").get(p.name) as { id: number } | undefined;
  const v = [p.about, p.includes, p.ptype, p.price_setup, p.price_month, p.cost_setup, p.cost_month, p.market_setup, p.market_month];
  if (ex) { db().prepare("UPDATE service_templates SET about=?, includes=?, ptype=?, price_setup=?, price_month=?, cost_setup=?, cost_month=?, market_setup=?, market_month=?, updated_at=datetime('now') WHERE id=?").run(...v, ex.id); return ex.id; }
  return Number(db().prepare("INSERT INTO service_templates (name, about, includes, ptype, price_setup, price_month, cost_setup, cost_month, market_setup, market_month) VALUES (?,?,?,?,?,?,?,?,?,?)").run(p.name, ...v).lastInsertRowid);
}
export function templateToProduct(sid: number, tplId: number): number | null {
  const t = getTemplate(tplId);
  if (!t) return null;
  return addProduct(sid, { name: t.name, about: t.about, includes: t.includes, ptype: (t.ptype in PRODUCT_TYPES ? t.ptype : "ours") as LabProduct["ptype"], price_setup: t.price_setup, price_month: t.price_month, cost_setup: t.cost_setup, cost_month: t.cost_month, market_setup: t.market_setup, market_month: t.market_month });
}
export const deleteTemplate = (id: number) => db().prepare("DELETE FROM service_templates WHERE id = ?").run(id);
export function updateProduct(id: number, p: PrIn): void {
  const keys = PR_F.filter((k) => p[k] !== undefined);
  if (keys.length) db().prepare(`UPDATE lab_products SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...p, id });
}
export const getProduct = (id: number) => db().prepare("SELECT * FROM lab_products WHERE id = ?").get(id) as LabProduct | undefined;
export const deleteProduct = (id: number) => { db().prepare("UPDATE lab_stages SET product_id = NULL WHERE product_id = ?").run(id); db().prepare("DELETE FROM lab_products WHERE id = ?").run(id); };
const ST_F = ["title", "steps_md", "result", "duration", "product_id", "position"] as const;
type StIn = Partial<Pick<LabStage, (typeof ST_F)[number]>>;
export function addStage(sid: number, i: StIn & { title: string }): number {
  return Number(db().prepare(`INSERT INTO lab_stages (session_id, title, steps_md, result, duration, product_id, position) VALUES (?,?,?,?,?,?,?)`)
    .run(sid, i.title.slice(0, 160), i.steps_md ?? "", i.result ?? "", i.duration ?? "", i.product_id ?? null, i.position ?? nextPos("lab_stages", sid)).lastInsertRowid);
}
export function updateStage(id: number, p: StIn): void {
  const keys = ST_F.filter((k) => p[k] !== undefined);
  if (keys.length) db().prepare(`UPDATE lab_stages SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...p, id });
}
export const getStage = (id: number) => db().prepare("SELECT * FROM lab_stages WHERE id = ?").get(id) as LabStage | undefined;
export const deleteStage = (id: number) => db().prepare("DELETE FROM lab_stages WHERE id = ?").run(id);

export function setLabStatus(id: number, status: "open" | "done"): void {
  db().prepare(`UPDATE lab_sessions SET status = ?, done_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE NULL END WHERE id = ?`).run(status, status, id);
}

export function deleteLab(id: number): void {
  db().prepare("DELETE FROM lab_sessions WHERE id = ?").run(id);
}

export function addCriterion(sessionId: number, name: string, weight = 2): number {
  return Number(db().prepare("INSERT INTO lab_criteria (session_id, name, weight) VALUES (?, ?, ?)").run(sessionId, name, clampW(weight)).lastInsertRowid);
}
export function setCriterionWeight(id: number, weight: number): void {
  db().prepare("UPDATE lab_criteria SET weight = ? WHERE id = ?").run(clampW(weight), id);
}
export function deleteCriterion(id: number): void {
  db().prepare("DELETE FROM lab_criteria WHERE id = ?").run(id);
}
const clampW = (w: number) => Math.min(3, Math.max(1, Math.round(w) || 2));

export function addOption(sessionId: number, input: Partial<Omit<LabOption, "id" | "session_id">> & { name: string }): number {
  return Number(db().prepare(`INSERT INTO lab_options (session_id, name, tool_id, link, price_month, price_setup, pros, cons, notes, about)
    VALUES (@session_id, @name, @tool_id, @link, @price_month, @price_setup, @pros, @cons, @notes, @about)`).run({
    about: input.about ?? "",
    session_id: sessionId, name: input.name, tool_id: input.tool_id ?? null, link: input.link ?? "",
    price_month: input.price_month ?? null, price_setup: input.price_setup ?? null, pros: input.pros ?? "", cons: input.cons ?? "", notes: input.notes ?? "",
  }).lastInsertRowid);
}

export function updateOption(id: number, patch: Partial<Omit<LabOption, "id" | "session_id">>): void {
  const keys = (["name", "tool_id", "link", "price_month", "price_setup", "pros", "cons", "notes", "about"] as const).filter((k) => patch[k] !== undefined);
  if (!keys.length) return;
  db().prepare(`UPDATE lab_options SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...patch, id });
}

export function getOption(id: number): LabOption | undefined {
  return db().prepare("SELECT * FROM lab_options WHERE id = ?").get(id) as LabOption | undefined;
}

export function deleteOption(id: number): void {
  db().prepare("DELETE FROM lab_options WHERE id = ?").run(id);
}

export function setScore(optionId: number, criterionId: number, score: number | null): void {
  if (!score) db().prepare("DELETE FROM lab_scores WHERE option_id = ? AND criterion_id = ?").run(optionId, criterionId);
  else db().prepare(`INSERT INTO lab_scores (option_id, criterion_id, score) VALUES (?, ?, ?)
    ON CONFLICT(option_id, criterion_id) DO UPDATE SET score = excluded.score`).run(optionId, criterionId, Math.min(5, Math.max(1, Math.round(score))));
}

// Текст для картки клієнта і для помічника
export function labReport(l: LabFull, currency: (n: number) => string): string {
  const ranked = [...l.options].sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
  const chosen = l.options.find((o) => o.id === l.chosen_option_id);
  const lines = [
    `# Лабораторія: ${l.title}`,
    chosen ? `**Обрано:** ${chosen.name}` : "",
    l.conclusion && `## Висновок\n${l.conclusion}`,
    l.brief && `## Що треба клієнту\n${l.brief}`,
    `## Варіанти`,
    ...ranked.map((o) => [
      `### ${o.name}${o.total != null ? ` — ${o.total}%` : ""}`,
      [o.price_month != null && `${currency(o.price_month)}/міс`, o.price_setup != null && `впровадження ${currency(o.price_setup)}`, o.link].filter(Boolean).join(" · "),
      o.pros && `+ ${o.pros}`, o.cons && `− ${o.cons}`, o.notes && `Тест: ${o.notes}`,
      l.criteria.filter((c) => o.scores[c.id]).map((c) => `${c.name}: ${o.scores[c.id]}/5`).join("; "),
    ].filter(Boolean).join("\n")),
    l.notes && `## Штурм\n${l.notes}`,
  ];
  return lines.filter(Boolean).join("\n\n");
}
