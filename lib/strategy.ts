// Стратегія клієнта: контекст для Джері і для Claude Code (промпт частини), імпорт витяжки [CLIENT-OPS:СТРАТЕГІЯ].
// Витяжку розбирає модель у JSON-операції (яка частина, що оновити, план, знання, рішення, висновки) — і система застосовує.
import Anthropic from "@anthropic-ai/sdk";
import { agentConfig } from "./agent/config";
import { logError } from "./log";
import { getClientRow } from "./repo/clients";
import { getClientMemory } from "./repo/clientMemory";
import { getApiKey } from "./secrets";
import {
  addItem, addPart, getPart, getStrategy, HORIZONS, KNOW_CATS, lines, listItems, listParts, PART_KINDS, PART_STATUS, saveStrategy, updateItem, updatePart,
  type Part, type PartKind, type PartStatus,
} from "./repo/strategy";

export const STRATEGY_MARK = "[CLIENT-OPS:СТРАТЕГІЯ]";

const partLine = (p: Part) => `- [part_id ${p.id}] ${p.title} — ${PART_KINDS[p.kind]}, ${PART_STATUS[p.status]}${p.summary ? `: ${p.summary.replace(/\n+/g, " ").slice(0, 160)}` : ""}`;

// Коротко для Джері (в знімок клієнта) і повно для промпту
export function strategySnapshot(clientId: number, full = false): string {
  const s = getStrategy(clientId);
  const parts = listParts(clientId);
  const plan = listItems(clientId, { kind: "plan" }).filter((i) => i.horizon !== "done");
  if (!s.where_now && !s.goal && !parts.length && !plan.length) return "";
  const out: string[] = [];
  if (s.where_now || s.goal || s.focus) out.push([s.where_now && `Де ми зараз: ${s.where_now}`, s.goal && `Куди йдемо: ${s.goal}`, s.focus && `Головне зараз: ${s.focus}`].filter(Boolean).join("\n"));
  if (parts.length) out.push(`Екосистема клієнта:\n${parts.map(partLine).join("\n")}`);
  const byH = (h: string) => plan.filter((i) => i.horizon === h);
  for (const h of ["week", "month", "later"] as const) if (byH(h).length) out.push(`${HORIZONS[h]}:\n${byH(h).slice(0, full ? 30 : 8).map((i) => `- [item_id ${i.id}] ${i.title}${i.part_id ? ` (${parts.find((p) => p.id === i.part_id)?.title ?? ""})` : ""}`).join("\n")}`);
  if (s.insights) out.push(`Висновки (що працює в цього клієнта):\n${full ? s.insights : s.insights.slice(0, 1200)}`);
  return out.join("\n\n");
}

export function partDetail(p: Part): string {
  const it = (kind: "knowledge" | "decision" | "log", n: number) => listItems(p.client_id, { kind, part: p.id, limit: n });
  const kn = it("knowledge", 30), dec = it("decision", 15), log = it("log", 6);
  const open = listItems(p.client_id, { kind: "plan", part: p.id }).filter((i) => i.horizon !== "done");
  return [
    `ЧАСТИНА: ${p.title} (part_id ${p.id}) — ${PART_KINDS[p.kind]}, статус: ${PART_STATUS[p.status]}`,
    p.summary && `Що це: ${p.summary}`,
    p.stack && `З чого складається:\n${lines(p.stack).map((x) => `- ${x}`).join("\n")}`,
    p.pros && `Плюси:\n${lines(p.pros).map((x) => `- ${x}`).join("\n")}`,
    p.cons && `Мінуси / ризики:\n${lines(p.cons).map((x) => `- ${x}`).join("\n")}`,
    kn.length && `Що вже знаємо (ламалось → як виправили, інтеграції, уроки):\n${kn.map((k) => `- ${k.title}${k.body ? ` — ${k.body.replace(/\n+/g, " ").slice(0, 300)}` : ""}`).join("\n")}`,
    dec.length && `Рішення:\n${dec.map((d) => `- ${d.title}${d.body ? ` — ${d.body.replace(/\n+/g, " ").slice(0, 200)}` : ""}`).join("\n")}`,
    open.length && `Відкриті кроки: ${open.map((o) => `${o.title} [${HORIZONS[o.horizon as keyof typeof HORIZONS] ?? o.horizon}]`).join("; ")}`,
    log.length && `Останнє в хроніці:\n${log.map((l) => `- ${l.created_at.slice(0, 10)}: ${l.title}`).join("\n")}`,
    p.next_step && `Наступний крок: ${p.next_step}`,
  ].filter(Boolean).join("\n\n");
}

