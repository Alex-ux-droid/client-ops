import { BarChart } from "@/components/Charts";
import AskAssistant from "@/components/AskAssistant";
import { fmtDate } from "@/lib/dates";
import { accountsForClient, ACCOUNT_STATUS, campaignsWithStats, dailySeries, kyivDay, topAds, totals, type Totals } from "@/lib/repo/meta";

const STATUS: Record<string, string> = { ACTIVE: "активна", PAUSED: "пауза", CAMPAIGN_PAUSED: "пауза", ADSET_PAUSED: "пауза", ARCHIVED: "архів", DELETED: "видалена", IN_PROCESS: "обробка", WITH_ISSUES: "проблема", DISAPPROVED: "відхилено", PENDING_REVIEW: "перевірка" };
const fmtN = (n: number) => Math.round(n).toLocaleString("uk-UA");
const cpl = (t: Totals) => (t.leads ? t.spend / t.leads : null);
const ctr = (t: Totals) => (t.impressions ? (t.clicks / t.impressions) * 100 : null);

function Delta({ now, before, lowerIsBetter = false }: { now: number | null; before: number | null; lowerIsBetter?: boolean }) {
  if (now == null || before == null || before === 0) return null;
  const d = ((now - before) / before) * 100;
  if (Math.abs(d) < 3) return <span className="meta-delta">≈</span>;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return <span className={`meta-delta ${good ? "good" : "bad"}`}>{d > 0 ? "↑" : "↓"} {Math.abs(d).toFixed(0)}%</span>;
}

// Живі цифри з Meta: останні 7 днів проти попередніх 7, графік 30 днів, кампанії, найдорожчі креативи
export default function MetaLive({ clientId }: { clientId: number }) {
  const accs = accountsForClient(clientId);
  if (!accs.length) return null;
  const cur = accs[0].currency || "";
  const m = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("uk-UA", { maximumFractionDigits: n < 100 ? 2 : 0 })} ${cur}`);
  const w = totals(clientId, kyivDay(6), kyivDay(0));
  const p = totals(clientId, kyivDay(13), kyivDay(7));
  const series = dailySeries(clientId, kyivDay(29));
  const camps = campaignsWithStats(clientId, kyivDay(29)).filter((c) => c.spend > 0 || c.status === "ACTIVE");
  const ads = topAds(clientId, 9);
  const synced = accs.map((a) => a.last_sync_at).filter(Boolean).sort().at(-1);
  const problems = accs.filter((a) => (a.account_status && a.account_status !== 1) || a.last_error);

  return (
    <section className="stack" style={{ gap: "1rem" }}>
      <div className="meta-head">
        <div>
          <h2>Живі цифри з кабінету</h2>
          <div className="mono" style={{ color: "var(--dim)" }}>{accs.map((a) => a.name).join(", ")}{synced ? ` · оновлено ${fmtDate(synced)}` : " · ще не оновлювалось"}</div>
        </div>
        <AskAssistant text="Подивись живі цифри реклами цього клієнта за останні тижні: що працює, що зливає бюджет, який креатив найкращий і що б ти змінив.">Джері, як реклама?</AskAssistant>
      </div>
      {problems.map((a) => (
        <div key={a.account_id} className="callout" style={{ borderColor: "var(--warn)" }}>
          <b>{a.name}:</b> {a.account_status && a.account_status !== 1 ? ACCOUNT_STATUS[a.account_status] ?? "проблема з кабінетом" : ""}{a.last_error ? ` ${a.last_error}` : ""}
        </div>
      ))}
      <div className="kpis meta-kpis">
        <div className="kpi"><div className="n">{m(w.spend)}</div><div className="l">Витрачено за 7 днів <Delta now={w.spend} before={p.spend} /></div></div>
        <div className="kpi"><div className="n">{fmtN(w.leads)}</div><div className="l">Лідів <Delta now={w.leads} before={p.leads} /></div></div>
        <div className="kpi"><div className="n">{m(cpl(w))}</div><div className="l">Ціна ліда <Delta now={cpl(w)} before={cpl(p)} lowerIsBetter /></div></div>
        <div className="kpi"><div className="n">{ctr(w) == null ? "—" : `${ctr(w)!.toFixed(2)}%`}</div><div className="l">CTR <Delta now={ctr(w)} before={ctr(p)} /></div></div>
      </div>
      {series.length > 1 && (
        <div className="card">
          <div className="mono" style={{ marginBottom: "0.5rem" }}>Витрати по днях, 30 днів</div>
          <BarChart width={900} fmt={(n) => fmtN(n)} data={series.map((d) => ({ label: d.date.slice(8, 10), value: d.spend, tip: `${fmtDate(d.date)}: ${m(d.spend)}, лідів ${d.leads}` }))} />
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
                  <td>{m(cpl(c))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ads.length > 0 && (
        <>
          <div className="mono">Креативи з найбільшими витратами за 30 днів</div>
          <div className="meta-ads">
            {ads.map((a) => (
              <div key={a.ad_id} className="card meta-ad">
                {a.thumbnail_url ? <img src={a.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="meta-ad-ph" />}
                <div className="stack" style={{ gap: "0.25rem", minWidth: 0 }}>
                  <b className="meta-ad-name">{a.name || "Оголошення"}</b>
                  <div className="mono">{m(a.spend_30d)} · лідів {a.leads_30d} · ціна {m(a.leads_30d ? a.spend_30d / a.leads_30d : null)}</div>
                  <div className="mono" style={{ color: "var(--dim)" }}>CTR {a.impressions_30d ? ((a.clicks_30d / a.impressions_30d) * 100).toFixed(2) : "—"}%{a.status ? ` · ${STATUS[a.status] ?? a.status.toLowerCase()}` : ""}</div>
                  {a.body && <div className="meta-ad-body">{a.body}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
