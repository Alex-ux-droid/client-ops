import Link from "next/link";
import { analyzeMetaAction } from "@/app/actions";
import AskAssistant from "@/components/AskAssistant";
import { BarChart } from "@/components/Charts";
import SubmitButton from "@/components/SubmitButton";
import { fmtDate } from "@/lib/dates";
import { cplOf, creativeVerdict, ctrOf, freqOf, label, metaInsights, type Tone } from "@/lib/metaInsights";
import {
  accountsForClient, ACCOUNT_STATUS, adsetsForClient, adsForClient, breakdowns, campaignsWithStats, dailySeries, getAnalysis, kyivDay, totals,
  type Breakdown, type MetaAd, type MetaAdset,
} from "@/lib/repo/meta";
import CreativeGallery, { type GalleryItem } from "./CreativeGallery";

export const STATUS: Record<string, string> = { ACTIVE: "активна", PAUSED: "пауза", CAMPAIGN_PAUSED: "пауза", ADSET_PAUSED: "пауза", ARCHIVED: "архів", DELETED: "видалена", IN_PROCESS: "обробка", WITH_ISSUES: "проблема", DISAPPROVED: "відхилено", PENDING_REVIEW: "перевірка" };
const fmtN = (n: number) => Math.round(n).toLocaleString("uk-UA");
const pct = (n: number | null, d = 2) => (n == null ? "—" : `${n.toFixed(d)}%`);
const VIEWS = [
  { k: "overview", label: "Огляд" },
  { k: "tree", label: "Структура" },
  { k: "creatives", label: "Креативи" },
  { k: "audience", label: "Аудиторія" },
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
          <h2>Реклама в Meta</h2>
          <div className="mono" style={{ color: "var(--dim)" }}>
            {accs.map((a) => a.name).join(", ")}
            {synced ? ` · оновлено ${new Date(synced.replace(" ", "T") + "Z").toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : " · ще не оновлювалось"}
          </div>
        </div>
        <AskAssistant text="Подивись рекламу цього клієнта: що працює, що зливає бюджет, який креатив найкращий і що б ти змінив.">Джері, як реклама?</AskAssistant>
      </div>
      {problems.map((a) => (
        <div key={a.account_id} className="callout" style={{ borderColor: "var(--warn)" }}>
          <b>{a.name}:</b> {a.account_status && a.account_status !== 1 ? ACCOUNT_STATUS[a.account_status] ?? "проблема з кабінетом" : ""}{a.last_error ? ` ${a.last_error}` : ""}
        </div>
      ))}
      <nav className="mx-tabs">
        {VIEWS.map((x) => (
          <Link key={x.k} href={x.k === "overview" ? base : `${base}&mv=${x.k}`} scroll={false} className={x.k === v ? "on" : ""}>{x.label}</Link>
        ))}
      </nav>
      {v === "overview" && <Overview clientId={clientId} m={m} base={base} />}
      {v === "tree" && <Tree clientId={clientId} m={m} />}
      {v === "creatives" && <Creatives clientId={clientId} m={m} />}
      {v === "audience" && <Audience clientId={clientId} m={m} />}
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
  const top = [...ins.cons.slice(0, 2).map((x) => ({ t: "bad" as Tone, x })), ...ins.tips.slice(0, 2).map((x) => ({ t: "" as Tone, x })), ...ins.pros.slice(0, 1).map((x) => ({ t: "good" as Tone, x }))];

  return (
    <>
      <div className="mono">Останні 7 днів проти попередніх 7</div>
      <div className="kpis meta-kpis">
        <div className="kpi"><div className="n">{m(w.spend)}</div><div className="l">Витрачено <Delta now={w.spend} before={p.spend} /></div></div>
        <div className="kpi"><div className="n">{fmtN(w.leads)}</div><div className="l">Лідів <Delta now={w.leads} before={p.leads} /></div></div>
        <div className="kpi"><div className="n">{m(cplOf(w))}</div><div className="l">Ціна ліда <Delta now={cplOf(w)} before={cplOf(p)} lowerIsBetter /></div></div>
        <div className="kpi"><div className="n">{pct(ctrOf(w))}</div><div className="l">CTR <Delta now={ctrOf(w)} before={ctrOf(p)} /></div></div>
      </div>

      <div className="mono">За 30 днів</div>
      <div className="mx-blocks">
        <div><b>{fmtN(mo.leads)}</b><span>лідів</span></div>
        <div><b>{m(mo.spend)}</b><span>витрачено</span></div>
        <div><b>{m(cplOf(mo))}</b><span>ціна ліда</span></div>
        <div><b>{pct(ctrOf(mo))}</b><span>CTR — скільки клікають</span></div>
        <div><b>{m(mo.clicks ? mo.spend / mo.clicks : null)}</b><span>ціна кліку</span></div>
        <div><b>{m(mo.impressions ? (mo.spend / mo.impressions) * 1000 : null)}</b><span>ціна 1000 показів</span></div>
        <div><b>{t?.reach ? fmtN(t.reach) : "—"}</b><span>людей побачили</span></div>
        <div><b>{t ? (freqOf(t.impressions, t.reach)?.toFixed(1) ?? "—") : "—"}</b><span>разів кожен (частота)</span></div>
      </div>

      {top.length > 0 && (
        <div className="card mx-main">
          <div className="mx-main-head"><b>Головне</b><Link href={`${base}&mv=analysis`} scroll={false}>усі висновки →</Link></div>
          <ul>{top.map((x) => <li key={x.x} className={x.t}>{x.x}</li>)}</ul>
        </div>
      )}

      {series.length > 1 && (
        <div className="grid2">
          <div className="card">
            <div className="mono" style={{ marginBottom: "0.5rem" }}>Витрати по днях</div>
            <BarChart width={600} fmt={(n) => fmtN(n)} data={series.map((d) => ({ label: d.date.slice(8, 10), value: d.spend, tip: `${fmtDate(d.date)}: ${m(d.spend)}, лідів ${d.leads}` }))} />
          </div>
          <div className="card">
            <div className="mono" style={{ marginBottom: "0.5rem" }}>Ліди по днях</div>
            <BarChart width={600} fmt={(n) => fmtN(n)} data={series.map((d) => ({ label: d.date.slice(8, 10), value: d.leads, tip: `${fmtDate(d.date)}: лідів ${d.leads}, ціна ${m(cplOf(d))}` }))} />
          </div>
        </div>
      )}

      {camps.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Кампанія</th><th>Статус</th><th>Бюджет</th><th>Витрати 30 дн.</th><th>Ліди</th><th>Ціна ліда</th></tr></thead>
            <tbody>
              {camps.map((c) => (
                <tr key={c.campaign_id}>
                  <td>{c.name}</td>
                  <td><span className={`tag ${c.status === "ACTIVE" ? "ok" : ""}`}>{STATUS[c.status] ?? c.status.toLowerCase()}</span></td>
                  <td>{c.daily_budget ? `${m(c.daily_budget)}/день` : c.lifetime_budget ? `${m(c.lifetime_budget)} всього` : "—"}</td>
                  <td>{m(c.spend)}</td>
                  <td>{fmtN(c.leads)}</td>
                  <td>{m(cplOf(c))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
                      <span className="mx-name"><b>{s.name}</b><small>група · {STATUS[s.status] ?? s.status.toLowerCase()}{s.daily_budget ? ` · ${m(s.daily_budget)}/день` : ""}{s.reach_30d ? ` · частота ${freqOf(s.impressions_30d, s.reach_30d)?.toFixed(1)}` : ""}</small></span>
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

// ---------- Креативи: маленькі плитки, наведення — збільшення, клік — на весь екран
function Creatives({ clientId, m }: { clientId: number; m: Fmt }) {
  const ads = adsForClient(clientId);
  if (!ads.length) return <p style={{ color: "var(--muted)" }}>Креативів з витратами за 30 днів нема.</p>;
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
    ],
    verdicts: creativeVerdict(a, avg),
    opinion: ai[a.ad_id] ?? "",
  }));
  return (
    <>
      <div className="mono">Креативи за 30 днів, від найбільших витрат · середня ціна ліда {m(avg.cpl)} · наведи — збільшиться, натисни — на весь екран</div>
      <CreativeGallery items={items} />
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
function Analysis({ clientId, m, err }: { clientId: number; m: Fmt; err?: string }) {
  const ins = metaInsights(clientId, m);
  const a = getAnalysis(clientId);
  const List = ({ title, items, tone }: { title: string; items?: string[]; tone: string }) =>
    items?.length ? <div className={`card mx-list ${tone}`}><b>{title}</b><ul>{items.map((x) => <li key={x}>{x}</li>)}</ul></div> : null;
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
        </div>
      )}
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
