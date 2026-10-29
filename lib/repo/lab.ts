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
  other: [["Ціна", 3], ["Простота", 2], ["Результат для бізнесу", 3]],
};

export type LabSession = {
  id: number; client_id: number | null; client_name: string | null; title: string; category: LabCategory; status: "open" | "done";
  brief: string; notes: string; conclusion: string; chosen_option_id: number | null; created_at: string; done_at: string | null;
  options_count?: number;
};
export type LabCriterion = { id: number; session_id: number; name: string; weight: number };
export type LabOption = {
  id: number; session_id: number; name: string; tool_id: number | null; link: string;
  price_month: number | null; price_setup: number | null; pros: string; cons: string; notes: string;
};
export type LabFull = LabSession & {
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
  return { ...s, criteria, options };
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

export function updateLab(id: number, patch: Partial<Pick<LabSession, "client_id" | "title" | "brief" | "notes" | "conclusion" | "chosen_option_id">>): void {
  const keys = (["client_id", "title", "brief", "notes", "conclusion", "chosen_option_id"] as const).filter((k) => patch[k] !== undefined);
  if (!keys.length) return;
  db().prepare(`UPDATE lab_sessions SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`).run({ ...patch, id });
}

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
  return Number(db().prepare(`INSERT INTO lab_options (session_id, name, tool_id, link, price_month, price_setup, pros, cons, notes)
    VALUES (@session_id, @name, @tool_id, @link, @price_month, @price_setup, @pros, @cons, @notes)`).run({
    session_id: sessionId, name: input.name, tool_id: input.tool_id ?? null, link: input.link ?? "",
    price_month: input.price_month ?? null, price_setup: input.price_setup ?? null, pros: input.pros ?? "", cons: input.cons ?? "", notes: input.notes ?? "",
  }).lastInsertRowid);
}

export function updateOption(id: number, patch: Partial<Omit<LabOption, "id" | "session_id">>): void {
  const keys = (["name", "tool_id", "link", "price_month", "price_setup", "pros", "cons", "notes"] as const).filter((k) => patch[k] !== undefined);
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
