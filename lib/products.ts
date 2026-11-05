// Продукти: паспорт для Джері і промптів, промпти для Claude Code, розбір витяжки [CLIENT-OPS:ПРОДУКТ], прийом подій програм.
import Anthropic from "@anthropic-ai/sdk";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { agentConfig } from "./agent/config";
import { autoOn } from "./agent/caps";
import { logError } from "./log";
import {
  addPItem, addProduct, addProductEvent, getOrg, getProduct, listPItems, listProducts, ORG_FIELDS, P_KNOW, PRODUCT_KINDS, PRODUCT_STATUS, productClients, productEvents, productTimeline, productUpdates, nextUpdateVer, hasPassport, updateProduct,
  type Product, type ProductKind, type ProductStatus,
} from "./repo/products";
import { lines } from "./repo/strategy";
import { getSetting } from "./repo/settings";
import { getApiKey, setEnvVar } from "./secrets";

export const PRODUCT_MARK = "[CLIENT-OPS:ПРОДУКТ]";
export const UPDATE_MARK = "[CLIENT-OPS:ОНОВЛЕННЯ]";
export const appSecret = (id: number) => process.env[`APP_SECRET_${id}`]?.trim() || "";
export const newAppSecret = (id: number) => { const s = randomBytes(24).toString("hex"); setEnvVar(`APP_SECRET_${id}`, s); return s; };
export const kitText = (p: Product, host: string) => p.kit_md.replaceAll("{{HOST}}", host);

export const EXTRACT_TEMPLATE = `${PRODUCT_MARK}
Продукт: назва програми
Тип: програма / набір / послуга
Статус: будуємо / працює / покращуємо
Що це: 1–2 речення — що робить і для кого
Як працює: коротко, простими словами
Головні фічі:
- …
З чого складається (стек, модулі, API, база, хостинг):
- …
Посилання (прод, репозиторій, адмінка):
- …
Хронологія роботи (по порядку від початку; кожен етап окремим рядком: [дата, якщо відома] що робили → до чого дійшли):
- [2026-10-01] Етап → результат
Плюси:
- …
Мінуси / ризики:
- …
Що ламалось → як виправили:
- …
Юридичне / доступи / платежі (що треба знати наперед):
- …
Рішення (що вирішили і чому):
- …
Наступні кроки:
- …
Ідеї:
- …
[/CLIENT-OPS]`;

const list = (t: string, xs: string[]) => (xs.length ? `${t}:\n${xs.map((x) => `- ${x}`).join("\n")}` : "");

// Паспорт продукту текстом (для Джері і для промпту в Claude Code)
export function productMd(p: Product, full = true): string {
  const kn = listPItems(p.id, "knowledge", full ? 60 : 15), dec = listPItems(p.id, "decision", 20), log = listPItems(p.id, "log", full ? 10 : 4);
  const plan = listPItems(p.id, "plan").filter((x) => !x.done), ideas = listPItems(p.id, "idea", 15);
  const cl = productClients(p.id);
  return [
    `ПРОДУКТ: ${p.name} (product_id ${p.id}) — ${PRODUCT_KINDS[p.kind] ?? p.kind}, ${PRODUCT_STATUS[p.status] ?? p.status}`,
    p.summary && `Що це: ${p.summary}`,
    p.how && `Як працює: ${p.how}`,
    list("Головні фічі", lines(p.features)),
    list("З чого складається", lines(p.stack)),
    list("Посилання", lines(p.links)),
    list("Плюси", lines(p.pros)),
    list("Мінуси / ризики", lines(p.cons)),
    cl.length ? `Клієнти, які користуються: ${cl.map((c) => `${c.name}${c.note ? ` (${c.note})` : ""}`).join(", ")}` : "",
    kn.length ? `Що знаємо (не наступати вдруге):\n${kn.map((k) => `- [${P_KNOW[k.cat as keyof typeof P_KNOW] ?? "знання"}] ${k.title}${k.body ? ` — ${k.body.replace(/\s+/g, " ").slice(0, 400)}` : ""}`).join("\n")}` : "",
    dec.length ? `Рішення:\n${dec.map((d) => `- ${d.title}${d.body ? ` — ${d.body.replace(/\s+/g, " ").slice(0, 200)}` : ""}`).join("\n")}` : "",
    plan.length ? `Відкриті кроки: ${plan.map((x) => x.title).join("; ")}` : "",
    ideas.length ? `Ідеї: ${ideas.map((x) => x.title).join("; ")}` : "",
    log.length ? `Хронологія (по порядку):\n${productTimeline(p.id).slice(full ? -40 : -6).map((l) => `- ${l.created_at.slice(0, 10)}: ${l.title}${full && l.body ? ` — ${l.body.replace(/\*\*/g, "").replace(/\s+/g, " ").slice(0, 200)}` : ""}`).join("\n")}` : "",
    (() => { const u = productUpdates(p.id); return u.length ? `Оновлення (${u.length}): ${u.slice(-5).map((x) => `${x.title} (${x.created_at.slice(0, 10)})`).join("; ")}${u.at(-1)?.body.match(/Де зупинились:\*\*\s*([^\n]+)/)?.[1] ? `\nДе зупинились: ${u.at(-1)!.body.match(/Де зупинились:\*\*\s*([^\n]+)/)![1]}` : ""}` : ""; })(),
    p.next_step && `Наступний крок: ${p.next_step}`,
  ].filter(Boolean).join("\n\n");
}

