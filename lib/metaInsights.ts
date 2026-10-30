// Висновки по рекламі без ШІ: прості правила на цифрах (безкоштовно, миттєво).
// Глибокий розбір з думкою про креативи — lib/metaAnalysis.ts (Джері, коштує кредитів).
import { adsForClient, adsetsForClient, breakdowns, campaignsWithStats, kyivDay, totals, type Breakdown, type MetaAd } from "./repo/meta";

export type Tone = "good" | "bad" | "warn" | "";
export type Verdict = { tone: Tone; text: string };

export const cplOf = (t: { spend: number; leads: number }) => (t.leads ? t.spend / t.leads : null);
export const ctrOf = (t: { clicks: number; impressions: number }) => (t.impressions ? (t.clicks / t.impressions) * 100 : null);
export const freqOf = (impressions: number, reach: number) => (reach ? impressions / reach : null);

// Назви для розрізів
const PLATFORM: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", audience_network: "Audience Network", messenger: "Messenger", threads: "Threads" };
const POSITION: Record<string, string> = {
  feed: "стрічка", facebook_stories: "Stories", instagram_stories: "Stories", story: "Stories", facebook_reels: "Reels", instagram_reels: "Reels",
  marketplace: "Marketplace", video_feeds: "відеострічка", search: "пошук", instagram_explore: "Explore", instagram_explore_grid_home: "Explore",
  right_hand_column: "права колонка", instream_video: "у відео", profile_feed: "профіль", facebook_reels_overlay: "банер у Reels", an_classic: "сайти/додатки",
  messenger_inbox: "вхідні", rewarded_video: "відео за бонус", instagram_profile_feed: "профіль", notification: "сповіщення",
};
const GENDER: Record<string, string> = { male: "чоловіки", female: "жінки", unknown: "не вказано" };
const DEVICE: Record<string, string> = { iphone: "iPhone", ipad: "iPad", android_smartphone: "Android", android_tablet: "Android-планшет", desktop: "Компʼютер", other: "інше" };
const clean = (s: string) => s.replace(/_/g, " ");

export function label(kind: string, key: string): string {
  if (kind === "placement") { const [p, pos] = key.split(" · "); return `${PLATFORM[p] ?? clean(p)} · ${POSITION[pos] ?? clean(pos)}`; }
  if (kind === "age_gender") { const [a, g] = key.split(" · "); return `${a === "Unknown" ? "вік ?" : a} · ${GENDER[g] ?? g}`; }
  if (kind === "device") return DEVICE[key] ?? clean(key);
  return key || "—";
}

// Оцінка одного креативу на фоні середнього по клієнту
export function creativeVerdict(ad: MetaAd, avg: { cpl: number | null; ctr: number | null; spend: number }): Verdict[] {
  const out: Verdict[] = [];
  const cpl = cplOf({ spend: ad.spend_30d, leads: ad.leads_30d });
  const ctr = ctrOf({ clicks: ad.clicks_30d, impressions: ad.impressions_30d });
  const freq = freqOf(ad.impressions_30d, ad.reach_30d);
  const share = avg.spend ? ad.spend_30d / avg.spend : 0;
  if (!ad.leads_30d && avg.cpl && ad.spend_30d > avg.cpl * 2) out.push({ tone: "bad", text: `зливає: ${Math.round(ad.spend_30d)} без жодного ліда` });
  else if (ad.leads_30d < 3 && share < 0.05) out.push({ tone: "", text: "мало даних для висновку" });
  else if (cpl != null && avg.cpl && cpl <= avg.cpl * 0.75) out.push({ tone: "good", text: `ліди на ${Math.round((1 - cpl / avg.cpl) * 100)}% дешевші за середні — масштабувати` });
  else if (cpl != null && avg.cpl && cpl >= avg.cpl * 1.4) out.push({ tone: "bad", text: `ліди на ${Math.round((cpl / avg.cpl - 1) * 100)}% дорожчі за середні — замінити або вимкнути` });
  else out.push({ tone: "", text: "в нормі" });
  if (ctr != null && ad.impressions_30d > 2000 && ctr < 0.7) out.push({ tone: "warn", text: `слабко чіпляє: CTR ${ctr.toFixed(2)}%` });
  if (ctr != null && ad.impressions_30d > 2000 && avg.ctr && ctr > avg.ctr * 1.5) out.push({ tone: "good", text: `добре чіпляє: CTR ${ctr.toFixed(2)}%` });
  if (freq != null && freq > 3.5) out.push({ tone: "warn", text: `аудиторія втомилась: частота ${freq.toFixed(1)}` });
  if (share > 0.4) out.push({ tone: "", text: `забирає ${Math.round(share * 100)}% бюджету` });
  return out;
}

// Найкращий і найгірший сегмент розрізу (тільки з помітними витратами)
function bestWorst(rows: Breakdown[], total: number) {
  const ok = rows.filter((r) => r.spend >= total * 0.05 && r.leads > 0);
  if (ok.length < 2) return null;
  const sorted = [...ok].sort((a, b) => a.spend / a.leads - b.spend / b.leads);
  return { best: sorted[0], worst: sorted.at(-1)! };
}

export type Insights = { pros: string[]; cons: string[]; tips: string[] };

