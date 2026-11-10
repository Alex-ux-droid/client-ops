// Діагностика реклами «чому нема лідів»: факти по кроках воронки (без ШІ) → розбір моделлю → «де дірка» + 3 дії.
// Кроки: 1 крутиться (покази, CPM, відхилені) → 2 чіпляє (CTR, ціна кліку) → 3 конвертує (клік → лід) → 4 навчання/зміни → 5 витоки (оголошення і плейсменти без лідів) → 6 після лідів (CRM).
import { db } from "./db";
import { askJson } from "./llmJson";
import { logError } from "./log";
import { getSetting, setSetting } from "./repo/settings";
import { accountsForClient, adExtra, adsForClient, adsetExtra, adsetsForClient, badAdsForClient, breakdowns, kyivDay, totals, type Totals } from "./repo/meta";
import { listChanges } from "./repo/creatives";
import { sitePulseText } from "./sitePulse";

export type DiagStage = { key: string; title: string; status: "ok" | "warn" | "bad" | "na"; finding: string };
export type DiagAction = { title: string; why: string; how: string; stage?: "holes" | "red" | "yellow" | "green" };
export type Diag = { at: string; leak: string; verdict: string; stages: DiagStage[]; actions: DiagAction[]; facts: string };

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (a: number, b: number) => (b ? r1((a / b) * 100) : 0);
const cpl = (t: Totals) => (t.leads ? r2(t.spend / t.leads) : null);
const ctr = (t: Totals) => (t.impressions ? r2((t.clicks / t.impressions) * 100) : 0);
const cpm = (t: Totals) => (t.impressions ? r2((t.spend / t.impressions) * 1000) : 0);
const conv = (t: Totals) => (t.clicks ? r1((t.leads / t.clicks) * 100) : 0);

type AdRow = { ad_id: string; spend: number; impressions: number; clicks: number; leads: number; first: string };
function adWindow(acc: string[], since: string, until: string): Map<string, AdRow> {
  if (!acc.length) return new Map();
  const rows = db().prepare(`SELECT ad_id, SUM(spend) spend, SUM(impressions) impressions, SUM(clicks) clicks, SUM(leads) leads, MIN(CASE WHEN spend > 0 THEN date END) first
    FROM meta_ad_daily WHERE account_id IN (${acc.map(() => "?").join(",")}) AND date BETWEEN ? AND ? GROUP BY ad_id`).all(...acc, since, until) as AdRow[];
  return new Map(rows.map((r) => [r.ad_id, r]));
}
const firstSeen = (acc: string[]) => {
  if (!acc.length) return new Map<string, string>();
  const rows = db().prepare(`SELECT ad_id, MIN(date) d FROM meta_ad_daily WHERE account_id IN (${acc.map(() => "?").join(",")}) AND spend > 0 GROUP BY ad_id`).all(...acc) as { ad_id: string; d: string }[];
  return new Map(rows.map((r) => [r.ad_id, r.d]));
};