const orgShort = () => {
  const o = getOrg();
  return (Object.keys(ORG_FIELDS) as (keyof typeof ORG_FIELDS)[]).filter((k) => o[k]).map((k) => `${ORG_FIELDS[k].label}: ${o[k].replace(/\s+/g, " ").slice(0, 400)}`).join("\n");
};

// Промпт у Claude Code: працюємо над існуючим продуктом (весь паспорт) або описуємо новий
export function productPrompt(productId: number | null): string {
  const p = productId ? getProduct(productId) : undefined;
  const org = orgShort();
  if (!p) return `Я Саша: будую для клієнтів системи (CRM, боти заявок, телефонія, реклама) через AI і веду всі свої продукти в системі Client Ops. Зараз ти в репозиторії програми, яку я хочу внести як продукт.
${org ? `\nПро нас:\n${org}\n` : ""}
Подивись код, README, історію комітів і що ми робили в цьому чаті. Нічого не змінюй. Видай паспорт продукту СТРОГО в такому блоці (тільки факти з коду і нашої роботи, без вигадок, без паролів/токенів — замість них «[ключ у сховищі]»; порожні розділи пропусти). Особливо важливо: що ламалось і як виправили, юридичні моменти, доступи, платежі — щоб наступного разу не наступати на ті самі граблі.

${EXTRACT_TEMPLATE}`;
  return `Я Саша: веду свої продукти в системі Client Ops. Працюємо над продуктом «${p.name}». Нижче — його паспорт з моєї системи. Спирайся на нього: не ламай те, що працює, враховуй, що вже ламалось і які були юридичні/технічні нюанси. Відповідай українською, по суті.
${org ? `\n<org>\n${org}\n</org>\n` : ""}
<product>
${productMd(p)}
</product>

Коли я напишу «витяжка» (або наприкінці роботи) — видай оновлений паспорт СТРОГО в такому блоці (тільки факти, без ключів; списки — ПОВНІ актуальні, не тільки нове; порожні розділи пропусти):

${EXTRACT_TEMPLATE.replace("Продукт: назва програми", `Продукт: ${p.name}`)}`;
}

// Шаблон витяжки-оновлення: тільки нове з моменту, на якому зупинились
export const updateTemplate = (name: string, ver: number, since: string) => `${UPDATE_MARK}
Продукт: ${name}
Оновлення: ${ver}
Період: з ${since || "останньої витяжки"} по сьогодні
Коротко (одне речення — що це оновлення дало):
Що зробили (по порядку; кожен етап окремим рядком: [дата] що робили → до чого дійшли):
- [2026-11-05] …
Що змінилось для користувача (нові фічі, зміни):
- …
Що змінилось у складі (стек, модулі, API, база):
- …
Що ламалось → як виправили:
- …
Юридичне / доступи / платежі:
- …
Рішення (що вирішили і чому):
- …
Де зупинились (стан прямо зараз):
- …
Наступні кроки:
- …
[/CLIENT-OPS]`;