export function extractBlock(partTitle = "", client = ""): string {
  return `${STRATEGY_MARK}${client ? `\nКлієнт: ${client}` : ""}
Частина: ${partTitle || "назва частини екосистеми (CRM, бот заявок, реклама…)"}
Статус: план / будуємо / працює / покращуємо
Що це: 1–2 речення — що це і що дає клієнту
Що зроблено:
- …
З чого складається (модулі, інструменти, API, база, хостинг — повний актуальний перелік):
- …
Плюси:
- …
Мінуси / ризики:
- …
Що ламалось → як виправили:
- проблема → причина → рішення
Рішення (що вирішили і чому):
- …
Наступні кроки:
- [тиждень] …
- [місяць] …
- [далі] …
Ідеї / масштабування:
- …
Висновок (що зрозуміли: що повторювати, чого уникати):
- …
[/CLIENT-OPS]`;
}

// Промпт для Claude Code / іншого чату: увесь контекст стратегії + обраної частини + як видати витяжку
export function partPrompt(clientId: number, partId: number | null): string {
  const c = getClientRow(clientId);
  const p = partId ? getPart(partId) : undefined;
  const mem = getClientMemory(clientId)?.text;
  return `Ти — мій технічний партнер. Я Саша: будую для клієнтів системи (CRM, боти заявок, телефонія, реклама) через AI. Працюємо над клієнтом «${c?.name ?? ""}»${p ? `, частина «${p.title}»` : ""}. Нижче — ВСЕ, що вже є в моїй системі Client Ops. Спирайся на це: не починай з нуля, не ламай те, що вже працює, враховуй, що ламалось раніше. Відповідай українською, по суті.

<strategy client="${(c?.name ?? "").replace(/"/g, "")}">
${strategySnapshot(clientId, true) || "Стратегія ще порожня."}
${mem ? `\nПамʼять по клієнту:\n${mem}` : ""}
</strategy>
${p ? `\n<part>\n${partDetail(p)}\n</part>\n` : ""}
Коли я напишу «витяжка» (або наприкінці роботи) — видай підсумок СТРОГО в такому блоці (тільки факти з нашої роботи, без вигадок, без паролів/токенів — замість них «[ключ у .env]», порожні розділи пропусти):

${extractBlock(p?.title, c ? `${c.name} (client_id ${c.id})` : "")}`;
}

type Ops = {
  part?: { id?: number | null; title?: string; kind?: string; status?: string; summary?: string; stack?: string; pros?: string; cons?: string; next_step?: string } | null;
  log?: { title: string; body?: string } | null;
  knowledge?: { cat?: string; title: string; body?: string }[];
  decisions?: { title: string; body?: string }[];
  plan_add?: { title: string; horizon?: string }[];
  plan_done?: number[];
  ideas?: string[];
  insights?: string | null;
  where_now?: string | null;
  focus?: string | null;
};

// Розібрати витяжку (або довільний підсумок) і розкласти по стратегії
export async function importExtract(clientId: number, text: string): Promise<{ ok: true; summary: string[]; partId: number | null } | { ok: false; error: string }> {
  const key = getApiKey();
  if (!key) return { ok: false, error: "Нема ключа Anthropic (Налаштування → Доступи)" };
  if (text.trim().length < 20) return { ok: false, error: "Порожня витяжка" };
  const s = getStrategy(clientId);
  const parts = listParts(clientId);
  const open = listItems(clientId, { kind: "plan" }).filter((i) => i.horizon !== "done");
  const state = {
    parts: parts.map((p) => ({ id: p.id, title: p.title, kind: p.kind, status: p.status, summary: p.summary, stack: lines(p.stack), pros: lines(p.pros), cons: lines(p.cons) })),
    open_plan: open.map((i) => ({ id: i.id, title: i.title, horizon: i.horizon, part_id: i.part_id })),
    insights: s.insights, where_now: s.where_now, focus: s.focus,
  };
  const system = `Ти розкладаєш витяжку з робочого чату Саші по його системі «Стратегія клієнта». Тобі дають поточний стан (частини екосистеми з id, відкриті кроки плану з id, висновки) і текст витяжки.
Поверни ТІЛЬКИ JSON:
{"part": {"id": id існуючої частини або null для нової, "title": "...", "kind": "build|service|tool", "status": "plan|building|live|improving|paused", "summary": "...", "stack": "ПОВНИЙ актуальний перелік складу, по рядку (злий старе + нове, без дублів)", "pros": "по рядку, повний", "cons": "по рядку, повний", "next_step": "..."} або null,
 "log": {"title": "що зроблено — одним рядком", "body": "коротко пунктами"},
 "knowledge": [{"cat": "fix|integration|lesson", "title": "...", "body": "причина → рішення / як влаштовано"}],
 "decisions": [{"title": "...", "body": "чому"}],
 "plan_add": [{"title": "...", "horizon": "week|month|later"}],
 "plan_done": [id відкритих кроків, які за витяжкою вже зроблені],
 "ideas": ["..."],
 "insights": "ПОВНИЙ переписаний текст висновків (пунктами «- », макс ~2500 символів: старі + нові уроки, без дублів) або null якщо нового нема",
 "where_now": "оновлене «де ми зараз» 1–2 речення або null", "focus": "оновлене «головне зараз» або null"}
Правила: тільки факти з витяжки; поля частини, яких у витяжці нема, повертай як є зараз (не стирай); не дублюй кроки, що вже є в open_plan; якщо частина в витяжці збігається з існуючою за змістом — використай її id.`;
  try {
    const r = await new Anthropic({ apiKey: key, timeout: 120000, maxRetries: 1 }).messages.create({
      model: agentConfig().model, max_tokens: 8000, system, output_config: { effort: "low" },
      messages: [{ role: "user", content: `СТАН:\n${JSON.stringify(state)}\n\nВИТЯЖКА:\n${text.slice(0, 30000)}` }],
    });
    const out = r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const ops = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as Ops;
    return { ok: true, ...applyOps(clientId, ops) };
  } catch (e) {
    logError("strategy-import", e);
    const st = (e as { status?: number }).status;
    return { ok: false, error: st === 401 ? "Ключ Anthropic не підходить" : "Не вдалось розібрати — спробуй ще раз" };
  }
}

