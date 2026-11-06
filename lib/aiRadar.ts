// AI-радар креативів: раз на тиждень Джері дивиться, що нового (GitHub: офіційні скіли/кукбуки; веб: Anthropic, OpenAI,
// Meta, генератори фото/відео) і пише картки «що це → як нам використати → що дописати в шаблон стилю».
import Anthropic from "@anthropic-ai/sdk";
import { agentConfig } from "./agent/config";
import { autoOn } from "./agent/caps";
import { githubToken, listCommits } from "./github";
import { logError } from "./log";
import { addRadar, listRadar, listStyles } from "./repo/creativeCenter";
import { getSetting, setSetting } from "./repo/settings";
import { getApiKey } from "./secrets";

export const RADAR_REPOS_DEFAULT = "anthropics/skills\nanthropics/claude-cookbooks\nopenai/openai-cookbook";
export const radarRepos = () => (getSetting("radar.repos") ?? RADAR_REPOS_DEFAULT).split("\n").map((x) => x.trim()).filter((x) => /^[\w.-]+\/[\w.-]+$/.test(x));
export const creativeTools = () => getSetting("creative.tools") ?? "";

type Found = { title?: string; source?: string; url?: string; what?: string; how?: string; style_id?: number | null; kind?: string; style_title?: string; add?: string };

export async function runRadar(): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const key = getApiKey();
  if (!key) return { ok: false, error: "Нема ключа Anthropic (Налаштування → Доступи)" };
  const since = getSetting("radar.last_at")?.slice(0, 10) ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  // 1) GitHub — що змінилось у репозиторіях зі списку (якщо підключено)
  const gh: Record<string, string[]> = {};
  if (githubToken()) for (const repo of radarRepos()) {
    try { gh[repo] = (await listCommits(repo)).filter((c) => c.date >= since).map((c) => `${c.date}: ${c.message}`).slice(0, 15); }
    catch (e) { gh[repo] = [`(не вдалось: ${String((e as Error).message).slice(0, 80)})`]; }
  }
  const styles = listStyles().filter((s) => s.active).map((s) => ({ id: s.id, kind: s.kind, title: s.title, body: s.body.slice(0, 600) }));
  const seen = listRadar(undefined, 80).map((r) => r.title);
  const model = agentConfig().model;
  const { webToolsFor, webBetaFor } = await import("./agent/run");
  const system = `Ти — AI-радар креативної студії Саші (реклама клієнтів у Meta: Facebook/Instagram; креативи робимо в Claude${creativeTools() ? ` + ${creativeTools()}` : ""}).
Завдання: знайти, що НОВОГО зʼявилось з ${since} (сьогодні ${new Date().toISOString().slice(0, 10)}) і реально допоможе робити кращі рекламні креативи швидше: нові можливості Claude (скіли, дизайн, артефакти, моделі), OpenAI (генерація зображень/відео), Meta (Advantage+ Creative, формати, правила, вимоги до AI-контенту), генератори фото/відео (Midjourney, Higgsfield, Kling, Runway, Veo тощо), робочі прийоми таргетологів.
Використай web_search (кілька запитів) і зміни в GitHub нижче. Відсіюй хайп і загальні статті; бери тільки конкретне і перевірене (офіційні анонси, релізи, документація). Не повторюй те, що вже є в seen або в шаблонах.
Відповідай ТІЛЬКИ JSON: {"items": [{"title": "коротко, що нового", "source": "хто/де", "url": "посилання", "what": "що це, 1–2 речення", "how": "як нам використати в креативах, 1–3 речення", "style_id": id шаблону, який варто доповнити, або null, "kind": "general|square|feed|story|carousel|motion|video|ugc|imagegen", "style_title": "назва шаблону (для нового)", "add": "що дописати в шаблон — 1–4 пункти з «- », готові до вставки; порожньо, якщо нічого"}]} — до 6 карток, найважливіші першими. Нічого суттєвого — {"items": []}. Українською.`;
  const user = `ШАБЛОНИ СТИЛЮ ЗАРАЗ:\n${JSON.stringify(styles)}\n\nВЖЕ БАЧИЛИ (seen):\n${JSON.stringify(seen)}\n\nGITHUB З ${since}:\n${JSON.stringify(gh)}`;
  try {
    const client = new Anthropic({ apiKey: key, timeout: 600_000, maxRetries: 1 });
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: user }];
    let out = "";
    for (let i = 0; i < 4; i++) {
      const betas = webBetaFor(model);
      const r = await client.beta.messages.create({ model, max_tokens: 12000, system, messages, tools: webToolsFor(model), ...(betas.length ? { betas } : {}) });
      out = r.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
      if (r.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: r.content as Anthropic.Beta.BetaContentBlockParam[] });
    }
    const a = out.indexOf("{"), z = out.lastIndexOf("}");
    if (a < 0 || z <= a) throw new Error("Модель не повернула JSON");
    const j = JSON.parse(out.slice(a, z + 1).replace(/,\s*([\]}])/g, "$1")) as { items?: Found[] };
    let added = 0;
    for (const f of (j.items ?? []).slice(0, 8)) {
      if (!f?.title?.trim()) continue;
      const sid = typeof f.style_id === "number" && styles.some((s) => s.id === f.style_id) ? f.style_id : null;
      const id = addRadar({ title: String(f.title).trim().slice(0, 200), source: String(f.source ?? "").slice(0, 120), url: String(f.url ?? "").slice(0, 500), what: String(f.what ?? ""), how: String(f.how ?? ""),
        hint_style_id: sid, hint_kind: String(f.kind ?? "general"), hint_title: String(f.style_title ?? ""), hint_body: String(f.add ?? "") });
      if (id) added++;
    }
    setSetting("radar.last_at", new Date().toISOString());
    return { ok: true, added };
  } catch (e) {
    logError("ai-radar", e);
    const st = (e as { status?: number }).status;
    return { ok: false, error: st === 401 ? "Ключ Anthropic не підходить" : `Радар не вдався: ${String((e as Error).message).slice(0, 160)}` };
  }
}

// Раз на тиждень (понеділок після 9:00 за Києвом), одна спроба на день; нове → коротко Саші в Telegram
export async function radarTick(): Promise<void> {
  if (!autoOn("ai_radar")) return;
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
  if (now.getDay() !== 1 || now.getHours() < 9) return;
  const today = now.toISOString().slice(0, 10);
  if (getSetting("radar.tried") === today) return;
  setSetting("radar.tried", today);
  const r = await runRadar();
  if (!r.ok || !r.added) return;
  const { tg, tgOwner } = await import("./telegram");
  const owner = tgOwner();
  if (owner) await tg("sendMessage", { chat_id: owner, text: `🛰 AI-радар: ${r.added} нових для креативів\n${listRadar("new", r.added).map((x) => `• ${x.title}`).join("\n")}\n\nКреативи → AI-радар` }).catch(() => {});
}