// Факти + попередні оцінки правилами. Без ШІ, дешево — можна показувати завжди.
export function diagFacts(clientId: number): { text: string; stages: DiagStage[]; hasData: boolean } {
  const accs = accountsForClient(clientId);
  if (!accs.length) return { text: "", stages: [], hasData: false };
  const acc = accs.map((a) => a.account_id);
  const cur = accs[0].currency || "";
  const m = (v: number | null) => (v == null ? "—" : `${r2(v)} ${cur}`);
  const w = totals(clientId, kyivDay(6), kyivDay(0)), p = totals(clientId, kyivDay(13), kyivDay(7)), y = totals(clientId, kyivDay(1), kyivDay(1)), td = totals(clientId, kyivDay(0), kyivDay(0));
  const out: string[] = [];
  const stages: DiagStage[] = [];
  const line = (t: Totals) => `витрати ${m(t.spend)}, покази ${t.impressions}, кліки ${t.clicks}, ліди ${t.leads}, CTR ${ctr(t)}%, CPM ${m(cpm(t))}, ціна кліку ${m(t.clicks ? t.spend / t.clicks : null)}, клік→лід ${conv(t)}%, ціна ліда ${m(cpl(t))}`;
  out.push(`ПЕРІОДИ:\n- останні 7 днів: ${line(w)}\n- попередні 7 днів: ${line(p)}\n- вчора: ${line(y)}\n- сьогодні (неповний день): ${line(td)}`);

  // 1. Крутиться?
  const bad = badAdsForClient(clientId);
  const cpmUp = p.impressions && cpm(w) > cpm(p) * 1.4;
  stages.push({ key: "delivery", title: "Крутиться", status: !w.spend ? "bad" : bad.length || cpmUp ? "warn" : "ok",
    finding: !w.spend ? "За 7 днів витрат нема — реклама не крутиться" : [bad.length && `з проблемами/відхилено: ${bad.length}`, cpmUp && `CPM виріс ${m(cpm(p))} → ${m(cpm(w))}`].filter(Boolean).join("; ") || `CPM ${m(cpm(w))}, показів ${w.impressions}` });
  if (bad.length) out.push(`ОГОЛОШЕННЯ З ПРОБЛЕМАМИ (Meta): ${bad.map((b) => `«${b.name}» — ${b.status}${b.why ? `: ${b.why}` : ""}`).join("; ")}`);

  // 2. Чіпляє?
  const c = ctr(w), cp = ctr(p);
  stages.push({ key: "attention", title: "Чіпляє (CTR)", status: !w.impressions ? "na" : c < 0.8 ? "bad" : c < 1.2 || (cp && c < cp * 0.75) ? "warn" : "ok",
    finding: !w.impressions ? "нема показів" : `CTR ${c}%${cp ? ` (було ${cp}%)` : ""}, ціна кліку ${m(w.clicks ? w.spend / w.clicks : null)}` });

  // 3. Конвертує? (клік → лід; для лід-форм орієнтир 8–20%, для сайту 2–6%)
  const cv = conv(w), cvp = conv(p);
  stages.push({ key: "conversion", title: "Клік → заявка", status: !w.clicks ? "na" : w.clicks >= 20 && w.leads === 0 ? "bad" : cv < 4 || (cvp && cv < cvp * 0.6) ? "warn" : "ok",
    finding: !w.clicks ? "кліків нема" : `${w.clicks} кліків → ${w.leads} лідів (${cv}%${cvp ? `, було ${cvp}%` : ""})` });

  // Оголошення: 7 днів проти попередніх, нові креативи
  const ads = adsForClient(clientId);
  const now = adWindow(acc, kyivDay(6), kyivDay(0)), prev = adWindow(acc, kyivDay(13), kyivDay(7)), first = firstSeen(acc);
  const avgCpl = cpl(w) ?? cpl(p) ?? (w.spend / Math.max(1, w.clicks)) * 10;
  const rows = ads.map((a) => ({ a, n: now.get(a.ad_id), pv: prev.get(a.ad_id), first: first.get(a.ad_id) ?? "" })).filter((x) => (x.n?.spend ?? 0) > 0 || (x.pv?.spend ?? 0) > 0)
    .sort((x, y2) => (y2.n?.spend ?? 0) - (x.n?.spend ?? 0)).slice(0, 15);
  if (rows.length) out.push(`ОГОЛОШЕННЯ (7 днів | попередні 7 | перший день витрат):\n${rows.map(({ a, n, pv, first: f }) => {
    const t = (x?: AdRow) => (x ? `${m(x.spend)}, ${x.leads} лід., CTR ${x.impressions ? r2((x.clicks / x.impressions) * 100) : 0}%, клік→лід ${x.clicks ? r1((x.leads / x.clicks) * 100) : 0}%` : "—");
    const ex = adExtra(a);
    return `- «${a.name}» [${a.status}] ${t(n)} | ${t(pv)} | з ${f || "?"}${f >= kyivDay(10) ? " (НОВЕ)" : ""}${ex.issues ? ` ⚠ ${ex.issues}` : ""}`;
  }).join("\n")}`);
  const sinks = rows.filter(({ n }) => n && n.leads === 0 && n.spend >= Math.max(avgCpl * 1.5, w.spend * 0.1));
  const fresh = rows.filter(({ first: f }) => f && f >= kyivDay(10));

  // 4. Навчання і зміни
  const learn = adsetsForClient(clientId).filter((s) => s.status === "ACTIVE").map((s) => ({ s, l: adsetExtra(s).learning ?? "" })).filter((x) => x.l);
  const changes = listChanges(clientId, 30).filter((x) => x.at >= kyivDay(21));
  const learning = learn.filter((x) => /learn|навч/i.test(x.l));
  stages.push({ key: "learning", title: "Навчання і зміни", status: learning.length || fresh.length ? "warn" : "ok",
    finding: [learning.length && `у навчанні груп: ${learning.length}`, fresh.length && `нових оголошень за 10 днів: ${fresh.length} (перші 3–5 днів дорожчі)`, changes.length && `змін у журналі за 3 тижні: ${changes.length}`].filter(Boolean).join("; ") || "стабільно, без свіжих змін" });
  if (learn.length) out.push(`ГРУПИ (фаза навчання): ${learn.map((x) => `«${x.s.name}» — ${x.l}`).join("; ")}`);
  if (changes.length) out.push(`ЖУРНАЛ ЗМІН (21 день):\n${changes.map((x) => `- ${x.at}: ${x.what}${x.result ? ` → ${x.result}` : ""}`).join("\n")}`);
  else out.push("ЖУРНАЛ ЗМІН: порожній (не знаємо, що і коли міняли — порівнюй періоди і дати першого показу оголошень)");

  // 5. Витоки: оголошення і плейсменти, де гроші без лідів
  const pl = breakdowns(clientId, "placement").filter((x) => x.spend > 0);
  const plSpend = pl.reduce((a, x) => a + x.spend, 0), plLeads = pl.reduce((a, x) => a + x.leads, 0);
  const leaks = pl.filter((x) => plSpend && x.spend / plSpend >= 0.12 && pct(x.leads, plLeads || 1) < pct(x.spend, plSpend) / 2);
  stages.push({ key: "leaks", title: "Куди йдуть гроші без лідів", status: sinks.length || leaks.length ? (sinks.length >= 2 ? "bad" : "warn") : "ok",
    finding: [sinks.length && `оголошень з витратами без лідів: ${sinks.length} (${sinks.map(({ a, n }) => `«${a.name}» ${m(n!.spend)}`).join(", ")})`, leaks.length && `слабкі плейсменти: ${leaks.map((x) => `${x.key} ${pct(x.spend, plSpend)}% бюджету / ${pct(x.leads, plLeads || 1)}% лідів`).join(", ")}`].filter(Boolean).join("; ") || "явних витоків нема" });
  if (pl.length) out.push(`ПЛЕЙСМЕНТИ (30 днів, частка бюджету / частка лідів): ${pl.sort((a, b) => b.spend - a.spend).slice(0, 8).map((x) => `${x.key} ${pct(x.spend, plSpend)}%/${pct(x.leads, plLeads || 1)}%`).join("; ")}`);
  const tot = breakdowns(clientId, "total")[0];
  if (tot?.reach) out.push(`ЧАСТОТА 30 днів: ${r1(tot.impressions / tot.reach)} (понад 3 — аудиторія втомилась)`);

  // 6. Після ліда: заявки з форм і CRM
  const formLeads = (db().prepare("SELECT COUNT(*) n FROM leads WHERE client_id = ? AND created_time >= ?").get(clientId, new Date(Date.now() - 7 * 86400_000).toISOString()) as { n: number }).n;
  out.push(`ЗАЯВКИ З ЛІД-ФОРМ (наша база, 7 днів): ${formLeads}${formLeads !== w.leads ? ` (Meta рахує ${w.leads})` : ""}`);
  try {
    const crm = db().prepare("SELECT COUNT(*) n, SUM(CASE WHEN won_at IS NOT NULL THEN 1 ELSE 0 END) won FROM crm_leads WHERE client_id = ? AND created_at >= ?").get(clientId, kyivDay(13)) as { n: number; won: number | null };
    if (crm.n) out.push(`CRM (14 днів): лідів ${crm.n}, продажів ${crm.won ?? 0}`);
  } catch { /* CRM не підключена */ }
  try {
    const sp = db().prepare("SELECT id FROM products WHERE client_id = ? AND service_type = 'website' LIMIT 1").get(clientId) as { id: number } | undefined;
    if (sp) {
      const t = sitePulseText(sp.id, 7);
      if (t) out.push(`САЙТ (пульс):\n${t}`);
    }
  } catch { /* пульс не підключено */ }
  return { text: out.join("\n\n"), stages, hasData: w.spend > 0 || p.spend > 0 };
}

