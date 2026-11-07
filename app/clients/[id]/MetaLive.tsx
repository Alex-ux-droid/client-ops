import Link from "next/link";
import DataTable from "@/components/DataTable";
import Pop from "@/components/Pop";
import Icon from "@/components/Icon";
import ListPop from "@/components/ListPop";
import { BrandDot } from "@/components/Brand";
import { analyzeMetaAction } from "@/app/actions";
import AskAssistant from "@/components/AskAssistant";
import { ComboChart } from "@/components/Charts";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate } from "@/lib/dates";
import { cplOf, creativeVerdict, ctrOf, freqOf, label, metaInsights, type Tone } from "@/lib/metaInsights";
import {
  accountsForClient, ACCOUNT_STATUS, adsetsForClient, adsForClient, breakdowns, campaignsWithStats, dailySeries, getAnalysis, kyivDay, totals,
  type Breakdown, type MetaAd, type MetaAdset,
} from "@/lib/repo/meta";
import CreativeGallery, { type GalleryItem } from "./CreativeGallery";
import { CopyText } from "@/app/startups/[id]/CopyText";
import { changeAction, reportLinkAction } from "@/app/creatives/actions";
import { reportToken } from "@/lib/clientReport";
import { headers } from "next/headers";
import { listChanges } from "@/lib/repo/creatives";
import { adMore } from "@/lib/metaExtra";
import { adsetExtra, badAdsForClient, monthlyForClient } from "@/lib/repo/meta";
import { leadBotDisconnectAction, leadBotInviteAction, leadBotUserAction, leadRouteAction, rateLeadAction } from "@/app/leads/actions";
import { botUsers, clientLeads, getRoute, leadFields, leadStats, listPages } from "@/lib/repo/leads";
import { chatsForClient } from "@/lib/repo/telegram";
import { inviteLink, leadBotToken } from "@/lib/leadBot";
import { CopyInvite, LeadBotConnect, TestLead } from "./LeadBotConnect";

export const STATUS: Record<string, string> = { ACTIVE: "активна", PAUSED: "пауза", CAMPAIGN_PAUSED: "пауза", ADSET_PAUSED: "пауза", ARCHIVED: "архів", DELETED: "видалена", IN_PROCESS: "обробка", WITH_ISSUES: "проблема", DISAPPROVED: "відхилено", PENDING_REVIEW: "перевірка" };
const fmtN = (n: number) => Math.round(n).toLocaleString("uk-UA");
const pct = (n: number | null, d = 2) => (n == null ? "—" : `${n.toFixed(d)}%`);
const VIEWS = [
  { k: "overview", label: "Огляд" },
  { k: "tree", label: "Структура" },
  { k: "creatives", label: "Креативи" },
  { k: "audience", label: "Аудиторія" },
  { k: "leads", label: "Заявки" },
  { k: "analysis", label: "Висновки" },
] as const;
const COLORS = ["#3d6bff", "#22c3a6", "#f5b43c", "#e86ad6", "#8f7bff", "#4fb3ff", "#ff7a59", "#9bd35a"];

function Delta({ now, before, lowerIsBetter = false }: { now: number | null; before: number | null; lowerIsBetter?: boolean }) {
  if (now == null || before == null || before === 0) return null;
  const d = ((now - before) / before) * 100;
  if (Math.abs(d) < 3) return <span className="meta-delta">≈</span>;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return <span className={`meta-delta ${good ? "good" : "bad"}`}>{d > 0 ? "↑" : "↓"} {Math.abs(d).toFixed(0)}%</span>;
}

// Живі цифри з Meta, розбиті на підвкладки (?mv=)
export default function MetaLive({ clientId, view = "overview", err }: { clientId: number; view?: string; err?: string }) {
  const accs = accountsForClient(clientId);
  if (!accs.length) return null;
  const cur = accs[0].currency || "";
  const m = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("uk-UA", { maximumFractionDigits: n < 100 ? 2 : 0 })} ${cur}`);
  const v = VIEWS.find((x) => x.k === view)?.k ?? "overview";
  const synced = accs.map((a) => a.last_sync_at).filter(Boolean).sort().at(-1);
  const problems = accs.filter((a) => (a.account_status && a.account_status !== 1) || a.last_error);
  const base = `/clients/${clientId}?tab=meta_ads`;

  return (
    <section className="stack" style={{ gap: "1rem" }}>
      <div className="meta-head">
        <div>
          <div className="mono" style={{ color: "var(--dim)" }}><BrandDot text="Meta" size={13} />{" "}
            {accs.map((a) => a.name).join(", ")}
            {synced ? ` · оновлено ${new Date(synced.replace(" ", "T") + "Z").toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : " · ще не оновлювалось"}
          </div>
        </div>
        <AskAssistant text="Подивись рекламу цього клієнта: що працює, що зливає бюджет, який креатив найкращий і що б ти змінив.">Джері, як реклама?</AskAssistant>
      </div>
      {problems.length > 0 && (
        <div className="mx-warn">
          <Icon name="alert" size={15} />
          {problems.map((a) => <span key={a.account_id}><b>{a.name}:</b> {a.account_status && a.account_status !== 1 ? ACCOUNT_STATUS[a.account_status] ?? "проблема з кабінетом" : ""}{a.last_error ? ` ${a.last_error}` : ""}</span>)}
        </div>
      )}
      <ReportLink clientId={clientId} />
      <nav className="mx-tabs">
        {VIEWS.map((x) => (
          <Link key={x.k} href={x.k === "overview" ? base : `${base}&mv=${x.k}`} scroll={false} className={x.k === v ? "on" : ""}>{x.label}</Link>
        ))}
      </nav>
      {v === "overview" && <Overview clientId={clientId} m={m} base={base} />}
      {v === "tree" && <Tree clientId={clientId} m={m} />}
      {v === "creatives" && <Creatives clientId={clientId} m={m} />}
      {v === "audience" && <Audience clientId={clientId} m={m} />}
      {v === "leads" && <Leads clientId={clientId} m={m} />}
      {v === "analysis" && <Analysis clientId={clientId} m={m} err={err} />}
    </section>
  );
}

