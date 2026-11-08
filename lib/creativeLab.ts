// Промпт на креатив для Claude: Джері бере, що вже працює в рекламі клієнта (цифри + тексти + думки з розбору),
// бренд клієнта, офер і результати попередніх промптів — і пише готове ТЗ, яке Саша вставляє в Claude/Claude Code.
import Anthropic from "@anthropic-ai/sdk";
import { ai } from "./ai";
import { agentConfig } from "./agent/config";
import { asText } from "./llmJson";
import { logError } from "./log";
import { getClient } from "./repo/clients";
import { adIdsOf, addPrompt, listChanges, listPrompts, updatePrompt, type CreativePrompt } from "./repo/creatives";
import { adsForClient, getAnalysis, type MetaAd } from "./repo/meta";
import { getSetting } from "./repo/settings";
import { getApiKey } from "./secrets";
import { cplOf, ctrOf } from "./metaInsights";
import { stylesFor } from "./repo/creativeCenter";
import { creativeTools } from "./aiRadar";
import { adBook, adOfferOf, brandOf, creativeNums, extractFooter, rulesOf } from "./creativeStudio";
export { brandOf };

export const FORMATS = {
  square: "Картинка 1080×1080 (стрічка)", feed: "Картинка 1080×1350 (стрічка, вертикальна)", story: "Сторіс / Reels 1080×1920 (статика)",
  carousel: "Карусель 3–5 карток", motion: "Моушен 1080×1920, 6–10 с (анімація)", video: "Сценарій відео Reels 15–30 с",
  ugc: "UGC-сценарій (людина в кадрі, телефон)", imagegen: "Фото для Midjourney (промпти кадрів)",
} as const;
export type CreativeFormat = keyof typeof FORMATS;
// Як саме Claude має виконати кожен формат
const HOW: Record<CreativeFormat, string> = {
  square: "зробити як одну HTML/CSS-сторінку рівно 1080×1080 (щоб зберегти PNG)",
  feed: "зробити як одну HTML/CSS-сторінку рівно 1080×1350 (щоб зберегти PNG)",
  story: "HTML/CSS 1080×1920; безпечні зони: верхні 250 і нижні 340 px без тексту",
  carousel: "3–5 HTML/CSS-карток 1080×1080, кожна — один крок історії, перша — хук, остання — CTA",
  motion: "HTML/CSS/SVG-анімація 1080×1920 на 6–10 с, що зациклюється; хук у першу секунду; розписати таймлайн по секундах; так, щоб я записав екран або експортував у відео",
  video: "покадровий сценарій 15–30 с (секунди, що в кадрі, текст на екрані, голос/музика, хук у 1-шу секунду) + на кожен кадр промпт Midjourney (--ar 9:16) і рух камери для Higgsfield + інструкція монтажу в CapCut",
  ugc: "сценарій для людини з телефоном (вертикально): хук-фраза, 3–4 репліки природною мовою, де знімати, що показати; без «рекламного» тону",
  imagegen: "англомовні промпти Midjourney (3 варіанти: композиція, світло, обʼєктив, стиль; --ar 4:5 або 9:16; --sref з бренду клієнта, якщо є), окремо — текст, який я накладу зверху; без тексту всередині фото",
};

const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);

// Цифри оголошень, привʼязаних до промпту
export function promptStats(p: CreativePrompt, ads: MetaAd[]) {
  const mine = ads.filter((a) => adIdsOf(p).includes(a.ad_id));
  const t = mine.reduce((s, a) => ({ spend: s.spend + a.spend_30d, leads: s.leads + a.leads_30d, clicks: s.clicks + a.clicks_30d, impressions: s.impressions + a.impressions_30d }), { spend: 0, leads: 0, clicks: 0, impressions: 0 });
  return { ads: mine, ...t, cpl: cplOf(t), ctr: ctrOf(t) };
}

