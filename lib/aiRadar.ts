// AI-радар для всього бізнесу: раз на 3 дні Джері дивиться, що нового в 6 напрямках (RADAR_AREAS).
// Джерела: GitHub (репо, що найшвидше ростуть, + коміти ключових), Hacker News (топ, без ШІ), web_search по блогах/розсилках.
// Картка: що це → що дає нам і клієнтам → оцінка 1–5 → «в ідеї / в план / в стиль креативів». Раз на місяць — «Карта ринку».
import Anthropic from "@anthropic-ai/sdk";
import { agentConfig } from "./agent/config";
import { autoOn } from "./agent/caps";
import { githubToken, listCommits, trendingRepos } from "./github";
import { logError } from "./log";
import { isArea, RADAR_AREAS, RADAR_SOURCES_DEFAULT, type RadarArea } from "./radarConfig";
import { addRadar, listRadar, listStyles } from "./repo/creativeCenter";
import { getSetting, setSetting } from "./repo/settings";
import { getApiKey } from "./secrets";

export const RADAR_REPOS_DEFAULT = "anthropics/skills\nanthropics/claude-code\nanthropics/claude-cookbooks\nopenai/openai-cookbook\nmodelcontextprotocol/servers\nn8n-io/n8n";
export const radarRepos = () => (getSetting("radar.repos") ?? RADAR_REPOS_DEFAULT).split("\n").map((x) => x.trim()).filter((x) => /^[\w.-]+\/[\w.-]+$/.test(x));
export const radarSources = () => getSetting("radar.sources") || RADAR_SOURCES_DEFAULT;
export const creativeTools = () => getSetting("creative.tools") ?? "";
const EVERY_DAYS = 3;
// Ідентифікатор процесу: якщо сервер перезапустився посеред прогону — позначка «шукає» більше не дійсна
// (globalThis — бо модуль може бути завантажений кількома бандлами Next в одному процесі)
const g = globalThis as unknown as { __radarBoot?: string };
const BOOT = (g.__radarBoot ??= Math.random().toString(36).slice(2, 10));
const hhmm = () => new Date().toLocaleTimeString("uk-UA", { timeZone: "Europe/Kyiv", hour: "2-digit", minute: "2-digit" });
const progress = (t: string) => setSetting("radar.progress", `${hhmm()} ${t}`);

type Found = { title?: string; source?: string; url?: string; what?: string; how?: string; score?: number; style_id?: number | null; kind?: string; style_title?: string; add?: string; area?: string };

function parseJson<T>(out: string): T {
  const a = out.indexOf("{"), z = out.lastIndexOf("}");
  if (a < 0 || z <= a) throw new Error("Модель не повернула JSON");
  return JSON.parse(out.slice(a, z + 1).replace(/,\s*([\]}])/g, "$1")) as T;
}

// Запит з web_search/web_fetch на боці Anthropic; pause_turn — продовжуємо до 4 кругів
async function askWithWeb(system: string, user: string, maxTokens = 7000): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error("Нема ключа Anthropic (Налаштування → Доступи)");
  const model = agentConfig().model;
  const { webToolsFor, webBetaFor } = await import("./agent/run");
  const client = new Anthropic({ apiKey: key, timeout: 240_000, maxRetries: 0 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: user }];
  let out = "";
  for (let i = 0; i < 3; i++) {
    const betas = webBetaFor(model);
    const r = await client.beta.messages.create({ model, max_tokens: maxTokens, system, messages, tools: webToolsFor(model), ...(betas.length ? { betas } : {}) });
    out = r.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
    if (r.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: r.content as Anthropic.Beta.BetaContentBlockParam[] });
  }
  return out;
}