// Промпт «Оновлення N»: Claude Code бачить, на чому ми зупинились, і віддає тільки нове
export function updatePrompt(productId: number): string {
  const p = getProduct(productId);
  if (!p) return "";
  const ver = nextUpdateVer(productId);
  const ups = productUpdates(productId);
  const last = ups.at(-1);
  const tl = productTimeline(productId).slice(-5);
  const since = (last?.created_at ?? tl.at(-1)?.created_at ?? "").slice(0, 10);
  const open = listPItems(productId, "plan").filter((x) => !x.done).map((x) => x.title);
  return `Продукт «${p.name}» уже записаний у моїй системі Client Ops. Мені потрібне ОНОВЛЕННЯ ${ver} — тільки те, що зроблено ПІСЛЯ того, на чому ми зупинились. Не повторюй старе.

На чому зупинились у моїй системі:
${last ? `- Останнє оновлення: «${last.title}» (${since})${last.body ? `
${last.body.replace(/\*\*/g, "").split("\n").filter(Boolean).slice(0, 6).map((x) => `  ${x}`).join("\n")}` : ""}` : `- Стартовий паспорт від ${since || "—"}`}
${tl.length ? `- Останні етапи хронології: ${tl.map((x) => `${x.created_at.slice(0, 10)} ${x.title}`).join("; ")}` : ""}
${open.length ? `- Відкриті кроки: ${open.join("; ")}` : ""}
${p.next_step ? `- Наступний крок був: ${p.next_step}` : ""}

Подивись, що ми робили в цьому чаті і в коді (коміти) після ${since || "останнього запису"}, і видай оновлення СТРОГО в такому блоці (тільки факти, без ключів і паролів; порожні розділи пропусти):

${updateTemplate(p.name, ver, since)}`;
}

type Ops = {
  product?: { name?: string; kind?: string; status?: string; summary?: string; how?: string; features?: string; stack?: string; links?: string; pros?: string; cons?: string; next_step?: string } | null;
  log?: { title: string; body?: string } | null;
  timeline?: { at?: string; title: string; result?: string; body?: string }[];
  knowledge?: { cat?: string; title: string; body?: string }[];
  decisions?: { title: string; body?: string }[];
  plan?: string[];
  ideas?: string[];
  update?: { title?: string; summary?: string; stopped?: string; changes?: string } | null;
};

// Витяжка → паспорт продукту (productId null — новий або знайдений за назвою)
export async function importProduct(text: string, productId: number | null): Promise<{ ok: true; id: number; summary: string[] } | { ok: false; error: string }> {
  const key = getApiKey();
  if (!key) return { ok: false, error: "Нема ключа Anthropic (Налаштування → Доступи)" };
  if (text.trim().length < 20) return { ok: false, error: "Порожня витяжка" };
  const cur = productId ? getProduct(productId) : undefined;
  const all = listProducts().map((p) => ({ id: p.id, name: p.name }));
  const isUpdate = text.includes(UPDATE_MARK);
  const state = cur ? { id: cur.id, name: cur.name, kind: cur.kind, status: cur.status, summary: cur.summary, how: cur.how, features: lines(cur.features), stack: lines(cur.stack), links: lines(cur.links), pros: lines(cur.pros), cons: lines(cur.cons), next_step: cur.next_step } : null;
  const system = `Ти розкладаєш витяжку з Claude Code у паспорт продукту системи Client Ops. Дають поточний паспорт (або null — новий продукт), список наявних продуктів і витяжку.
Поверни ТІЛЬКИ JSON:
{"product": {"name": "...", "kind": "app|kit|service", "status": "idea|building|live|improving|paused", "summary": "...", "how": "...", "features": "ПОВНИЙ перелік по рядку", "stack": "ПОВНИЙ перелік по рядку", "links": "по рядку «Назва — url»", "pros": "по рядку", "cons": "по рядку", "next_step": "..."},
 "timeline": [{"at": "YYYY-MM-DD або порожньо", "title": "етап — коротко", "result": "до чого дійшли", "body": "деталі пунктами"}] — ВСІ етапи з хронології витяжки по порядку, крім тих, що вже є в existing_timeline (порівнюй за змістом),
 "log": {"title": "що зроблено цього разу — одним рядком", "body": "коротко пунктами"} або null (якщо це вже покрито timeline — null),
 "knowledge": [{"cat": "fix|integration|legal|lesson", "title": "...", "body": "причина → рішення / що знати наперед"}],
 "decisions": [{"title": "...", "body": "чому"}],
 "plan": ["наступний крок", ...], "ideas": ["...", ...]}
${isUpdate ? `Це ОНОВЛЕННЯ (не повний паспорт): додай у JSON ще "update": {"title": "коротко про оновлення (з поля «Коротко»)", "summary": "що змінилось — пунктами", "stopped": "де зупинились", "changes": "що змінилось для користувача і в складі — пунктами"}; поля product повертай з урахуванням змін (нові фічі/склад додай до наявних), next_step = перший з «Наступних кроків»; timeline — етапи з «Що зробили».\n` : ""}Правила: тільки факти з витяжки; поля, яких у витяжці нема, повертай як є в паспорті (не стирай); списки зливай зі старими без дублів; юридичні моменти, доступи, платежі, верифікації → knowledge cat legal; ніяких ключів і паролів.`;
  try {
    const r = await new Anthropic({ apiKey: key, timeout: 120000, maxRetries: 1 }).messages.create({
      model: agentConfig().model, max_tokens: 8000, system, output_config: { effort: "low" },
      messages: [{ role: "user", content: `ПАСПОРТ:\n${JSON.stringify(state)}\n\nEXISTING_TIMELINE:\n${JSON.stringify(cur ? productTimeline(cur.id).map((x) => ({ at: x.created_at.slice(0, 10), title: x.title })) : [])}\n\nНАЯВНІ ПРОДУКТИ:\n${JSON.stringify(all)}\n\nВИТЯЖКА:\n${text.slice(0, 30000)}` }],
    });
    const out = r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const a = out.indexOf("{"), z = out.lastIndexOf("}");
    if (a < 0 || z <= a) return { ok: false, error: "Не вдалось розібрати — спробуй ще раз" };
    return { ok: true, ...applyProductOps(JSON.parse(out.slice(a, z + 1)) as Ops, productId, isUpdate) };
  } catch (e) {
    logError("product-import", e);
    return { ok: false, error: (e as { status?: number }).status === 401 ? "Ключ Anthropic не підходить" : "Не вдалось розібрати — спробуй ще раз" };
  }
}

