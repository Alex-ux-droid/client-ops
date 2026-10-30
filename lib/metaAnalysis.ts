// Розбір реклами від Джері: цифри + самі картинки креативів → підсумок, плюси, мінуси, поради, думка по кожному креативу.
// Запускається кнопкою (коштує кредитів API), результат зберігається в meta_analysis.
import Anthropic from "@anthropic-ai/sdk";
import { agentConfig } from "./agent/config";
import { getApiKey } from "./secrets";
import { accountsForClient, adsForClient, adsetsForClient, breakdowns, campaignsWithStats, kyivDay, saveAnalysis, totals, type MetaAnalysis } from "./repo/meta";
import { cplOf, ctrOf, freqOf, label } from "./metaInsights";

const PROMPT = `Ти — Джері, сильний таргетолог і права рука Саші (він веде рекламу клієнтів у Meta). Тобі дають цифри рекламного кабінету клієнта за 30 днів і картинки креативів.
Зроби чесний практичний розбір: що працює, що зливає гроші, що конкретно зробити, щоб ліди стали дешевші і їх стало більше.
Дивись на самі креативи: перший кадр, оффер, читабельність, контраст, чи зрозуміло за 1 секунду, заклик. Порівнюй з цифрами (ціна ліда, CTR, частота).
Пиши українською, коротко, простими словами, без води і без загальних порад «тестуйте більше». Кожна порада — конкретна дія з назвою кампанії/креативу/сегмента.
Цифри бери тільки з даних, нічого не вигадуй. Якщо даних мало для висновку — так і скажи.

Відповідай ТІЛЬКИ JSON без markdown:
{"summary": "2-3 речення: як справи загалом",
 "pros": ["що добре", ...],
 "cons": ["що погано / де зливаються гроші", ...],
 "tips": ["конкретна дія", ...],
 "audience": "1-3 речення: хто і звідки приходить, де ліди дешевші",
 "creatives": {"<ad_id>": "1-2 речення думки про цей креатив: що в ньому сильне/слабке і що з ним робити", ...}}`;

const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);

export async function analyzeMeta(clientId: number): Promise<void> {
  const key = getApiKey();
  if (!key) throw new Error("Нема ключа Anthropic — Налаштування → Доступи");
  const accs = accountsForClient(clientId);
  if (!accs.length) throw new Error("До клієнта не привʼязаний рекламний кабінет");
  const m = totals(clientId, kyivDay(29), kyivDay(0)), w = totals(clientId, kyivDay(6), kyivDay(0)), p = totals(clientId, kyivDay(13), kyivDay(7));
  const total = breakdowns(clientId, "total")[0];
  const ads = adsForClient(clientId);
  const cut = (kind: string) => breakdowns(clientId, kind).slice(0, 10).map((b) => ({ segment: label(kind, b.key), spend: r2(b.spend), leads: b.leads, cpl: r2(cplOf(b)), ctr: r2(ctrOf(b)) }));
  const data = {
    currency: accs[0].currency,
    last_30_days: { ...m, cpl: r2(cplOf(m)), ctr: r2(ctrOf(m)), reach: total?.reach, frequency: r2(total ? freqOf(total.impressions, total.reach) : null) },
    last_7_days: { ...w, cpl: r2(cplOf(w)) }, previous_7_days: { ...p, cpl: r2(cplOf(p)) },
    campaigns: campaignsWithStats(clientId, kyivDay(29)).filter((c) => c.spend > 0 || c.status === "ACTIVE")
      .map((c) => ({ name: c.name, status: c.status, objective: c.objective, daily_budget: c.daily_budget, spend: r2(c.spend), leads: c.leads, cpl: r2(cplOf(c)) })),
    adsets: adsetsForClient(clientId).filter((a) => a.spend_30d > 0).slice(0, 20)
      .map((a) => ({ name: a.name, status: a.status, goal: a.optimization_goal, spend: r2(a.spend_30d), leads: a.leads_30d, cpl: r2(cplOf({ spend: a.spend_30d, leads: a.leads_30d })), frequency: r2(freqOf(a.impressions_30d, a.reach_30d)) })),
    ads: ads.slice(0, 25).map((a) => ({ ad_id: a.ad_id, name: a.name, type: a.kind, status: a.status, text: a.body.slice(0, 300), spend: r2(a.spend_30d), leads: a.leads_30d,
      cpl: r2(cplOf({ spend: a.spend_30d, leads: a.leads_30d })), ctr: r2(ctrOf({ clicks: a.clicks_30d, impressions: a.impressions_30d })), frequency: r2(freqOf(a.impressions_30d, a.reach_30d)) })),
    placements: cut("placement"), age_gender: cut("age_gender"), regions: cut("region"), devices: cut("device"),
  };

  // Картинки топових креативів — щоб Джері бачив, що саме крутиться
  const pics = ads.filter((a) => a.image_url || a.thumbnail_url).slice(0, 8);
  const images: Anthropic.ContentBlockParam[] = pics.flatMap((a) => [
    { type: "text" as const, text: `Креатив ad_id=${a.ad_id} «${a.name}»${a.kind === "video" ? " (відео, це обкладинка)" : a.kind === "carousel" ? " (карусель, перша картка)" : ""}:` },
    { type: "image" as const, source: { type: "url" as const, url: a.image_url || a.thumbnail_url } },
  ]);
  const text: Anthropic.ContentBlockParam = { type: "text", text: `ДАНІ КАБІНЕТУ:\n${JSON.stringify(data)}` };

  const client = new Anthropic({ apiKey: key });
  const ask = (content: Anthropic.ContentBlockParam[]) => client.messages.create({
    model: agentConfig().model, max_tokens: 8000, system: PROMPT, output_config: { effort: "medium" },
    messages: [{ role: "user", content }],
  });
  let res: Anthropic.Message;
  try {
    res = await ask([...images, text]);
  } catch (e) {
    // картинки з Meta можуть не відкритись для Anthropic — тоді розбір тільки по цифрах
    if (!images.length) throw e;
    res = await ask([text]);
  }
  const out = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
  let parsed: MetaAnalysis;
  try {
    parsed = JSON.parse(json) as MetaAnalysis;
  } catch {
    throw new Error("Джері відповів не в тому форматі — спробуй ще раз");
  }
  saveAnalysis(clientId, parsed);
}