export function metaInsights(clientId: number, money: (n: number | null) => string): Insights {
  const pros: string[] = [], cons: string[] = [], tips: string[] = [];
  const w = totals(clientId, kyivDay(6), kyivDay(0)), p = totals(clientId, kyivDay(13), kyivDay(7));
  const m = totals(clientId, kyivDay(29), kyivDay(0));
  const total = breakdowns(clientId, "total")[0];
  const cw = cplOf(w), cp = cplOf(p), cm = cplOf(m);
  if (!m.spend) return { pros, cons: ["за 30 днів витрат нема — реклама не крутиться"], tips };

  if (cw != null && cp != null) {
    const d = (cw - cp) / cp;
    if (d <= -0.1) pros.push(`ціна ліда за тиждень впала на ${Math.round(-d * 100)}% (${money(cp)} → ${money(cw)})`);
    if (d >= 0.15) cons.push(`ціна ліда за тиждень зросла на ${Math.round(d * 100)}% (${money(cp)} → ${money(cw)})`);
  }
  if (w.spend > 0 && !w.leads) cons.push(`за 7 днів витрачено ${money(w.spend)} і жодного ліда`);
  if (w.leads && p.leads && w.leads > p.leads * 1.15) pros.push(`лідів більше, ніж минулого тижня: ${w.leads} проти ${p.leads}`);
  if (w.leads && p.leads && w.leads < p.leads * 0.8) cons.push(`лідів менше, ніж минулого тижня: ${w.leads} проти ${p.leads}`);

  const ctr = ctrOf(m);
  if (ctr != null && ctr < 0.8) { cons.push(`низький CTR: ${ctr.toFixed(2)}% — креативи слабко зупиняють`); tips.push("Зробити 2–3 нові креативи з сильнішим першим кадром/заголовком: ціна, вигода, обличчя, контраст"); }
  if (ctr != null && ctr >= 1.5) pros.push(`хороший CTR: ${ctr.toFixed(2)}% — креативи чіпляють`);

  const freq = total ? freqOf(total.impressions, total.reach) : null;
  if (freq != null && freq > 3) { cons.push(`висока частота: ${freq.toFixed(1)} показу на людину за 30 днів`); tips.push("Аудиторія вигорає — оновити креативи або розширити аудиторію"); }
  else if (freq != null) pros.push(`частота в нормі: ${freq.toFixed(1)}`);

  // Креативи
  const ads = adsForClient(clientId);
  const withLeads = ads.filter((a) => a.leads_30d >= 3);
  if (withLeads.length >= 2) {
    const s = [...withLeads].sort((a, b) => a.spend_30d / a.leads_30d - b.spend_30d / b.leads_30d);
    const best = s[0], worst = s.at(-1)!;
    pros.push(`найкращий креатив «${best.name}»: ліди по ${money(best.spend_30d / best.leads_30d)}`);
    if (cm && worst.spend_30d / worst.leads_30d > cm * 1.4) {
      cons.push(`«${worst.name}» дає ліди по ${money(worst.spend_30d / worst.leads_30d)} — дорожче за середні ${money(cm)}`);
      tips.push(`Перекинути бюджет з «${worst.name}» на «${best.name}» або зробити схожі на «${best.name}»`);
    }
  }
  const burners = ads.filter((a) => !a.leads_30d && cm && a.spend_30d > cm * 2);
  if (burners.length) { cons.push(`${burners.length} креатив(и) витратили ${money(burners.reduce((s, a) => s + a.spend_30d, 0))} без лідів`); tips.push("Вимкнути креативи без лідів: " + burners.slice(0, 3).map((a) => `«${a.name}»`).join(", ")); }
  if (ads.length && ads.length < 3) tips.push("Мало креативів у ротації — додати ще 2–3, щоб алгоритму було з чого вибирати");

  // Розрізи
  const bw = (kind: string, what: string) => {
    const r = bestWorst(breakdowns(clientId, kind), m.spend);
    if (!r) return;
    const cb = r.best.spend / r.best.leads, cwst = r.worst.spend / r.worst.leads;
    if (cwst > cb * 1.5) tips.push(`${what}: «${label(kind, r.best.key)}» дає ліди по ${money(cb)}, а «${label(kind, r.worst.key)}» — по ${money(cwst)}. Варто зсунути бюджет`);
  };
  bw("placement", "Плейсменти");
  bw("age_gender", "Аудиторія");
  bw("region", "Регіони");
  bw("device", "Пристрої");

  // Бюджет
  const camps = campaignsWithStats(clientId, kyivDay(6));
  const active = camps.filter((c) => c.status === "ACTIVE");
  if (!active.length) cons.push("нема активних кампаній");
  const daily = active.reduce((s, c) => s + (c.daily_budget ?? 0), 0);
  if (daily > 0 && w.spend / 7 < daily * 0.7) tips.push(`Кампанії недовитрачають бюджет: у середньому ${money(w.spend / 7)} на день із ${money(daily)} — можливо, вузька аудиторія або низька ставка`);
  const adsets = adsetsForClient(clientId).filter((a) => a.status === "ACTIVE");
  if (adsets.length > 6 && m.spend / adsets.length < (cm ?? 0) * 10) tips.push("Забагато груп оголошень на такий бюджет — кожна вчиться повільно. Обʼєднати в 2–3");
  return { pros, cons, tips };
}