// Сировина без ШІ: що росте на GitHub, що обговорюють на Hacker News, коміти ключових репо
async function rawSignals(since: string) {
  const out: { github_trending?: unknown; github_commits?: Record<string, string[]>; hacker_news?: unknown } = {};
  if (githubToken()) {
    try { out.github_trending = await trendingRepos(since); } catch (e) { out.github_trending = `не вдалось: ${String((e as Error).message).slice(0, 80)}`; }
    const commits: Record<string, string[]> = {};
    for (const repo of radarRepos()) {
      try { commits[repo] = (await listCommits(repo)).filter((c) => c.date >= since).map((c) => `${c.date}: ${c.message}`).slice(0, 12); }
      catch (e) { commits[repo] = [`(не вдалось: ${String((e as Error).message).slice(0, 80)})`]; }
    }
    out.github_commits = commits;
  }
  try {
    const ts = Math.floor(Date.parse(since) / 1000);
    const r = await fetch(`https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=50&numericFilters=${encodeURIComponent(`created_at_i>${ts},points>120`)}`, { signal: AbortSignal.timeout(20000) });
    if (r.ok) {
      const j = (await r.json()) as { hits: { title: string; url: string | null; points: number; objectID: string }[] };
      out.hacker_news = j.hits.map((h) => ({ title: h.title, points: h.points, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}` }));
    }
  } catch { /* HN недоступний — не страшно */ }
  return out;
}

const ourContext = () => `Хто ми: Саша — агенція/фрілансер для малого бізнесу в Україні (реклама Meta, сайти, налаштування відділів продажу: CRM, телефонія, навчання, автоматизація). Будуємо власні інструменти (CRM для забудовника, система Client Ops з помічником Джері). Креативи робимо в ${creativeTools() || "Claude"}.`;

export async function runRadar(onlyArea?: RadarArea): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  if (!getApiKey()) return { ok: false, error: "Нема ключа Anthropic (Налаштування → Доступи)" };
  // Вікно — від минулого прогону, але не менше 7 днів (повтори відсіює seen)
  const week = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const lastRun = getSetting("radar.last_at")?.slice(0, 10) ?? week;
  const since = lastRun < week ? lastRun : week;
  const today = new Date().toISOString().slice(0, 10);
  progress("збираю сигнали: GitHub, Hacker News…");
  const raw = await rawSignals(since);
  const styles = listStyles().filter((s) => s.active).map((s) => ({ id: s.id, kind: s.kind, title: s.title }));
  const seen = listRadar(undefined, 150).map((r) => r.title);
  let added = 0;
  const errors: string[] = [];
  const report: string[] = [`сигнали: GitHub ${Array.isArray(raw.github_trending) ? `${raw.github_trending.length} репо` : raw.github_trending ? "помилка" : "не підключено"}, HN ${Array.isArray(raw.hacker_news) ? raw.hacker_news.length : "недоступний"}; з ${since}`];
  for (const area of (onlyArea ? [onlyArea] : (Object.keys(RADAR_AREAS) as RadarArea[]))) {
    const A = RADAR_AREAS[area];
    const t0 = Date.now();
    progress(`${A.label}: Джері шукає в мережі…`);
    const system = `Ти — AI-радар Саші. ${ourContext()}
Напрямок цього прогону: «${A.label}» — ${A.focus}.
Знайди, що НОВОГО зʼявилось з ${since} (сьогодні ${today}) у цьому напрямку і реально допоможе нам працювати швидше/краще або дасть ідею нового продукту для клієнтів. Перші, хто це помічає, — офіційні блоги/ченджлоги, GitHub, Hacker News, профільні розсилки; список джерел нижче.
Використай web_search (2–4 запити) і сирі сигнали (GitHub, Hacker News). Відсіюй хайп, загальні статті і те, що є в seen. Бери конкретне: реліз, новий інструмент, нова функція, зміна правил — з посиланням.
score: 5 — змінює гру для нас/клієнтів, варто впровадити зараз; 4 — сильне, спробувати цього тижня; 3 — корисно знати; 1–2 — не бери взагалі.
Відповідай ТІЛЬКИ JSON: {"items": [{"title": "коротко, що нового", "source": "хто/де (вкажи, якщо вторинне джерело)", "url": "посилання", "what": "що це, 1–2 речення", "how": "що це дає нам і нашим клієнтам, конкретно, 1–3 речення", "score": 3-5${area === "creatives" ? `, "style_id": id шаблону стилю креативів, який доповнити, або null, "kind": "general|square|feed|story|carousel|motion|video|ugc|imagegen", "style_title": "назва нового шаблону", "add": "що дописати в шаблон — пункти з «- », або порожньо"` : ""}}]} — до 4 карток, найважливіші першими; нічого суттєвого — {"items": []}. Українською.`;
    const user = `ДЖЕРЕЛА:\n${radarSources()}\n\nВЖЕ БАЧИЛИ (seen):\n${JSON.stringify(seen)}\n\n${area === "creatives" ? `ШАБЛОНИ СТИЛЮ КРЕАТИВІВ:\n${JSON.stringify(styles)}\n\n` : ""}СИРІ СИГНАЛИ З ${since}:\n${JSON.stringify(raw).slice(0, 18000)}`;
    try {
      const text = await askWithWeb(system, user);
      let j: { items?: Found[] };
      try { j = parseJson<{ items?: Found[] }>(text); } catch { report.push(`${A.label}: не JSON — «${text.replace(/\s+/g, " ").slice(0, 120)}»`); continue; }
      const got = j.items ?? [];
      let low = 0, dup = 0, kept = 0;
      for (const f of got.slice(0, 5)) {
        if (!f?.title?.trim() || Number(f.score) < 3) { low++; continue; }
        const sid = typeof f.style_id === "number" && styles.some((s) => s.id === f.style_id) ? f.style_id : null;
        const id = addRadar({ area, score: Math.max(1, Math.min(5, Math.round(Number(f.score) || 3))), title: String(f.title).trim().slice(0, 200), source: String(f.source ?? "").slice(0, 160), url: String(f.url ?? "").slice(0, 500), what: String(f.what ?? ""), how: String(f.how ?? ""),
          hint_style_id: sid, hint_kind: String(f.kind ?? (area === "creatives" ? "general" : "")), hint_title: String(f.style_title ?? ""), hint_body: area === "creatives" ? String(f.add ?? "") : "" });
        if (id) { added++; kept++; seen.push(String(f.title)); } else dup++;
      }
      report.push(`${A.label}: знайдено ${got.length}, взято ${kept}${low ? `, слабких ${low}` : ""}${dup ? `, повторів ${dup}` : ""} · ${Math.round((Date.now() - t0) / 1000)} с`);
    } catch (e) {
      report.push(`${A.label}: помилка — ${String((e as Error).message).slice(0, 100)} · ${Math.round((Date.now() - t0) / 1000)} с`);
      logError("ai-radar", e);
      errors.push(`${A.label}: ${String((e as Error).message).slice(0, 100)}`);
      if ((e as { status?: number }).status === 401) return { ok: false, error: "Ключ Anthropic не підходить" };
    }
  }
  setSetting("radar.report", `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC\n${report.join("\n")}`);
  if (!onlyArea) setSetting("radar.last_at", new Date().toISOString());
  if (errors.length && !added) return { ok: false, error: `Радар не вдався: ${errors.join("; ").slice(0, 300)}` };
  return { ok: true, added };
}

// Картка з посилання, яке кинув Саша (пост, відео, репо): Джері відкриває сторінку і розкладає
export async function radarFromLink(url: string, note = ""): Promise<{ ok: true; id: number; title: string } | { ok: false; error: string }> {
  if (!/^https?:\/\/\S+$/.test(url.trim())) return { ok: false, error: "Потрібне посилання http(s)" };
  const system = `Ти — AI-радар Саші. ${ourContext()}
Саша кинув посилання${note ? ` з коментарем: «${note}»` : ""}. Відкрий його (web_fetch; якщо не відкривається — web_search за назвою) і зроби ОДНУ картку радару.
Напрямки: ${Object.entries(RADAR_AREAS).map(([k, v]) => `${k} — ${v.label}`).join("; ")}.
Відповідай ТІЛЬКИ JSON: {"area": "ключ напрямку", "title": "коротко, що це", "source": "хто/де", "what": "що це, 1–2 речення", "how": "що це дає нам і клієнтам, 1–3 речення", "score": 1-5}. Якщо сторінку не вдалось прочитати ні так, ні так — {"error": "чому"}. Українською.`;
  try {
    const j = parseJson<Found & { error?: string }>(await askWithWeb(system, url.trim(), 3000));
    if (j.error || !j.title) return { ok: false, error: j.error || "Не вдалось розібрати сторінку" };
    const area = j.area && isArea(j.area) ? j.area : "agents";
    const id = addRadar({ area, score: Math.max(1, Math.min(5, Math.round(Number(j.score) || 3))), title: String(j.title).slice(0, 200), source: `від Саші · ${String(j.source ?? "").slice(0, 120)}`, url: url.trim().slice(0, 500), what: String(j.what ?? ""), how: String(j.how ?? ""), hint_style_id: null, hint_kind: "", hint_title: "", hint_body: "" });
    if (!id) return { ok: false, error: "Така картка вже є" };
    return { ok: true, id, title: String(j.title) };
  } catch (e) {
    logError("ai-radar-link", e);
    return { ok: false, error: `Не вдалось: ${String((e as Error).message).slice(0, 160)}` };
  }
}

// «Карта ринку» раз на місяць: де зараз гра, що стало стандартом, що зʼявляється, 3 ідеї продуктів для нас
export async function buildMarketMap(): Promise<{ ok: true } | { ok: false; error: string }> {
  const cards = listRadar(undefined, 120).filter((r) => Date.now() - Date.parse(r.created_at.replace(" ", "T") + "Z") < 45 * 864e5);
  if (cards.length < 3) return { ok: false, error: "Замало карток радару за останні 45 днів" };
  const system = `Ти — стратег Саші. ${ourContext()}
Дано картки AI-радару за останні тижні (status: accepted — Саша взяв, skipped — пропустив, new — ще не дивився). Склади «Карту ринку» українською, markdown:
## Де зараз гра — 3–5 пунктів: що відбувається в AI для малого бізнесу, реклами, продажів
## Що вже стало стандартом — без цього ми відстаємо (пункти)
## Що зʼявляється — варто пробувати зараз (пункти)
## Ідеї нових продуктів для нас — рівно 3, кожна: **назва** — для кого, що робить, з чого зібрати (інструменти з карток), чому зараз
## Що робимо цього місяця — 3 конкретні кроки
Тільки з карток і загальновідомого; не вигадуй цифр. Коротко.`;
  try {
    const key = getApiKey();
    if (!key) return { ok: false, error: "Нема ключа Anthropic" };
    const r = await new Anthropic({ apiKey: key, timeout: 300_000, maxRetries: 1 }).messages.create({ model: agentConfig().model, max_tokens: 5000, system, messages: [{ role: "user", content: JSON.stringify(cards.map((c) => ({ area: RADAR_AREAS[c.area as RadarArea]?.label ?? c.area, title: c.title, what: c.what, how: c.how, score: c.score, status: c.status }))) }] });
    const md = r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    if (!md) return { ok: false, error: "Порожня відповідь" };
    setSetting("radar.map", md);
    setSetting("radar.map_at", new Date().toISOString());
    return { ok: true };
  } catch (e) {
    logError("radar-map", e);
    return { ok: false, error: `Не вдалось: ${String((e as Error).message).slice(0, 160)}` };
  }
}

// Прогін триває 10–25 хв (6 напрямків з пошуком) — завжди у фоні; стан у settings radar.running
export const radarRunning = () => {
  const [at, boot] = (getSetting("radar.running") ?? "").split("|");
  const t = Date.parse(at ?? "");
  return !Number.isNaN(t) && boot === BOOT && Date.now() - t < 60 * 60_000;
};
export function startRadar(onlyArea?: RadarArea): boolean {
  if (radarRunning()) return false;
  setSetting("radar.running", `${new Date().toISOString()}|${BOOT}`);
  setSetting("radar.error", "");
  progress("старт");
  void runRadar(onlyArea).then((r) => (r.ok ? notifyRadar(r.added) : setSetting("radar.error", r.error))).catch((e) => logError("ai-radar", e)).finally(() => setSetting("radar.running", ""));
  return true;
}
async function notifyRadar(added: number) {
  if (!added) return;
  const { tg, tgOwner } = await import("./telegram");
  const owner = tgOwner();
  const top = listRadar("new", added).sort((a, b) => b.score - a.score).slice(0, 6);
  if (owner) await tg("sendMessage", { chat_id: owner, text: `🛰 AI-радар: ${added} нового\n${top.map((x) => `${"★".repeat(x.score)} ${RADAR_AREAS[x.area as RadarArea]?.label ?? ""}: ${x.title}`).join("\n")}\n\nРозвиток → Радар` }).catch(() => {});
}

// Раз на 3 дні (після 9:00 за Києвом) + карта ринку раз на 30 днів
export async function radarTick(): Promise<void> {
  if (!autoOn("ai_radar")) return;
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv", hour: "numeric", hour12: false }));
  if (hour < 9 || hour >= 22) return;
  const last = Date.parse(getSetting("radar.last_at") ?? "");
  const tried = Date.parse(getSetting("radar.tried_at") ?? "");
  const due = Number.isNaN(last) || Date.now() - last > EVERY_DAYS * 864e5 - 3600_000;
  if (due && (Number.isNaN(tried) || Date.now() - tried > 20 * 3600_000)) {
    setSetting("radar.tried_at", new Date().toISOString());
    startRadar(); // у фоні — не тримає щохвилинний цикл (заявки, CRM)
    return;
  }
  const mapAt = Date.parse(getSetting("radar.map_at") ?? "");
  const mapTried = Date.parse(getSetting("radar.map_tried") ?? "");
  if (!radarRunning() && (Number.isNaN(mapAt) || Date.now() - mapAt > 30 * 864e5) && (Number.isNaN(mapTried) || Date.now() - mapTried > 864e5)) {
    setSetting("radar.map_tried", new Date().toISOString());
    void buildMarketMap().catch((e) => logError("radar-map", e));
  }
}

// Що робимо з карткою: style — дописати в шаблон креативів; idea — в ідеї (Розвиток); plan — у план розвитку («Далі»); ok — просто корисно; skip
export type RadarOp = "style" | "idea" | "plan" | "ok" | "skip";
export async function decideRadar(id: number, op: RadarOp, add?: string, styleId?: number): Promise<boolean> {
  const cc = await import("./repo/creativeCenter");
  const it = cc.getRadar(id);
  if (!it) return false;
  if (op === "skip") { cc.setRadarStatus(it.id, "skipped"); return true; }
  const body = [it.what, it.how && `**Що дає нам:** ${it.how}`, it.url && `Джерело: ${it.url}`].filter(Boolean).join("\n\n");
  if (op === "style") {
    const text = (add ?? it.hint_body).trim();
    const st = styleId || it.hint_style_id ? cc.getStyle((styleId || it.hint_style_id)!) : undefined;
    if (text && st) cc.saveStyle({ id: st.id, kind: st.kind, title: st.title, body: `${st.body.trim()}\n${text}`, active: !!st.active });
    else if (text) cc.saveStyle({ kind: it.hint_kind || "general", title: it.hint_title || it.title, body: text, source: "radar" });
  } else if (op === "idea" || op === "plan") {
    const { addOrgItem } = await import("./repo/products");
    addOrgItem({ kind: op, title: it.title, body: `${body}\n\n(з AI-радару)`, ...(op === "plan" ? { horizon: "next" } : {}) });
  }
  cc.setRadarStatus(it.id, "accepted", op);
  return true;
}