export function applyProductOps(ops: Ops, productId: number | null, isUpdate = false): { id: number; summary: string[] } {
  const sum: string[] = [];
  const P = ops.product ?? {};
  const patch = {
    name: P.name?.trim() || undefined,
    kind: (P.kind && P.kind in PRODUCT_KINDS ? P.kind : undefined) as ProductKind | undefined,
    status: (P.status && P.status in PRODUCT_STATUS ? P.status : undefined) as ProductStatus | undefined,
    summary: P.summary || undefined, how: P.how || undefined, features: P.features || undefined, stack: P.stack || undefined,
    links: P.links || undefined, pros: P.pros || undefined, cons: P.cons || undefined, next_step: P.next_step || undefined,
  };
  let id = productId && getProduct(productId) ? productId : 0;
  if (!id && patch.name) id = listProducts().find((p) => p.name.toLowerCase() === patch.name!.toLowerCase())?.id ?? 0;
  if (id) { updateProduct(id, patch); sum.push("Паспорт оновлено"); }
  else { id = addProduct({ ...patch, name: patch.name || "Новий продукт" }); sum.push(`Новий продукт «${patch.name || "Новий продукт"}»`); }
  // Номер: перша витяжка = старт (0), далі — Оновлення 1, 2, …; оновлення без паспорта теж іде номером
  const ver = isUpdate || hasPassport(id) ? nextUpdateVer(id) : 0;
  if (ver) {
    const u = ops.update ?? {};
    addPItem(id, { kind: "update", ver, title: `Оновлення ${ver}${u.title ? ` — ${u.title}` : ""}`, source: "extract",
      body: [u.summary && `**Що зробили:**\n${u.summary}`, u.changes && `**Що змінилось:**\n${u.changes}`, u.stopped && `**Де зупинились:** ${u.stopped}`].filter(Boolean).join("\n\n") });
    sum.push(`Оновлення ${ver}`);
  }
  const have = new Set(productTimeline(id).map((x) => x.title.trim().toLowerCase()));
  let nt = 0;
  for (const t of ops.timeline ?? []) {
    if (!t?.title?.trim() || have.has(t.title.trim().toLowerCase())) continue;
    addPItem(id, { ver, kind: "log", title: t.title.trim(), body: [t.result && `**До чого дійшли:** ${t.result}`, t.body].filter(Boolean).join("\n\n"), source: "extract", at: t.at });
    have.add(t.title.trim().toLowerCase()); nt++;
  }
  if (ops.log?.title && !have.has(ops.log.title.trim().toLowerCase())) { addPItem(id, { ver, kind: "log", title: ops.log.title, body: ops.log.body, source: "extract" }); nt++; }
  if (nt) sum.push(`Хронологія +${nt}`);
  for (const k of ops.knowledge ?? []) if (k.title) addPItem(id, { ver, kind: "knowledge", cat: k.cat && k.cat in P_KNOW ? k.cat : "lesson", title: k.title, body: k.body, source: "extract" });
  if (ops.knowledge?.length) sum.push(`Знання +${ops.knowledge.length}`);
  for (const d of ops.decisions ?? []) if (d.title) addPItem(id, { ver, kind: "decision", title: d.title, body: d.body, source: "extract" });
  if (ops.decisions?.length) sum.push(`Рішення +${ops.decisions.length}`);
  const open = new Set(listPItems(id, "plan").filter((x) => !x.done).map((x) => x.title.toLowerCase()));
  let np = 0;
  for (const t of ops.plan ?? []) if (t?.trim() && !open.has(t.trim().toLowerCase())) { addPItem(id, { ver, kind: "plan", title: t.trim(), source: "extract" }); np++; }
  if (np) sum.push(`Кроки +${np}`);
  for (const t of ops.ideas ?? []) if (t?.trim()) addPItem(id, { ver, kind: "idea", title: t.trim(), source: "extract" });
  if (ops.ideas?.length) sum.push(`Ідеї +${ops.ideas.length}`);
  return { id, summary: sum };
}