export function applyOps(clientId: number, ops: Ops): { summary: string[]; partId: number | null } {
  const sum: string[] = [];
  let partId: number | null = null;
  const P = ops.part;
  if (P && (P.id || P.title)) {
    const ex = P.id ? getPart(P.id) : undefined;
    const patch = {
      kind: (P.kind && P.kind in PART_KINDS ? P.kind : undefined) as PartKind | undefined,
      status: (P.status && P.status in PART_STATUS ? P.status : undefined) as PartStatus | undefined,
      summary: P.summary || undefined, stack: P.stack || undefined, pros: P.pros || undefined, cons: P.cons || undefined, next_step: P.next_step || undefined,
    };
    if (ex && ex.client_id === clientId) { updatePart(ex.id, patch); partId = ex.id; sum.push(`Частина «${ex.title}» оновлена`); }
    else if (P.title) { partId = addPart(clientId, { title: P.title, ...patch }); sum.push(`Нова частина «${P.title}»`); }
  }
  if (ops.log?.title) { addItem(clientId, { kind: "log", title: ops.log.title, body: ops.log.body, part_id: partId, source: "extract" }); sum.push("Хроніка +1"); }
  for (const k of ops.knowledge ?? []) if (k.title) addItem(clientId, { kind: "knowledge", cat: k.cat && k.cat in KNOW_CATS ? k.cat : "lesson", title: k.title, body: k.body, part_id: partId, source: "extract" });
  if (ops.knowledge?.length) sum.push(`Знання +${ops.knowledge.length}`);
  for (const d of ops.decisions ?? []) if (d.title) addItem(clientId, { kind: "decision", title: d.title, body: d.body, part_id: partId, source: "extract" });
  if (ops.decisions?.length) sum.push(`Рішення +${ops.decisions.length}`);
  for (const x of ops.plan_add ?? []) if (x.title) addItem(clientId, { kind: "plan", title: x.title, horizon: x.horizon, part_id: partId, source: "extract" });
  if (ops.plan_add?.length) sum.push(`План +${ops.plan_add.length}`);
  let done = 0;
  for (const id of ops.plan_done ?? []) { const it = listItems(clientId, { kind: "plan" }).find((i) => i.id === Number(id)); if (it) { updateItem(it.id, { horizon: "done" }); done++; } }
  if (done) sum.push(`Зроблено кроків: ${done}`);
  for (const i of ops.ideas ?? []) if (i?.trim()) addItem(clientId, { kind: "idea", title: i.trim(), part_id: partId, source: "extract" });
  if (ops.ideas?.length) sum.push(`Ідеї +${ops.ideas.length}`);
  const sp: Parameters<typeof saveStrategy>[1] = {};
  if (ops.insights?.trim()) { sp.insights = ops.insights.trim(); sum.push("Висновки оновлені"); }
  if (ops.where_now?.trim()) sp.where_now = ops.where_now.trim();
  if (ops.focus?.trim()) sp.focus = ops.focus.trim();
  if (Object.keys(sp).length) saveStrategy(clientId, sp);
  return { summary: sum, partId };
}
