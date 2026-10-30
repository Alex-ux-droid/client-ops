import Link from "next/link";
import { syncMetaNowAction } from "@/app/actions";
import AskAssistant from "@/components/AskAssistant";
import { BarChart } from "@/components/Charts";
import { fmtDate } from "@/lib/dates";
import { lastSync, metaBlockedUntil, metaToken, tokenAgeDays } from "@/lib/meta";
import { accountBudget, accountSeries, accountTotals, ACCOUNT_STATUS, kyivDay, listAccounts, metaAlerts, type Totals } from "@/lib/repo/meta";

export const dynamic = "force-dynamic";

const SYNC_HOURS = 2; // як в instrumentation.ts
const fmtN = (n: number) => Math.round(n).toLocaleString("uk-UA");
const cpl = (t: Totals) => (t.leads ? t.spend / t.leads : null);
const sum = (a: Totals[]): Totals => a.reduce((s, t) => ({ spend: s.spend + t.spend, impressions: s.impressions + t.impressions, clicks: s.clicks + t.clicks, leads: s.leads + t.leads }), { spend: 0, impressions: 0, clicks: 0, leads: 0 });

function ago(iso: string): string {
  const min = Math.round((Date.now() - +new Date(iso)) / 60000);
  if (min < 1) return "щойно";
  if (min < 60) return `${min} хв тому`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} год ${min % 60} хв тому` : `${Math.floor(h / 24)} дн тому`;
}
const kyivTime = (iso: string) => new Date(iso).toLocaleTimeString("uk-UA", { timeZone: "Europe/Kyiv", hour: "2-digit", minute: "2-digit" });

function Delta({ now, before, lowerIsBetter = false }: { now: number | null; before: number | null; lowerIsBetter?: boolean }) {
  if (now == null || before == null || before === 0) return null;
  const d = ((now - before) / before) * 100;
  if (Math.abs(d) < 3) return <span className="meta-delta">≈</span>;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return <span className={`meta-delta ${good ? "good" : "bad"}`}>{d > 0 ? "↑" : "↓"} {Math.abs(d).toFixed(0)}%</span>;
}

// Міні-графік витрат за 14 днів (стовпчики, сьогодні — останній)
function Spark({ data, since }: { data: { date: string; spend: number }[]; since: number }) {
  const days = Array.from({ length: since }, (_, i) => kyivDay(since - 1 - i));
  const by = new Map(data.map((d) => [d.date, d.spend]));
  const max = Math.max(1, ...days.map((d) => by.get(d) ?? 0));
  return (
    <svg className="ads-spark" viewBox={`0 0 ${days.length * 6} 28`} preserveAspectRatio="none" aria-hidden>
      {days.map((d, i) => {
        const h = Math.max(1, ((by.get(d) ?? 0) / max) * 26);
        return <rect key={d} x={i * 6 + 0.5} y={28 - h} width={4.5} height={h} rx={1} className={i === days.length - 1 ? "today" : ""} />;
      })}
    </svg>
  );
}

export default async function AdsPage({ searchParams }: { searchParams: Promise<{ synced?: string; n?: string }> }) {
  const sp = await searchParams;
  const connected = !!metaToken();
  const all = listAccounts();
  const linked = all.filter((a) => a.client_id);
  const free = all.filter((a) => !a.client_id);
  const synced = lastSync();
  const age = tokenAgeDays();

  const rows = linked.map((a) => {
    const today = accountTotals(a.account_id, kyivDay(0), kyivDay(0));
    const w = accountTotals(a.account_id, kyivDay(6), kyivDay(0));
    const p = accountTotals(a.account_id, kyivDay(13), kyivDay(7));
    const alerts = [
      ...(a.account_status && a.account_status !== 1 ? [{ level: "bad" as const, text: ACCOUNT_STATUS[a.account_status] ?? "проблема з кабінетом" }] : []),
      ...(a.last_error ? [{ level: "bad" as const, text: "не оновилось" }] : []),
      ...metaAlerts(a.client_id!).filter((x) => !x.text.startsWith("кабінет:")),
    ];
    return { a, today, w, p, budget: accountBudget(a.account_id), series: accountSeries(a.account_id, kyivDay(13)), alerts };
  }).sort((x, y) => (y.alerts.length ? 1 : 0) - (x.alerts.length ? 1 : 0) || y.w.spend - x.w.spend);

  const currencies = [...new Set(linked.map((a) => a.currency).filter(Boolean))];
  const one = currencies.length <= 1;
  const cur = currencies[0] ?? "";
  const m = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("uk-UA", { maximumFractionDigits: n < 100 ? 2 : 0 })} ${cur}`);
  const T = { today: sum(rows.map((r) => r.today)), w: sum(rows.map((r) => r.w)), p: sum(rows.map((r) => r.p)) };
  const series30 = new Map<string, { spend: number; leads: number }>();
  for (const a of linked) for (const d of accountSeries(a.account_id, kyivDay(29))) {
    const s = series30.get(d.date) ?? { spend: 0, leads: 0 };
    series30.set(d.date, { spend: s.spend + d.spend, leads: s.leads + d.leads });
  }
  const chart = [...series30.entries()].sort(([a], [b]) => a.localeCompare(b));
  const problems = rows.filter((r) => r.alerts.length).length;

  return (
    <>
      <div className="head">
        <div>
          <div className="kicker">Meta Ads · тільки читання</div>
          <h1>Реклама</h1>
        </div>
        <div className="ads-sync">
          <span>
            {synced ? <>Оновлено о {kyivTime(synced)} ({ago(synced)})<br />наступне ≈ о {kyivTime(new Date(+new Date(synced) + SYNC_HOURS * 3600_000).toISOString())}</> : "Ще не оновлювалось"}
          </span>
          {connected && <form action={syncMetaNowAction}><button className="ghost">Оновити зараз</button></form>}
        </div>
      </div>

      {sp.synced === "ok" && <div className="callout ads-note" style={{ borderColor: "var(--ok)" }}>Оновлено — цифри свіжі.</div>}
      {sp.synced === "err" && <div className="callout ads-note" style={{ borderColor: "var(--bad)" }}>Не оновились кабінети: {sp.n}. Причина — біля кабінету нижче.</div>}
      {connected && metaBlockedUntil() && (
        <div className="callout ads-note" style={{ borderColor: "var(--bad)" }}>
          <b>Meta заблокувала доступ застосунку до API.</b> Цифри зараз не оновлюються (показуємо останні збережені), система пробує раз на 6 годин. Перевір: developers.facebook.com → твій застосунок — чи нема плашок «Restricted» / «Required actions»; Graph API Explorer → той самий токен → запит <code>me/adaccounts</code>. Після виправлення натисни «Оновити зараз».
        </div>
      )}
      {!connected && <div className="callout ads-note">Meta не підключена. <Link href="/settings?tab=connectors&c=meta">Налаштування → Конектори → Meta Ads</Link></div>}
      {connected && (age ?? 0) >= 50 && (
        <div className="callout ads-note" style={{ borderColor: "var(--warn)" }}>
          <b>Токену {age} дн.</b> Особистий токен живе ~60 днів — онови заздалегідь (інструкція в Базі знань), інакше цифри перестануть оновлюватись.
        </div>
      )}

      {linked.length > 0 && (
        <>
          {one ? (
            <div className="stats">
              <div className="stat"><div className="n">{m(T.today.spend)}</div><div className="l">Сьогодні витрачено · лідів {fmtN(T.today.leads)}</div></div>
              <div className="stat"><div className="n">{m(T.w.spend)}</div><div className="l">За 7 днів <Delta now={T.w.spend} before={T.p.spend} /></div></div>
              <div className="stat"><div className="n">{fmtN(T.w.leads)}</div><div className="l">Лідів за 7 днів <Delta now={T.w.leads} before={T.p.leads} /></div></div>
              <div className="stat" style={{ "--c": problems ? "var(--warn)" : undefined } as React.CSSProperties}><div className="n">{m(cpl(T.w))}</div><div className="l">Ціна ліда <Delta now={cpl(T.w)} before={cpl(T.p)} lowerIsBetter />{problems ? ` · ${problems} з тривогою` : ""}</div></div>
            </div>
          ) : (
            <div className="callout">Кабінети в різних валютах ({currencies.join(", ")}) — загальну суму не складаю, дивись по кожному.</div>
          )}

          <div className="section ads-top">
            {one && chart.length > 1 && (
              <div className="card">
                <div className="mono" style={{ marginBottom: "0.5rem" }}>Витрати всіх кабінетів по днях, 30 днів</div>
                <BarChart width={900} fmt={(n) => fmtN(n)} data={chart.map(([d, v]) => ({ label: d.slice(8, 10), value: v.spend, tip: `${fmtDate(d)}: ${m(v.spend)}, лідів ${v.leads}` }))} />
              </div>
            )}
            <AskAssistant text="Пройдись по всіх рекламних кабінетах: де зливається бюджет, де ціна ліда виросла, що працює найкраще і що треба зробити сьогодні.">Джері, що з рекламою?</AskAssistant>
          </div>

          <div className="section ads-grid">
            {rows.map(({ a, today, w, p, budget, series, alerts }) => {
              const mm = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("uk-UA", { maximumFractionDigits: n < 100 ? 2 : 0 })} ${a.currency}`);
              return (
                <Link key={a.account_id} href={`/clients/${a.client_id}?tab=meta_ads`} className={`card ads-acc ${alerts.some((x) => x.level === "bad") ? "bad" : alerts.length ? "warn" : ""}`}>
                  <div className="ads-acc-head">
                    <div style={{ minWidth: 0 }}>
                      <b>{a.client_name}</b>
                      <div className="ads-acc-sub">{a.name}{a.business_name ? ` · ${a.business_name}` : ""}</div>
                    </div>
                    <Spark data={series} since={14} />
                  </div>
                  {alerts.length > 0 && <div className="ads-tags">{alerts.map((x) => <span key={x.text} className={`tag ${x.level}`}>{x.text}</span>)}</div>}
                  <div className="ads-nums">
                    <div><span>Сьогодні</span><b>{mm(today.spend)}</b><em>лідів {fmtN(today.leads)}</em></div>
                    <div><span>7 днів</span><b>{mm(w.spend)}</b><Delta now={w.spend} before={p.spend} /></div>
                    <div><span>Ліди 7 дн.</span><b>{fmtN(w.leads)}</b><Delta now={w.leads} before={p.leads} /></div>
                    <div><span>Ціна ліда</span><b>{mm(cpl(w))}</b><Delta now={cpl(w)} before={cpl(p)} lowerIsBetter /></div>
                  </div>
                  <div className="ads-acc-foot">
                    <span>{budget.active ? `${budget.active} активн. кампаній${budget.daily ? ` · ${mm(budget.daily)}/день` : ""}` : "активних кампаній нема"}</span>
                    <span>{a.last_error ? a.last_error.slice(0, 80) : a.last_sync_at ? `оновлено ${ago(a.last_sync_at.replace(" ", "T") + "Z")}` : ""}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {connected && free.length > 0 && (
        <div className="section">
          <h2 style={{ marginBottom: 8 }}>Не привʼязані до клієнтів ({free.length})</h2>
          <p style={{ marginTop: 0, color: "var(--muted)" }}>Їх цифри не тягнуться. Привʼязати — <Link href="/settings?tab=connectors&c=meta">Налаштування → Конектори → Meta Ads</Link> або скажи Джері.</p>
          <div className="ads-free">{free.map((a) => <span key={a.account_id} className="tag">{a.name}</span>)}</div>
        </div>
      )}
    </>
  );
}