type Fmt = (n: number | null) => string;

// ---------- Огляд: тиждень проти тижня, місяць у блоках, графік, кампанії, головне
function Overview({ clientId, m, base }: { clientId: number; m: Fmt; base: string }) {
  const w = totals(clientId, kyivDay(6), kyivDay(0));
  const p = totals(clientId, kyivDay(13), kyivDay(7));
  const mo = totals(clientId, kyivDay(29), kyivDay(0));
  const t = breakdowns(clientId, "total")[0];
  const series = dailySeries(clientId, kyivDay(29));
  const camps = campaignsWithStats(clientId, kyivDay(29)).filter((c) => c.spend > 0 || c.status === "ACTIVE");
  const ins = metaInsights(clientId, m);
  const months = monthlyForClient(clientId);
  const bad = badAdsForClient(clientId);
  const top = [...bad.slice(0, 3).map((x) => ({ t: "bad" as Tone, x: `Оголошення «${x.name}» — ${x.status}${x.why ? `: ${x.why}` : ""}` })), ...ins.cons.map((x) => ({ t: "bad" as Tone, x })), ...ins.tips.map((x) => ({ t: "" as Tone, x })), ...ins.pros.map((x) => ({ t: "good" as Tone, x }))];
  const active = camps.filter((c) => c.status === "ACTIVE");
  const purch = months.some((x) => x.purchases);
  const lastM = months.at(-1), prevM = months.at(-2);

  return (
    <>
      <div className="mono">Останні 7 днів проти попередніх 7</div>
      <div className="kpis meta-kpis">
        <div className="kpi"><div className="n">{m(w.spend)}</div><div className="l">Витрачено <Delta now={w.spend} before={p.spend} /></div></div>
        <div className="kpi"><div className="n">{fmtN(w.leads)}</div><div className="l">Лідів <Delta now={w.leads} before={p.leads} /></div></div>
        <div className="kpi"><div className="n">{m(cplOf(w))}</div><div className="l">Ціна ліда <Delta now={cplOf(w)} before={cplOf(p)} lowerIsBetter /></div></div>
        <div className="kpi"><div className="n">{pct(ctrOf(w))}</div><div className="l">CTR <Delta now={ctrOf(w)} before={ctrOf(p)} /></div></div>
      </div>

      {/* 30 днів — одна компактна смужка */}
      <div className="mx-strip">
        <span className="mx-strip-h">30 днів</span>
        <div><b>{fmtN(mo.leads)}</b><span>лідів</span></div>
        <div><b>{m(mo.spend)}</b><span>витрачено</span></div>
        <div><b>{m(cplOf(mo))}</b><span>ціна ліда</span></div>
        <div><b>{pct(ctrOf(mo))}</b><span>CTR</span></div>
        <div><b>{m(mo.clicks ? mo.spend / mo.clicks : null)}</b><span>ціна кліку</span></div>
        <div><b>{m(mo.impressions ? (mo.spend / mo.impressions) * 1000 : null)}</b><span>CPM</span></div>
        <div><b>{t?.reach ? fmtN(t.reach) : "—"}</b><span>охоплення</span></div>
        <div><b>{t ? (freqOf(t.impressions, t.reach)?.toFixed(1) ?? "—") : "—"}</b><span>частота</span></div>
      </div>

      {top.length > 0 && (
        <Pop className="pop-card mx-main" title="Головне по рекламі" trigger={
          <>
            <span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="sparkles" /></span><b>Головне</b></span><span className="qt-n">{top.length}</span></span>
            <ul>{top.slice(0, 3).map((x) => <li key={x.x} className={x.t}>{x.x}</li>)}</ul>
            {top.length > 3 && <span className="qt-more">ще {top.length - 3} →</span>}
          </>
        }>
          <ul className="mx-main-ul">{top.map((x) => <li key={x.x} className={x.t}>{x.x}</li>)}</ul>
          <Link href={`${base}&mv=analysis`} className="btn ghost small" style={{ marginTop: "0.75rem" }}>Усі висновки і розбір Джері →</Link>
        </Pop>
      )}

      {series.length > 1 && (
        <div className="card">
          <ComboChart barName="Витрати" lineName="Ліди" fmtBar={(n) => fmtN(n)} fmtLine={(n) => fmtN(n)}
            data={series.map((d) => ({ label: d.date.slice(8, 10), bar: d.spend, line: d.leads, tip: `${fmtDate(d.date)}: ${m(d.spend)}, лідів ${d.leads}${d.leads ? `, ціна ${m(cplOf(d))}` : ""}` }))} />
        </div>
      )}

      <div className="qt-grid">
        {camps.length > 0 && (
          <Pop className="pop-card qt" wide title={`Кампанії · ${camps.length}`} trigger={
            <>
              <span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="megaphone" /></span><b>Кампанії</b></span><span className="qt-n">{active.length} акт. / {camps.length}</span></span>
              {camps.slice(0, 2).map((c) => <span key={c.campaign_id} className="qt-l">{c.name} · {m(c.spend)} · {fmtN(c.leads)} лід.</span>)}
              {camps.length > 2 && <span className="qt-more">ще {camps.length - 2} →</span>}
            </>
          }>
            <DataTable id="meta-campaigns" cols={[
              { id: "name", label: "Кампанія", w: 280, pin: true }, { id: "status", label: "Статус", w: 120 }, { id: "budget", label: "Бюджет", num: true, w: 140 },
              { id: "spend", label: "Витрати 30 дн.", num: true }, { id: "leads", label: "Ліди", num: true, w: 90 }, { id: "cpl", label: "Ціна ліда", num: true },
            ]} rows={camps.map((c) => ({ key: c.campaign_id, cells: {
              name: c.name,
              status: { v: STATUS[c.status] ?? c.status.toLowerCase(), tag: c.status === "ACTIVE" ? "ok" : "" },
              budget: { v: c.daily_budget ?? c.lifetime_budget ?? null, t: c.daily_budget ? `${m(c.daily_budget)}/день` : c.lifetime_budget ? `${m(c.lifetime_budget)} всього` : "—" },
              spend: { v: c.spend, t: m(c.spend) }, leads: { v: c.leads, t: fmtN(c.leads) }, cpl: { v: cplOf(c), t: m(cplOf(c)) },
            } }))} />
          </Pop>
        )}
        {months.length > 1 && (
          <Pop className="pop-card qt" wide title="По місяцях (до 12) — сезонність і динаміка" trigger={
            <>
              <span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="clock" /></span><b>По місяцях</b></span><span className="qt-n">{months.length}</span></span>
              {lastM && <span className="qt-l">{lastM.month}: {m(cplOf(lastM))} за лід{prevM && cplOf(prevM) ? ` (було ${m(cplOf(prevM))})` : ""}</span>}
              <span className="mx-spark">{months.slice(-12).map((x) => { const mx = Math.max(...months.map((y) => y.leads), 1); return <i key={x.month} title={`${x.month}: ${x.leads} лідів`} style={{ height: `${Math.max(8, (x.leads / mx) * 100)}%` }} />; })}</span>
            </>
          }>
            <DataTable id="meta-months" cols={[
              { id: "month", label: "Місяць", w: 110, pin: true }, { id: "spend", label: "Витрати", num: true }, { id: "leads", label: "Ліди", num: true, w: 90 },
              { id: "cpl", label: "Ціна ліда", num: true }, { id: "ctr", label: "CTR", num: true, w: 90 },
              ...(purch ? [{ id: "purch", label: "Покупки", num: true, w: 100 }, { id: "roas", label: "ROAS", num: true, w: 90 }] : []),
            ]} rows={[...months].reverse().map((x) => ({ key: x.month, cells: {
              month: x.month, spend: { v: x.spend, t: m(x.spend) }, leads: { v: x.leads, t: fmtN(x.leads) }, cpl: { v: cplOf(x), t: m(cplOf(x)) },
              ctr: { v: ctrOf(x), t: pct(ctrOf(x)) }, purch: { v: x.purchases, t: fmtN(x.purchases) }, roas: { v: x.spend ? x.revenue / x.spend : null, t: x.spend ? (x.revenue / x.spend).toFixed(2) : "—" },
            } }))} />
          </Pop>
        )}
        {bad.length > 0 && <ListPop title="Відхилені / з проблемою" ico="alert" tone="bad" items={bad.map((x) => `${x.name} — ${x.status}${x.why ? `: ${x.why}` : ""}`)} />}
      </div>
    </>
  );
}

