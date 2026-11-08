// Тижневий рев'ю: по рядку на клієнта (метрика, що змінилось, план, рішення), гроші тижня, «Закрити тиждень», архів
import Link from "next/link";
import { money } from "@/lib/config";
import { dueWeek, getReview, listReviews, reviewRows, weekLabel, weekMoney, type ReviewRow } from "@/lib/repo/review";
import { reviewSaveAction } from "./actions";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ w?: string; err?: string; saved?: string; closed?: string }> }) {
  const sp = await searchParams;
  const due = dueWeek();
  const week = sp.w && /^\d{4}-\d{2}-\d{2}$/.test(sp.w) ? sp.w : due.week;
  const snap = getReview(week);
  const data = snap ? (JSON.parse(snap.data_json) as { rows: ReviewRow[]; money: ReturnType<typeof weekMoney> }) : null;
  const rows = data?.rows ?? reviewRows(week);
  const m = data?.money ?? weekMoney(week);
  const archive = listReviews();
  return (
    <>
      <div className="head">
        <div><div className="kicker">тиждень {weekLabel(week)}{snap ? ` · закрито ${snap.closed_at.slice(0, 10).split("-").reverse().join(".")}` : ""}</div><h1>Рев&apos;ю тижня</h1></div>
      </div>
      {sp.err && <div className="callout" style={{ borderColor: "var(--bad)" }}>{sp.err}</div>}
      {sp.saved && <div className="callout" style={{ borderColor: "var(--ok)" }}>Чернетку збережено.</div>}
      {sp.closed && <div className="callout" style={{ borderColor: "var(--ok)" }}>Тиждень закрито, знімок збережено. Задачі з рішень — на +7 днів.</div>}

      <form action={reviewSaveAction} className="stack" style={{ gap: "0.75rem" }}>
        <input type="hidden" name="week" value={week} />
        {rows.length ? rows.map((r) => (
          <div key={r.client_id} className="card rv-row">
            <input type="hidden" name="client_id" value={r.client_id} />
            <div className="rv-head">
              <Link href={`/clients/${r.client_id}`} className="rv-name">{r.name}</Link>
              {r.metric ? (
                <span className="rv-metric" title="зараз / тиждень тому / ціль">★ {r.metric.name}: <b>{r.metric.now}</b> · тиждень тому {r.metric.weekAgo} · ціль {r.metric.target}</span>
              ) : <span className="rv-metric mono">головна метрика не обрана</span>}
            </div>
            <div className="rv-cols">
              <div><div className="rv-h">Що змінилось</div>{r.changes.length ? <ul>{r.changes.map((x, i) => <li key={i}>{x}</li>)}</ul> : <div className="mono">нічого не записано</div>}</div>
              <div><div className="rv-h">План стратегії на тиждень</div>{r.plan.length ? <ul>{r.plan.map((x, i) => <li key={i}>{x}</li>)}</ul> : <div className="mono">—</div>}
                {(r.hypotheses ?? []).length > 0 && <><div className="rv-h" style={{ marginTop: "0.5rem" }}>Гіпотези з дедлайном цього тижня</div><ul>{r.hypotheses.map((x, i) => <li key={i}>{x}</li>)}</ul></>}</div>
            </div>
            <label className="rv-h" htmlFor={`d${r.client_id}`}>Рішення на тиждень *</label>
            {snap ? <div>{r.decision || "—"}{r.task_id ? <span className="mono"> · задача #{r.task_id}</span> : null}</div> : (
              <>
                <textarea id={`d${r.client_id}`} name={`decision_${r.client_id}`} defaultValue={r.decision} rows={2} placeholder="Що робимо цього тижня і чому (одна головна дія)" />
                <label className="inline mono rv-task"><input type="checkbox" name={`task_${r.client_id}`} defaultChecked={r.to_task} /> → задача (+7 днів)</label>
              </>
            )}
          </div>
        )) : <div className="empty">Активних клієнтів нема.</div>}

        <div className="card">
          <b>Гроші тижня</b>
          <div className="kpis meta-kpis" style={{ marginTop: "0.5rem" }}>
            <div className="kpi"><div className="n" style={{ color: "var(--ok)" }}>{money(m.received)}</div><div className="l">отримано</div></div>
            <div className="kpi"><div className="n">{money(m.expected)}</div><div className="l">очікую цього тижня</div></div>
            <div className="kpi"><div className="n" style={m.overdue ? { color: "var(--bad)" } : undefined}>{money(m.overdue)}</div><div className="l">прострочено</div></div>
          </div>
        </div>

        {!snap && rows.length > 0 && (
          <div className="inline" style={{ flexWrap: "wrap" }}>
            <button name="op" value="save" className="ghost">Зберегти чернетку</button>
            <button name="op" value="close">Закрити тиждень</button>
          </div>
        )}
      </form>

      {archive.length > 0 && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <b>Архів тижнів</b>
          <div className="rd-areas" style={{ marginTop: "0.5rem" }}>
            {archive.map((a) => <Link key={a.week} href={`/review?w=${a.week}`} className={a.week === week ? "on" : ""}>{weekLabel(a.week)}</Link>)}
            {week !== due.week && <Link href="/review">← поточний</Link>}
          </div>
        </div>
      )}
    </>
  );
}