// Події від програм (Client Ops Connect): підпис, дедуп, запис; помилка/відгук → Саші в Telegram
const s = (v: unknown) => (v == null ? "" : String(v));
export async function appWebhook(productId: number, raw: string, h: Headers): Promise<{ status: number; body: Record<string, unknown> }> {
  const secret = appSecret(productId), p = getProduct(productId);
  if (!secret || !p) return { status: 404, body: { ok: false } };
  const ts = h.get("x-timestamp") ?? "", sig = h.get("x-signature") ?? "";
  const exp = "sha256=" + createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
  if (sig.length !== exp.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return { status: 401, body: { ok: false, error: "bad signature" } };
  if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 48 * 3600) return { status: 401, body: { ok: false, error: "stale" } };
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw) as Record<string, unknown>; } catch { return { status: 400, body: { ok: false, error: "bad json" } }; }
  const event = s(b.event).slice(0, 60), eventId = s(b.event_id) || s(h.get("x-event-id"));
  if (!eventId || !event) return { status: 422, body: { ok: false, error: "event_id і event обовʼязкові" } };
  const data = (b.data ?? {}) as Record<string, unknown>;
  const summary = (s(b.summary) || s(data.message) || s(data.text) || s(data.notes) || event).replace(/\s+/g, " ").slice(0, 300) + (b.client ? ` · ${s(b.client).slice(0, 60)}` : "");
  const at = !Number.isNaN(Date.parse(s(b.occurred_at))) ? new Date(s(b.occurred_at)).toISOString() : new Date().toISOString();
  if (!addProductEvent({ event_id: eventId, product_id: productId, event, summary, data_json: JSON.stringify(data).slice(0, 8000), occurred_at: at })) return { status: 200, body: { ok: true, duplicate: true } };
  if (event === "app.release") addPItem(productId, { kind: "log", title: `Реліз ${s(data.version)}`.trim(), body: s(data.notes).slice(0, 2000), source: "extract" });
  // Самоаудит програми: знахідки (незручності, повільні місця, часті помилки) → ідеї продукту, без дублів
  if (event === "app.insight" && Array.isArray(data.items)) {
    const have = new Set(listPItems(productId, "idea").map((x) => x.title.toLowerCase()));
    for (const it of (data.items as Record<string, unknown>[]).slice(0, 20)) {
      const t = s(it.title).trim().slice(0, 200);
      if (!t || have.has(t.toLowerCase())) continue;
      addPItem(productId, { kind: "idea", title: t, source: "app", body: [it.severity && `**Важливість:** ${s(it.severity)}`, it.area && `**Де:** ${s(it.area)}`, it.why && `**Чому:** ${s(it.why)}`, it.fix && `**Як виправити:** ${s(it.fix)}`].filter(Boolean).join("\n\n") });
      have.add(t.toLowerCase());
    }
  }
  if ((event === "app.error" || event === "app.feedback") && autoOn("product_alerts")) void (async () => {
    const { tg, tgOwner } = await import("./telegram");
    const owner = tgOwner();
    if (owner) await tg("sendMessage", { chat_id: owner, text: `${event === "app.error" ? "⚠️ Помилка" : "💬 Відгук"} · ${p.name}\n${summary}` });
  })().catch((e) => logError("product-alert", e));
  return { status: 200, body: { ok: true } };
}

