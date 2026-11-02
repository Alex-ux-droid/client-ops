// Звіт для клієнта за посиланням (без входу): реклама за 30 днів, тиждень до тижня, заявки, найкращі креативи, що ми зробили.
// Тільки те, що можна показати клієнту: без нашої собівартості, нотаток, думок Джері.
import { notFound } from "next/navigation";
import { BarChart } from "@/components/Charts";
import { clientFromToken } from "@/lib/clientReport";
import { getClient } from "@/lib/repo/clients";
import { listChanges } from "@/lib/repo/creatives";
import { leadStats } from "@/lib/repo/leads";
import { accountsForClient, adsForClient, dailySeries, kyivDay, totals } from "@/lib/repo/meta";
import { getSetting } from "@/lib/repo/settings";
import { listWork } from "@/lib/repo/worklog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Звіт", robots: { index: false, follow: false } };

const dm = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" });

export default async function ClientReport({ params }: { params: Promise<{ token: string }> }) {
  const id = clientFromToken((await params).token);
  const c = id ? getClient(id) : undefined;
  if (!id || !c) notFound();
  const accs = accountsForClient(id);
  const cur = accs[0]?.currency || "";
  const money = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("uk-UA", { maximumFractionDigits: n < 100 ? 2 : 0 })} ${cur}`);
  const m30 = totals(id, kyivDay(29), kyivDay(0)), w = totals(id, kyivDay(6), kyivDay(0)), p = totals(id, kyivDay(13), kyivDay(7));
  const cpl = (t: { spend: number; leads: number }) => (t.leads ? t.spend / t.leads : null);
  const delta = (now: number | null, before: number | null, lowerBetter = false) => {
    if (now == null || before == null || before === 0) return null;
    const d = ((now - before) / before) * 100;
    if (Math.abs(d) < 3) return <span className="rp-delta">≈ як минулого тижня</span>;
    const good = lowerBetter ? d < 0 : d > 0;
    return <span className={`rp-delta ${good ? "good" : "bad"}`}>{d > 0 ? "↑" : "↓"} {Math.abs(d).toFixed(0)}% до минулого тижня</span>;
  };
  const series = dailySeries(id, kyivDay(13));
  const ls = leadStats(id, 30);
  const top = adsForClient(id).filter((a) => a.leads_30d > 0 && (a.image_url || a.thumbnail_url)).sort((a, b) => a.spend_30d / a.leads_30d - b.spend_30d / b.leads_30d).slice(0, 4);
  const changes = listChanges(id, 20).filter((x) => x.at >= kyivDay(30));
  const work = listWork(id, 10).filter((x) => x.done_at >= kyivDay(30));
  const from = getSetting("proposal.from") || "";
  const updated = new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
  return (
    <main className="rp">
      <header className="rp-head">
        {from && <div className="rp-from">{from}</div>}
        <h1>Звіт: {c.name}</h1>
        <div className="rp-sub">Реклама і заявки · оновлено {updated}</div>
      </header>
      {accs.length ? (
        <>
          <section className="rp-kpis">
            <div className="rp-kpi"><span>Заявки за 7 днів</span><b>{w.leads}</b>{delta(w.leads, p.leads)}</div>
            <div className="rp-kpi"><span>Ціна заявки за 7 днів</span><b>{money(cpl(w))}</b>{delta(cpl(w), cpl(p), true)}</div>
            <div className="rp-kpi"><span>Заявки за 30 днів</span><b>{m30.leads}</b><small>вкладено в рекламу {money(m30.spend)}</small></div>
            <div className="rp-kpi"><span>Ціна заявки за 30 днів</span><b>{money(cpl(m30))}</b></div>
          </section>
          {series.length > 0 && (
            <section className="rp-card">
              <h2>Заявки по днях · 14 днів</h2>
              <BarChart data={series.map((d) => ({ label: dm(d.date), value: d.leads, tip: `${dm(d.date)}: ${d.leads} заявок, ${money(d.spend)}` }))} fmt={(n) => String(Math.round(n))} />
            </section>
          )}
        </>
      ) : <section className="rp-card"><p>Рекламний кабінет ще підключається.</p></section>}
      {ls.total > 0 && (
        <section className="rp-card">
          <h2>Заявки з форм · 30 днів</h2>
          <div className="rp-row">
            <div><b>{ls.total}</b><span>отримали</span></div>
            <div><b>{ls.total ? Math.round((ls.taken / ls.total) * 100) : 0}%</b><span>взяли в роботу</span></div>
            <div><b>{ls.good + ls.bad ? `${Math.round((ls.good / (ls.good + ls.bad)) * 100)}%` : "—"}</b><span>якісних з оцінених</span></div>
          </div>
          <p className="rp-note">Оцінюйте заявки кнопками «Якісна / Сміття» — так ми налаштовуємо рекламу на правильних людей.</p>
        </section>
      )}
      {top.length > 0 && (
        <section className="rp-card">
          <h2>Креативи, що приводять заявки найдешевше</h2>
          <div className="rp-ads">
            {top.map((a) => (
              <figure key={a.ad_id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.image_url || a.thumbnail_url} alt="" loading="lazy" />
                <figcaption><b>{a.leads_30d} заявок</b> · {money(a.spend_30d / a.leads_30d)} за заявку</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      {(changes.length > 0 || work.length > 0) && (
        <section className="rp-card">
          <h2>Що ми зробили за місяць</h2>
          <ul className="rp-list">
            {changes.map((x) => <li key={`c${x.id}`}><span>{dm(x.at)}</span><div>{x.what}{x.result && <em> → {x.result}</em>}</div></li>)}
            {work.map((x) => <li key={`w${x.id}`}><span>{dm(x.done_at.slice(0, 10))}</span><div>{x.what}{x.result && <em> → {x.result}</em>}</div></li>)}
          </ul>
        </section>
      )}
      <footer className="rp-foot">{from || "Звіт"} · сторінка оновлюється сама</footer>
    </main>
  );
}