const KEY = (id: number) => `meta.diag.${id}`;
export function getDiag(clientId: number): Diag | null {
  try { const v = getSetting(KEY(clientId)); return v ? (JSON.parse(v) as Diag) : null; } catch { return null; }
}

export async function runDiagnosis(clientId: number): Promise<{ ok: true; diag: Diag } | { ok: false; error: string }> {
  const f = diagFacts(clientId);
  if (!f.hasData) return { ok: false, error: "За 14 днів нема витрат у привʼязаних кабінетах — нема що розбирати" };
  const system = `Ти — сильний медіабаєр Meta Ads (лідогенерація, Україна). Розбери рекламу клієнта СТРОГО по фактах нижче, як лікар: знайди, на якому кроці воронки губляться люди і гроші. Кроки: 1) крутиться (покази, CPM, відхилені/проблеми — «невдала перевірка конфіденційності» = лід-форма без робочого посилання на політику конфіденційності, Meta ріже показ); 2) чіпляє (CTR, ціна кліку — це креатив і перші секунди); 3) клік → заявка (форма/сайт: питань забагато, незрозумілий оффер, сайт повільний; для лід-форм орієнтир 8–20%, сайт 2–6%); 4) навчання і зміни (нові оголошення перші 3–5 днів дорожчі, правки перезапускають навчання); 5) витоки (оголошення з витратами без лідів, плейсменти, частота > 3); 6) що після заявки (CRM, якість).
Правила: кожен висновок — з цифрою з фактів; не вигадуй даних, яких нема (скажи «даних нема»); «сьогодні» — неповний день, мало показів = шум, висновки роби з 7 днів; без загальних порад типу «тестуйте креативи» — тільки конкретне: яке оголошення, що зробити, на скільки. Якщо даних замало для висновку — так і скажи.
Поверни ТІЛЬКИ JSON:
{"leak": "де головна дірка — одне речення з цифрою", "verdict": "2–3 речення: що відбувається і чому", "stages": [{"key": "delivery|attention|conversion|learning|leaks|after", "status": "ok|warn|bad|na", "finding": "1 речення з цифрою"}], "actions": [{"title": "дія (дієслово, конкретно)", "why": "чому — з цифрою", "how": "як саме зробити в Ads Manager / на сайті / у формі", "stage": "holes|red|yellow|green"}]}
actions — рівно 3, від найважливішої. stage: holes — щось зламано (відхилено, форма не працює, гроші без результату), red — критичне, yellow — важливе, green — підкрутити.`;
  try {
    const r = await askJson<Omit<Diag, "at" | "facts">>(system, `ФАКТИ:\n${f.text}\n\nОЦІНКА ПРАВИЛАМИ (попередня):\n${f.stages.map((s) => `- ${s.title}: ${s.status} — ${s.finding}`).join("\n")}`, { maxTokens: 6000, effort: "medium" });
    const titles = Object.fromEntries(f.stages.map((s) => [s.key, s.title]));
    const diag: Diag = {
      at: new Date().toISOString(),
      leak: String(r.leak ?? "").slice(0, 400), verdict: String(r.verdict ?? "").slice(0, 1200),
      stages: (Array.isArray(r.stages) ? r.stages : []).slice(0, 8).map((s) => ({ key: String(s.key), title: titles[String(s.key)] ?? (s.key === "after" ? "Після заявки" : String(s.key)), status: (["ok", "warn", "bad", "na"].includes(String(s.status)) ? s.status : "na") as DiagStage["status"], finding: String(s.finding ?? "").slice(0, 400) })),
      actions: (Array.isArray(r.actions) ? r.actions : []).slice(0, 3).map((a) => ({ title: String(a.title ?? "").slice(0, 200), why: String(a.why ?? "").slice(0, 400), how: String(a.how ?? "").slice(0, 600), stage: (["holes", "red", "yellow", "green"].includes(String(a.stage)) ? a.stage : "red") as DiagAction["stage"] })).filter((a) => a.title),
      facts: f.text.slice(0, 12000),
    };
    if (!diag.stages.length) diag.stages = f.stages;
    setSetting(KEY(clientId), JSON.stringify(diag));
    return { ok: true, diag };
  } catch (e) {
    logError("meta-diagnose", e);
    const { llmErrorText } = await import("./llmJson");
    return { ok: false, error: llmErrorText(e) };
  }
}

export function diagText(d: Diag): string {
  return `Діагностика реклами (${d.at.slice(0, 16).replace("T", " ")} UTC): ${d.leak}\n${d.verdict}\nКроки: ${d.stages.map((s) => `${s.title} — ${s.status}: ${s.finding}`).join("; ")}\nДії: ${d.actions.map((a, i) => `${i + 1}) ${a.title} — ${a.why}`).join(" ")}`;
}