// Промпт «виправити»: свіжі помилки, відгуки і знахідки самоаудиту → одне завдання для Claude Code + витяжка-оновлення
export function fixPrompt(productId: number): string {
  const p = getProduct(productId);
  if (!p) return "";
  const { since, errors, feedback } = productIssues(productId);
  const ideas = listPItems(productId, "idea").filter((x) => x.source === "app" && !x.done).slice(0, 25);
  const ver = nextUpdateVer(productId);
  const lst = (xs: { summary: string; n: number; last: string }[]) => xs.map((x) => `- ${x.summary}${x.n > 1 ? ` (×${x.n})` : ""} — останній раз ${x.last.slice(0, 16)}`).join("\n");
  return `Продукт «${p.name}». Нижче — що програма сама повідомила в мою систему Client Ops${since ? ` після ${since.slice(0, 10)}` : ""}: помилки, відгуки користувачів і знахідки самоаудиту. Розбери і виправ по важливості. Не ламай те, що працює; на кожну помилку — знайди причину, а не гаси симптом.
${errors.length ? `\nПомилки:\n${lst(errors)}\n` : ""}${feedback.length ? `\nВідгуки користувачів:\n${lst(feedback)}\n` : ""}${ideas.length ? `\nЗнахідки самоаудиту (незручності, повільні місця):\n${ideas.map((x) => `- ${x.title}${x.body ? ` — ${x.body.replace(/\*\*/g, "").replace(/\s+/g, " ").slice(0, 200)}` : ""}`).join("\n")}\n` : ""}
<product>
${productMd(p, false)}
</product>

Порядок: 1) що ламає роботу менеджерів або гроші; 2) часті помилки; 3) незручності. Що не варто робити — скажи чому. Після роботи видай оновлення СТРОГО в такому блоці (тільки факти, без ключів):

${updateTemplate(p.name, ver, since.slice(0, 10))}`;
}

// Що програма повідомила після останнього «Розібрано»: однакові згруповані з лічильником
export function productIssues(productId: number): { since: string; errors: { summary: string; n: number; last: string }[]; feedback: { summary: string; n: number; last: string }[] } {
  const since = getSetting(`app.fixed_at.${productId}`) ?? "";
  const ev = productEvents(productId, 500).filter((e) => (e.event === "app.error" || e.event === "app.feedback") && (!since || e.received_at > since));
  const group = (kind: string) => {
    const m = new Map<string, { summary: string; n: number; last: string }>();
    for (const e of ev.filter((x) => x.event === kind)) {
      const k = e.summary.replace(/\d+/g, "#").toLowerCase();
      const g = m.get(k);
      if (g) g.n++; else m.set(k, { summary: e.summary, n: 1, last: e.received_at });
    }
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 30);
  };
  return { since, errors: group("app.error"), feedback: group("app.feedback") };
}

// Коротко про організацію і продукти — у системний промпт Джері
export function orgBlock(): string {
  const org = orgShort();
  const ps = listProducts();
  if (!org && !ps.length) return "";
  return [org && `Організація Саші (вкладка «Розвиток»):\n${org}`, ps.length ? `Наші продукти (вкладка «Продукти», деталі — product_get):\n${ps.map((p) => `- [product_id ${p.id}] ${p.name} — ${PRODUCT_KINDS[p.kind] ?? p.kind}, ${PRODUCT_STATUS[p.status] ?? p.status}${p.summary ? `: ${p.summary.replace(/\s+/g, " ").slice(0, 140)}` : ""}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
}