// ---------- Структура: кампанія → група оголошень → креатив, куди йдуть гроші
function Share({ part, total, color }: { part: number; total: number; color?: string }) {
  const w = total ? Math.max(1, (part / total) * 100) : 0;
  return <span className="mx-share"><i style={{ width: `${w}%`, background: color }} /><em>{total ? Math.round((part / total) * 100) : 0}%</em></span>;
}

function Tree({ clientId, m }: { clientId: number; m: Fmt }) {
  const camps = campaignsWithStats(clientId, kyivDay(29)).filter((c) => c.spend > 0 || c.status === "ACTIVE");
  const adsets = adsetsForClient(clientId);
  const ads = adsForClient(clientId);
  const total = camps.reduce((s, c) => s + c.spend, 0);
  if (!camps.length) return <p style={{ color: "var(--muted)" }}>За 30 днів кампаній з витратами нема.</p>;
  const color = (i: number) => COLORS[i % COLORS.length];

  const AdRow = ({ a }: { a: MetaAd }) => (
    <div className="mx-leaf">
      {a.image_url || a.thumbnail_url ? <img src={a.image_url || a.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="mx-leaf-ph" />}
      <span className="mx-name">{a.name || "Оголошення"}</span>
      <Share part={a.spend_30d} total={total} />
      <span className="mx-num">{m(a.spend_30d)}</span>
      <span className="mx-num">{a.leads_30d} лід.</span>
      <span className="mx-num">{m(cplOf({ spend: a.spend_30d, leads: a.leads_30d }))}</span>
    </div>
  );

  return (
    <>
      <div className="card">
        <div className="mono" style={{ marginBottom: "0.625rem" }}>Куди пішли гроші за 30 днів · {m(total)}</div>
        <div className="mx-stack">
          {camps.filter((c) => c.spend > 0).map((c, i) => <i key={c.campaign_id} title={`${c.name}: ${m(c.spend)}`} style={{ width: `${(c.spend / total) * 100}%`, background: color(i) }} />)}
        </div>
        <div className="mx-legend">
          {camps.filter((c) => c.spend > 0).map((c, i) => <span key={c.campaign_id}><i style={{ background: color(i) }} />{c.name} · {Math.round((c.spend / total) * 100)}%</span>)}
        </div>
      </div>

      <div className="mx-tree">
        {camps.map((c, i) => {
          const sets = adsets.filter((s) => s.campaign_id === c.campaign_id);
          const loose = ads.filter((a) => a.campaign_id === c.campaign_id && !sets.some((s) => s.adset_id === a.adset_id));
          return (
            <details key={c.campaign_id} className="mx-node" open={i === 0}>
              <summary>
                <span className="mx-dot" style={{ background: color(i) }} />
                <span className="mx-name"><b>{c.name}</b><small>{STATUS[c.status] ?? c.status.toLowerCase()}{c.daily_budget ? ` · ${m(c.daily_budget)}/день` : ""}</small></span>
                <Share part={c.spend} total={total} color={color(i)} />
                <span className="mx-num">{m(c.spend)}</span>
                <span className="mx-num">{fmtN(c.leads)} лід.</span>
                <span className="mx-num">{m(cplOf(c))}</span>
              </summary>
              <div className="mx-children">
                {sets.filter((s: MetaAdset) => s.spend_30d > 0 || s.status === "ACTIVE").map((s) => (
                  <details key={s.adset_id} className="mx-node" open>
                    <summary>
                      <span className="mx-name"><b>{s.name}</b><small>група · {STATUS[s.status] ?? s.status.toLowerCase()}{s.daily_budget ? ` · ${m(s.daily_budget)}/день` : ""}{s.reach_30d ? ` · частота ${freqOf(s.impressions_30d, s.reach_30d)?.toFixed(1)}` : ""}{adsetExtra(s).learning ? ` · ${adsetExtra(s).learning}` : ""}</small>{adsetExtra(s).targeting && <small>кому: {adsetExtra(s).targeting}</small>}</span>
                      <Share part={s.spend_30d} total={total} color={color(i)} />
                      <span className="mx-num">{m(s.spend_30d)}</span>
                      <span className="mx-num">{s.leads_30d} лід.</span>
                      <span className="mx-num">{m(cplOf({ spend: s.spend_30d, leads: s.leads_30d }))}</span>
                    </summary>
                    <div className="mx-children">
                      {ads.filter((a) => a.adset_id === s.adset_id).map((a) => <AdRow key={a.ad_id} a={a} />)}
                    </div>
                  </details>
                ))}
                {loose.map((a) => <AdRow key={a.ad_id} a={a} />)}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}

// Відео, покупки, вигорання — тільки якщо є
function moreStats(a: MetaAd, m: Fmt): { l: string; v: string }[] {
  const o = adMore(a), out: { l: string; v: string }[] = [];
  if (o.hook_rate_pct != null) out.push({ l: "хук (3 с)", v: `${o.hook_rate_pct}%` });
  if (o.hold_rate_pct != null) out.push({ l: "дивляться далі", v: `${o.hold_rate_pct}%` });
  if (o.avg_watch_sec != null) out.push({ l: "сер. перегляд", v: `${o.avg_watch_sec} с` });
  if (o.purchases != null) out.push({ l: "покупки", v: `${o.purchases} · ${m(Number(o.revenue))}` }, { l: "ROAS", v: String(o.roas ?? "—") });
  if (o.cpl_7d_vs_prev) out.push({ l: "ціна ліда 7д / попер.", v: String(o.cpl_7d_vs_prev) });
  if (o.issues) out.push({ l: "проблема", v: String(o.issues) });
  return out;
}

// ---------- Креативи: маленькі плитки, наведення — збільшення, клік — на весь екран
function Creatives({ clientId, m }: { clientId: number; m: Fmt }) {
  const ads = adsForClient(clientId);
  if (!ads.length) return <><p style={{ color: "var(--muted)" }}>Креативів з витратами за 30 днів нема.</p><CreativePrompts clientId={clientId} m={m} ads={ads} /></>;
  const tot = ads.reduce((s, a) => ({ spend: s.spend + a.spend_30d, leads: s.leads + a.leads_30d, clicks: s.clicks + a.clicks_30d, impressions: s.impressions + a.impressions_30d }), { spend: 0, leads: 0, clicks: 0, impressions: 0 });
  const avg = { cpl: cplOf(tot), ctr: ctrOf(tot), spend: tot.spend };
  const ai = getAnalysis(clientId)?.data.creatives ?? {};
  const camps = new Map(campaignsWithStats(clientId, kyivDay(29)).map((c) => [c.campaign_id, c.name]));
  const sets = new Map(adsetsForClient(clientId).map((s) => [s.adset_id, s.name]));
  const items: GalleryItem[] = ads.map((a) => ({
    id: a.ad_id, name: a.name || "Оголошення", img: a.image_url || a.thumbnail_url, kind: a.kind, cards: JSON.parse(a.images_json || "[]") as string[],
    body: a.body, preview: a.preview_url, status: STATUS[a.status] ?? a.status.toLowerCase(), active: a.status === "ACTIVE",
    where: [camps.get(a.campaign_id), sets.get(a.adset_id)].filter(Boolean).join(" → "),
    stats: [
      { l: "витрачено", v: m(a.spend_30d) },
      { l: "частка бюджету", v: `${tot.spend ? Math.round((a.spend_30d / tot.spend) * 100) : 0}%` },
      { l: "лідів", v: fmtN(a.leads_30d) },
      { l: "ціна ліда", v: m(cplOf({ spend: a.spend_30d, leads: a.leads_30d })) },
      { l: "CTR", v: pct(ctrOf({ clicks: a.clicks_30d, impressions: a.impressions_30d })) },
      { l: "ціна кліку", v: m(a.clicks_30d ? a.spend_30d / a.clicks_30d : null) },
      { l: "показів", v: fmtN(a.impressions_30d) },
      { l: "частота", v: freqOf(a.impressions_30d, a.reach_30d)?.toFixed(1) ?? "—" },
      ...moreStats(a, m),
    ],
    verdicts: creativeVerdict(a, avg),
    opinion: ai[a.ad_id] ?? "",
  }));
  return (
    <>
      <div className="mono">Креативи за 30 днів, від найбільших витрат · середня ціна ліда {m(avg.cpl)} · наведи — збільшиться, натисни — на весь екран</div>
      <CreativeGallery items={items} />
      <CreativePrompts clientId={clientId} m={m} ads={ads} />
    </>
  );
}

// ---------- Аудиторія: де показується, кому, звідки, з чого
function Cut({ title, kind, rows, m, hint }: { title: string; kind: string; rows: Breakdown[]; m: Fmt; hint: string }) {
  if (!rows.length) return null;
  const total = rows.reduce((s, r) => s + r.spend, 0);
  const withLeads = rows.filter((r) => r.leads > 0 && r.spend >= total * 0.05);
  const cpls = withLeads.map((r) => r.spend / r.leads);
  const best = cpls.length > 1 ? Math.min(...cpls) : null, worst = cpls.length > 1 ? Math.max(...cpls) : null;
  return (
    <div className="card mx-cut">
      <div className="mx-main-head"><b>{title}</b><span>{hint}</span></div>
      <div className="mx-cut-rows">
        {rows.slice(0, 12).map((r) => {
          const c = cplOf(r);
          const tone = c != null && r.spend >= total * 0.05 ? (c === best ? "good" : c === worst ? "bad" : "") : "";
          return (
            <div key={r.key} className="mx-cut-row">
              <span className="mx-name">{label(kind, r.key)}</span>
              <Share part={r.spend} total={total} />
              <span className="mx-num">{m(r.spend)}</span>
              <span className="mx-num">{r.leads} лід.</span>
              <span className={`mx-num ${tone}`}>{m(c)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Audience({ clientId, m }: { clientId: number; m: Fmt }) {
  const ai = getAnalysis(clientId)?.data.audience;
  const cuts = [
    { kind: "placement", title: "Де бачать рекламу", hint: "Facebook / Instagram, стрічка, Stories, Reels" },
    { kind: "age_gender", title: "Хто приходить", hint: "вік і стать" },
    { kind: "region", title: "Звідки", hint: "області" },
    { kind: "device", title: "З чого дивляться", hint: "пристрої" },
  ].map((c) => ({ ...c, rows: breakdowns(clientId, c.kind) }));
  if (cuts.every((c) => !c.rows.length)) return <p style={{ color: "var(--muted)" }}>Розрізів ще нема — зʼявляться після наступного оновлення цифр.</p>;
  return (
    <>
      {ai && <div className="callout"><b>Джері:</b> {ai}</div>}
      <div className="mono">За 30 днів · зелена ціна ліда — найдешевший сегмент, червона — найдорожчий</div>
      <div className="mx-cuts">{cuts.map((c) => <Cut key={c.kind} {...c} m={m} />)}</div>
    </>
  );
}

// ---------- Висновки: автоматичні правила + розбір Джері
// Заявки з лід-форм: хто, телефон, відповіді, з якої реклами, оцінка якості (з Telegram-кнопок або тут)
function Leads({ clientId, m }: { clientId: number; m: Fmt }) {
  const list = clientLeads(clientId, 30);
  const st = leadStats(clientId, 30);
  const spend = totals(clientId, kyivDay(29), kyivDay(0)).spend;
  const rated = st.good + st.bad;
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <LeadRouting clientId={clientId} />
      {!list.length && <div className="empty">Заявок з лід-форм за 30 днів нема. Якщо вони мають бути — перевір Налаштування → Конектори → Meta → «Заявки з лід-форм» (дозволи токена і сторінка клієнта).</div>}
      {list.length > 0 && <>
      <div className="ld-kpis">
        <div className="kpi"><div className="n">{st.total}</div><div className="l">Заявок за 30 днів</div></div>
        <div className="kpi"><div className="n">{st.total ? Math.round((st.taken / st.total) * 100) : 0}%</div><div className="l">Взяли в роботу</div></div>
        <div className="kpi"><div className="n">{rated ? `${Math.round((st.good / rated) * 100)}%` : "—"}</div><div className="l">Якісних з оцінених ({rated})</div></div>
        <div className="kpi"><div className="n">{st.good ? m(spend / st.good) : "—"}</div><div className="l">Ціна якісної заявки</div></div>
      </div>
      <div className="ld-list">
        {list.map((l) => (
          <div key={l.id} className={`ld-item ${l.quality}`}>
            <div className="ld-who">{l.name || "Без імені"}{l.phone && <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`}>{l.phone}</a>}{l.email && <span className="mono"> · {l.email}</span>}</div>
            <form action={rateLeadAction} className="ld-rate">
              <input type="hidden" name="id" value={l.id} />
              <button name="q" value="good" className={`ghost ${l.quality === "good" ? "on" : ""}`} title="Якісна">👍</button>
              <button name="q" value="bad" className={`ghost ${l.quality === "bad" ? "on" : ""}`} title="Сміття">👎</button>
            </form>
            {leadFields(l).length > 0 && <div className="ld-fields">{leadFields(l).map((f, i) => <span key={i}>{f.label}: <b>{f.value}</b></span>)}</div>}
            <div className="ld-src">{new Date(l.created_time).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {[l.campaign_name, l.ad_name].filter(Boolean).join(" / ") || l.form_name}{l.taken_at ? ` · взяли${l.taken_by ? ` (${l.taken_by})` : ""}` : l.tg_chat_id ? " · ще не взяли" : ""}</div>
          </div>
        ))}
      </div>
      </>}
    </div>
  );
}

// Куди йдуть заявки: наша група клієнта і/або власний бот клієнта
function LeadRouting({ clientId }: { clientId: number }) {
  const route = getRoute(clientId);
  const pages = listPages().filter((p) => p.client_id === clientId);
  const groups = chatsForClient(clientId).filter((c) => c.active);
  const token = leadBotToken(clientId);
  const users = token ? botUsers(clientId) : [];
  const link = token ? inviteLink(clientId) : "";
  const on = pages.some((p) => p.leads_on);
  return (
    <details className="card lb-card" open={!on || (!groups.length && !users.length)}>
      <summary><b>Куди йдуть заявки</b> <span className="mono">{!on ? "· сторінку не увімкнено" : [route.to_group && groups.length ? "група" : "", route.to_bot && token ? `бот @${route.bot_username} (${users.length})` : ""].filter(Boolean).join(" + ") || "· нікуди — прийдуть тобі"}</span></summary>
      <div className="stack" style={{ gap: "1rem", marginTop: "0.75rem" }}>
        {!on && <div className="callout" style={{ borderColor: "var(--warn)" }}>Сторінка Facebook цього клієнта ще не увімкнена для надсилання: Налаштування → Конектори → Meta → «Заявки з лід-форм» → обери цього клієнта і постав «надсилати».</div>}
        <form action={leadRouteAction} className="stack" style={{ gap: "0.5rem" }}>
          <input type="hidden" name="client_id" value={clientId} />
          <label className="lp-check"><input type="checkbox" name="to_group" defaultChecked={!!route.to_group} /> Також у спільну Telegram-групу з клієнтом {groups.length ? `(${groups.map((g) => `«${g.title}»`).join(", ")})` : "— групи нема"} — зазвичай не треба, якщо є бот</label>
          <label className="lp-check"><input type="checkbox" name="to_bot" defaultChecked={!!route.to_bot} disabled={!token} /> У власного бота клієнта {token ? `@${route.bot_username}` : "— не підключений"}</label>
          <div><button className="ghost small">Зберегти</button></div>
        </form>
        <div className="lb-bot stack" style={{ gap: "0.625rem" }}>
          <b>Бот клієнта</b>
          {!token ? (
            <>
              <div className="mono">Заявки приходитимуть менеджерам клієнта від їхнього бота з кнопками «Взяли / Якісна / Сміття». Встав токен бота з @BotFather. Якщо бот уже десь працює (інший сервіс), система попередить.</div>
              <LeadBotConnect clientId={clientId} />
            </>
          ) : (
            <>
              <div className="mono">@{route.bot_username}{route.bot_name ? ` · ${route.bot_name}` : ""}. Відправ це посилання менеджерам клієнта. Хто відкриє його й натисне «Start», той отримуватиме заявки. Відписатись можна командою /stop.</div>
              {link && <CopyInvite link={link} />}
              {users.length ? (
                <div className="lb-users">
                  {users.map((u) => (
                    <form key={u.id} action={leadBotUserAction} className="tool-chip">
                      <input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="tg_user_id" value={u.tg_user_id} />
                      <span>{u.name}</span><button className="tool-x" title="Більше не надсилати" aria-label={`Прибрати ${u.name}`}>×</button>
                    </form>
                  ))}
                </div>
              ) : <div className="mono" style={{ color: "var(--warn)" }}>Ще ніхто не підписався — без цього заявки в бота не прийдуть.</div>}
              <div className="inline" style={{ flexWrap: "wrap" }}>
                <TestLead clientId={clientId} />
                <form action={leadBotInviteAction}><input type="hidden" name="client_id" value={clientId} /><button className="ghost small" title="Старе посилання перестане працювати; хто вже підписаний — лишаються">Нове посилання</button></form>
                <form action={leadBotDisconnectAction}><input type="hidden" name="client_id" value={clientId} /><button className="ghost small">Відключити бота</button></form>
              </div>
            </>
          )}
        </div>
      </div>
    </details>
  );
}

// Промпти креативів переїхали в розділ «Креативи» (студія) — тут лише посилання
function CreativePrompts({ clientId }: { clientId: number; m?: Fmt; ads?: unknown }) {
  return (
    <Link href={`/clients/${clientId}?tab=creatives`} className="card cs-link" style={{ marginTop: "1rem" }}>
      <b>Студія креативів →</b> <span className="mono">«Контекст клієнта» для нового чату, промпти з кодом CR-N, дошка і що працює</span>
    </Link>
  );
}

// Посилання на звіт для клієнта (сторінка без входу з цифрами, заявками, креативами і «що зробили»)
async function ReportLink({ clientId }: { clientId: number }) {
  const token = reportToken(clientId);
  const h = await headers();
  const url = token ? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? ""}/r/${token}` : "";
  return (
    <details className="card rl-card">
      <summary><b>Звіт для клієнта</b> <span className="mono">{token ? "посилання увімкнене" : "вимкнено"}</span></summary>
      <div className="stack" style={{ gap: "0.5rem", marginTop: "0.75rem" }}>
        <div className="mono">Сторінка для клієнта без входу: заявки і ціна заявки (тиждень до тижня), графік, якість заявок, найкращі креативи, «що ми зробили» (журнал змін і історія робіт). Без наших витрат і нотаток.</div>
        {token ? (
          <>
            <div className="lb-invite"><code>{url}</code><CopyText text={url} label="Копіювати" /><a href={url} target="_blank" rel="noreferrer" className="btn ghost small">Відкрити</a></div>
            <div className="inline">
              <form action={reportLinkAction}><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="op" value="renew" /><button className="ghost small" title="Старе посилання перестане працювати">Нове посилання</button></form>
              <form action={reportLinkAction}><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="op" value="off" /><button className="ghost small danger-text">Вимкнути</button></form>
            </div>
          </>
        ) : <form action={reportLinkAction}><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="op" value="on" /><button className="small">Увімкнути посилання</button></form>}
      </div>
    </details>
  );
}

// Журнал змін реклами: що змінили → чого чекали → що вийшло
function Changes({ clientId }: { clientId: number }) {
  const list = listChanges(clientId);
  return (
    <section className="stack" style={{ gap: "0.75rem" }}>
      <div className="mx-main-head"><b>Журнал змін реклами</b><span>що змінили → що вийшло · іде в розбір Джері і звіт клієнту</span></div>
      <form action={changeAction} className="card mk-form">
        <input type="hidden" name="client_id" value={clientId} />
        <input name="what" required placeholder="Що змінили: напр. «вимкнули Чехію, бюджет +$5 на Україну»" className="wide" />
        <input name="why" placeholder="Чому" />
        <input name="expect" placeholder="Чого чекаємо: напр. «ціна ліда < $8»" />
        <input name="at" type="date" aria-label="Коли" />
        <div><SubmitButton className="small">Записати зміну</SubmitButton></div>
      </form>
      <div className="st-grid">{list.map((c) => (
        <Pop key={c.id} title={c.what} sub={fmtDate(c.at)} trigger={
          <div className="pv"><div className="pv-t">{c.what}</div><div className="pv-s" style={{ color: c.result ? "var(--ok)" : undefined }}>{c.result ? `→ ${c.result}` : c.expect ? `чекаємо: ${c.expect}` : "результат ще не записано"}</div><div className="pv-m">{fmtDate(c.at)}</div></div>
        }>
          {c.why && <p><b>Чому:</b> {c.why}</p>}
          {c.expect && <p><b>Чекаємо:</b> {c.expect}</p>}
          <form action={changeAction} className="stack" style={{ gap: "0.5rem" }}>
            <input type="hidden" name="change_id" value={c.id} /><input type="hidden" name="client_id" value={clientId} />
            <input name="result" defaultValue={c.result} placeholder="Що вийшло (через кілька днів)" />
            <div className="inline"><SubmitButton className="ghost small">Зберегти</SubmitButton><button name="delete" value="1" className="ghost small danger-text">Видалити</button></div>
          </form>
        </Pop>
      ))}</div>
    </section>
  );
}

function Analysis({ clientId, m, err }: { clientId: number; m: Fmt; err?: string }) {
  const ins = metaInsights(clientId, m);
  const a = getAnalysis(clientId);
  const List = ({ title, items, tone }: { title: string; items?: string[]; tone: string }) =>
    items?.length ? (
      <Pop className={`pop-card mx-list ${tone}`} title={title} trigger={<><b>{title} · {items.length}</b><ul>{items.slice(0, 2).map((x) => <li key={x}>{x}</li>)}</ul>{items.length > 2 && <div className="pv-m">ще {items.length - 2} — відкрити →</div>}</>}>
        <ul className="st-list">{items.map((x) => <li key={x}>{x}</li>)}</ul>
      </Pop>
    ) : null;
  return (
    <>
      {err && <div className="callout" style={{ borderColor: "var(--bad)" }}>{err}</div>}
      <div className="mx-ai card">
        <div className="mx-main-head">
          <b>Розбір від Джері</b>
          <span>{a ? `від ${new Date(a.created_at.replace(" ", "T") + "Z").toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · оновлюється сам раз на тиждень` : "ще не робив"}</span>
        </div>
        {a?.data.summary && <p className="mx-summary">{a.data.summary}</p>}
        <form action={analyzeMetaAction}>
          <input type="hidden" name="client_id" value={clientId} />
          <SubmitButton className={a ? "ghost small" : ""} pendingText="Джері дивиться креативи і цифри… ~1 хв">{a ? "Оновити розбір зараз" : "Розібрати рекламу (Джері)"}</SubmitButton>
        </form>
      </div>
      {a && (
        <div className="mx-lists">
          <List title="Що добре" items={a.data.pros} tone="good" />
          <List title="Що погано" items={a.data.cons} tone="bad" />
          <List title="Що зробити" items={a.data.tips} tone="tip" />
          <List title="Патерни: що спрацьовує" items={a.data.patterns} tone="tip" />
        </div>
      )}
      <Changes clientId={clientId} />
      <div className="mono">Автоматичні висновки по цифрах (оновлюються з кожною синхронізацією)</div>
      <div className="mx-lists">
        <List title="Плюси" items={ins.pros} tone="good" />
        <List title="Мінуси" items={ins.cons} tone="bad" />
        <List title="Поради" items={ins.tips} tone="tip" />
      </div>
      {!ins.pros.length && !ins.cons.length && !ins.tips.length && <p style={{ color: "var(--muted)" }}>Поки нема що сказати — мало даних.</p>}
    </>
  );
}