export async function generateCreativePrompt(clientId: number, o: { format: CreativeFormat; angle?: string; note?: string }): Promise<{ ok: true; id: number; title: string; prompt: string } | { ok: false; error: string }> {
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
  const book = adBook(clientId);
  const past = listPrompts(clientId, 15).map((p) => { const st = creativeNums(p, book); return { title: p.title, angle: p.angle, format: p.format, verdict: st.verdict || undefined, notes: p.notes || undefined, spend: r2(st.spend), leads: st.leads, cpl: r2(st.cpl), ctr: r2(st.ctr) }; });
  const data = {
    client: { name: c.name, niche: c.niche, what_we_advertise: adOfferOf(clientId) || undefined, client_goal: c.client_vision },
    rules: rulesOf(clientId) || undefined,
    my_style: stylesFor(o.format).map((x) => ({ title: x.title, body: x.body })),
    our_tools: creativeTools() || undefined,
    brand: brandOf(clientId) || "не задано — візьми стриманий сучасний стиль і залиш місця [логотип], [фото обʼєкта]",
    avg_cpl: r2(avgCpl),
    best_ads: withLeads.slice(0, 5).map(adRow), worst_ads: ads.filter((a) => a.spend_30d > (avgCpl ?? 0) && (a.leads_30d === 0 || a.spend_30d / a.leads_30d > (avgCpl ?? 0) * 1.4)).slice(0, 4).map(adRow),
    analysis: opinion ? { summary: opinion.summary, patterns: opinion.patterns, tips: opinion.tips } : undefined,
    past_prompts: past, recent_changes: listChanges(clientId, 8).map((x) => ({ at: x.at, what: x.what, result: x.result || undefined })),
  };
  const system = `Ти — Джері, креативний таргетолог Саші. Твоє завдання — написати ПРОМПТ (технічне завдання), який Саша вставить у Claude / Claude Code, щоб той зробив рекламний креатив для Meta.
Спирайся на дані: що вже дає дешеві ліди (best_ads), що зливає (worst_ads), патерни з розбору і результати минулих промптів (past_prompts: verdict win — повторюй підхід, lose — уникай). Один креатив = одна думка/кут.
Промпт має бути самодостатній і конкретний:
- формат і як його виконати (дано в «Як виконати»);
- кут (angle) і для кого; хук першої секунди / головний заголовок (3 варіанти), підзаголовок, CTA;
- візуал: що в кадрі, композиція, кольори і шрифти з бренду, читабельність на телефоні (великий текст, контраст, мінімум слів);
- текст оголошення для Meta: primary text (2 варіанти), headline, опис;
- чого НЕ робити (з того, що не спрацювало);
- в кінці попроси 2 варіації (А/Б), що відрізняються одним елементом.
my_style — мої актуальні прийоми і правила Meta (оновлюються з AI-радару): дотримуйся їх, вони важливіші за твої загальні знання. our_tools — чим я роблю креативи, пиши під них.
Дотримуйся rules клієнта (обовʼязково / заборонено). Контекст про клієнта Claude вже отримав окремим повідомленням «Контекст клієнта», тому не переписуй його — тільки завдання на цей креатив.
Не вигадуй факти про клієнта (ціни, знижки, адреси), яких нема в даних — став [уточнити].
Відповідай ТІЛЬКИ JSON: {"title": "коротка назва креативу", "angle": "кут одним реченням", "prompt": "повний текст промпту українською"}`;
  const user = `Формат: ${FORMATS[o.format]}\nЯк виконати: ${HOW[o.format]}${o.angle ? `\nКут, який хоче Саша: ${o.angle}` : "\nКут обери сам — найперспективніший з даних."}${o.note ? `\nПобажання Саші: ${o.note}` : ""}\n\nДАНІ:\n${JSON.stringify(data)}`;
  try {
    const r = await ai("креативи", { apiKey: key, timeout: 120000, maxRetries: 1 }).messages.create({ model: agentConfig().model, max_tokens: 8000, system, messages: [{ role: "user", content: user }] });
    const out = r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const raw = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as Record<string, unknown>;
    const j = { title: asText(raw.title), angle: asText(raw.angle), prompt: asText(raw.prompt) };
    if (!j.prompt) return { ok: false, error: "Порожній промпт — спробуй ще раз" };
    const id = addPrompt({ client_id: clientId, title: j.title || "Креатив", angle: j.angle || o.angle || "", format: FORMATS[o.format], prompt: j.prompt, notes: o.note });
    const full = `${j.prompt.trim()}${extractFooter({ id })}`;
    updatePrompt(id, { prompt: full });
    return { ok: true, id, title: j.title || "Креатив", prompt: full };
  } catch (e) {
    logError("creative-prompt", e);
    const st = (e as { status?: number }).status;
    return { ok: false, error: st === 401 ? "Ключ Anthropic не підходить" : "Не вдалось — спробуй ще раз" };
  }
}
