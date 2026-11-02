// Промпт на креатив для Claude: Джері бере, що вже працює в рекламі клієнта (цифри + тексти + думки з розбору),
// бренд клієнта, офер і результати попередніх промптів — і пише готове ТЗ, яке Саша вставляє в Claude/Claude Code.
import Anthropic from "@anthropic-ai/sdk";
import { agentConfig } from "./agent/config";
import { logError } from "./log";
import { getClient } from "./repo/clients";
import { adIdsOf, addPrompt, listChanges, listPrompts, type CreativePrompt } from "./repo/creatives";
import { adsForClient, getAnalysis, type MetaAd } from "./repo/meta";
import { getSetting } from "./repo/settings";
import { getApiKey } from "./secrets";
import { cplOf, ctrOf } from "./metaInsights";

export const FORMATS = { square: "Квадрат 1080×1080 (стрічка)", story: "Сторіс / Reels 1080×1920", carousel: "Карусель 3–5 карток", video: "Сценарій відео (Reels 15–30 с)" } as const;
export type CreativeFormat = keyof typeof FORMATS;
export const brandOf = (clientId: number) => getSetting(`brand.${clientId}`) ?? "";

const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);

// Цифри оголошень, привʼязаних до промпту
export function promptStats(p: CreativePrompt, ads: MetaAd[]) {
  const mine = ads.filter((a) => adIdsOf(p).includes(a.ad_id));
  const t = mine.reduce((s, a) => ({ spend: s.spend + a.spend_30d, leads: s.leads + a.leads_30d, clicks: s.clicks + a.clicks_30d, impressions: s.impressions + a.impressions_30d }), { spend: 0, leads: 0, clicks: 0, impressions: 0 });
  return { ads: mine, ...t, cpl: cplOf(t), ctr: ctrOf(t) };
}

export async function generateCreativePrompt(clientId: number, o: { format: CreativeFormat; angle?: string; note?: string }): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const key = getApiKey();
  if (!key) return { ok: false, error: "Нема ключа Anthropic (Налаштування → Доступи)" };
  const c = getClient(clientId);
  if (!c) return { ok: false, error: "Клієнта нема" };
  const ads = adsForClient(clientId).filter((a) => a.spend_30d > 0);
  const tot = ads.reduce((s, a) => ({ spend: s.spend + a.spend_30d, leads: s.leads + a.leads_30d }), { spend: 0, leads: 0 });
  const avgCpl = cplOf(tot);
  const opinion = getAnalysis(clientId)?.data;
  const adRow = (a: MetaAd) => ({ name: a.name, type: a.kind, text: a.body.slice(0, 300), spend: r2(a.spend_30d), leads: a.leads_30d, cpl: r2(cplOf({ spend: a.spend_30d, leads: a.leads_30d })), ctr: r2(ctrOf({ clicks: a.clicks_30d, impressions: a.impressions_30d })), jerry: opinion?.creatives?.[a.ad_id] });
  const withLeads = ads.filter((a) => a.leads_30d > 0).sort((x, y) => x.spend_30d / x.leads_30d - y.spend_30d / y.leads_30d);
  const past = listPrompts(clientId, 15).map((p) => { const st = promptStats(p, ads); return { title: p.title, angle: p.angle, format: p.format, verdict: p.verdict || undefined, notes: p.notes || undefined, spend: r2(st.spend), leads: st.leads, cpl: r2(st.cpl), ctr: r2(st.ctr) }; });
  const data = {
    client: { name: c.name, niche: c.niche, offer: c.offer, needs: c.needs, client_vision: c.client_vision, my_vision: c.my_vision },
    brand: brandOf(clientId) || "не задано — візьми стриманий сучасний стиль і залиш місця [логотип], [фото обʼєкта]",
    avg_cpl: r2(avgCpl),
    best_ads: withLeads.slice(0, 5).map(adRow), worst_ads: ads.filter((a) => a.spend_30d > (avgCpl ?? 0) && (a.leads_30d === 0 || a.spend_30d / a.leads_30d > (avgCpl ?? 0) * 1.4)).slice(0, 4).map(adRow),
    analysis: opinion ? { summary: opinion.summary, patterns: opinion.patterns, tips: opinion.tips } : undefined,
    past_prompts: past, recent_changes: listChanges(clientId, 8).map((x) => ({ at: x.at, what: x.what, result: x.result || undefined })),
  };
  const system = `Ти — Джері, креативний таргетолог Саші. Твоє завдання — написати ПРОМПТ (технічне завдання), який Саша вставить у Claude / Claude Code, щоб той зробив рекламний креатив для Meta.
Спирайся на дані: що вже дає дешеві ліди (best_ads), що зливає (worst_ads), патерни з розбору і результати минулих промптів (past_prompts: verdict win — повторюй підхід, lose — уникай). Один креатив = одна думка/кут.
Промпт має бути самодостатній і конкретний:
- формат і розмір; для зображення — зробити як HTML/CSS-сторінку точно цього розміру (щоб зберегти як PNG), для відео — покадровий сценарій з текстом на екрані;
- кут (angle) і для кого; хук першої секунди / головний заголовок (3 варіанти), підзаголовок, CTA;
- візуал: що в кадрі, композиція, кольори і шрифти з бренду, читабельність на телефоні (великий текст, контраст, мінімум слів);
- текст оголошення для Meta: primary text (2 варіанти), headline, опис;
- чого НЕ робити (з того, що не спрацювало);
- в кінці попроси 2 варіації (А/Б), що відрізняються одним елементом.
Не вигадуй факти про клієнта (ціни, знижки, адреси), яких нема в даних — став [уточнити].
Відповідай ТІЛЬКИ JSON: {"title": "коротка назва креативу", "angle": "кут одним реченням", "prompt": "повний текст промпту українською"}`;
  const user = `Формат: ${FORMATS[o.format]}${o.angle ? `\nКут, який хоче Саша: ${o.angle}` : "\nКут обери сам — найперспективніший з даних."}${o.note ? `\nПобажання Саші: ${o.note}` : ""}\n\nДАНІ:\n${JSON.stringify(data)}`;
  try {
    const r = await new Anthropic({ apiKey: key, timeout: 120000, maxRetries: 1 }).messages.create({ model: agentConfig().model, max_tokens: 6000, system, messages: [{ role: "user", content: user }] });
    const out = r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const j = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as { title?: string; angle?: string; prompt?: string };
    if (!j.prompt) return { ok: false, error: "Порожній промпт — спробуй ще раз" };
    const id = addPrompt({ client_id: clientId, title: j.title || "Креатив", angle: j.angle || o.angle || "", format: FORMATS[o.format], prompt: j.prompt, notes: o.note });
    return { ok: true, id };
  } catch (e) {
    logError("creative-prompt", e);
    const st = (e as { status?: number }).status;
    return { ok: false, error: st === 401 ? "Ключ Anthropic не підходить" : "Не вдалось — спробуй ще раз" };
  }
}
