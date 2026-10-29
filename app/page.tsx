import Link from "next/link";
import { BarChart } from "@/components/Charts";
import TaskItem from "@/components/TaskItem";
import { money } from "@/lib/config";
import { ymd } from "@/lib/dates";
import { monthLabel, STAGE_LABEL } from "@/lib/labels";
import { clientFlags, LEAD_STAGES, listClients } from "@/lib/repo/clients";
import { listIdeas } from "@/lib/repo/ideas";
import { moneySummary, receivedByMonth } from "@/lib/repo/payments";
import { listTasks, taskCounts, weekPlan } from "@/lib/repo/tasks";

const DAYS = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];

export default function Home() {
  const today = ymd();
  const counts = taskCounts();
  const focus = [...listTasks("overdue"), ...listTasks("today")];
  const clients = listClients();
  const active = clients.filter((c) => c.status === "active");
  const leads = clients.filter((c) => c.status === "lead");
  const attention = clients
    .filter((c) => c.status === "active" || c.status === "lead")
    .map((c) => ({ c, flags: clientFlags(c) }))
    .filter((x) => x.flags.length)
    .sort((a, b) => b.flags.filter((f) => f.level === "bad").length - a.flags.filter((f) => f.level === "bad").length);
  const m = moneySummary(today.slice(0, 7));
  const byMonth = receivedByMonth(6);
  const week = weekPlan();
  const ideas = listIdeas({ status: "new" }).slice(0, 4);
  const date = new Date().toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <div className="head">
        <div>
          <div className="kicker">{date}</div>
          <h1>Центр управління</h1>
        </div>
      </div>

      <div className="stats">
        <Link href="/tasks" className="stat" style={{ "--c": counts.overdue ? "var(--bad)" : "var(--accent)" } as React.CSSProperties}>
          <div className="n">{counts.today + counts.overdue}</div>
          <div className="l">Задач сьогодні{counts.overdue ? ` · ${counts.overdue} простр.` : ""}</div>
        </Link>
        <Link href="/money" className="stat" style={{ "--c": "var(--ok)" } as React.CSSProperties}>
          <div className="n">{money(m.received)}</div>
          <div className="l">Отримано за місяць</div>
        </Link>
        <Link href="/money" className="stat" style={{ "--c": m.overdue ? "var(--bad)" : "var(--cyan)" } as React.CSSProperties}>
          <div className="n">{money(m.overdue || m.expected)}</div>
          <div className="l">{m.overdue ? "Винні мені" : "Ще очікую"}</div>
        </Link>
        <Link href="/clients" className="stat">
          <div className="n">{active.length}</div>
          <div className="l">Клієнтів · {money(m.mrr)}/міс</div>
        </Link>
      </div>

      <div className="split section">
        <div>
          <div className="section" style={{ marginTop: 0 }}>
            <h2>Фокус на сьогодні <Link href="/tasks">всі →</Link></h2>
            <div className="list">
              {focus.length ? focus.map((t) => <TaskItem key={t.id} t={t} />) : <div className="empty">На сьогодні все чисто. Додай задачу кнопкою «+».</div>}
            </div>
          </div>
        </div>

        <div>
          <div className="section" style={{ marginTop: 0 }}>
            <h2>Потребують уваги</h2>
            <div className="list">
              {attention.length ? attention.slice(0, 6).map(({ c, flags }) => (
                <Link key={c.id} href={`/clients/${c.id}`} className="row">
                  <div className="row-main">
                    <div className="row-title">{c.name}</div>
                    <div className="meta">{flags.map((f) => <span key={f.text} className={`tag ${f.level}`}>{f.text}</span>)}</div>
                  </div>
                </Link>
              )) : <div className="empty">Усі клієнти в порядку.</div>}
            </div>
          </div>

          <div className="section">
            <h2>Воронка <Link href="/pipeline">відкрити →</Link></h2>
            <div className="kpis">
              {LEAD_STAGES.map((s) => (
                <Link key={s} href="/pipeline" className="kpi">
                  <div className="n">{leads.filter((l) => l.stage === s).length}</div>
                  <div className="l">{STAGE_LABEL[s]}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h2>План на тиждень <Link href="/tasks?view=week">детально →</Link></h2>
        <div className="week">
          {week.map((d) => {
            const dt = new Date(d.date);
            return (
              <div key={d.date} className={`day ${d.date === today ? "today" : ""}`}>
                <div className="day-head"><span>{d.date === today ? "сьогодні" : DAYS[dt.getDay()]}</span><span>{dt.getDate()}</span></div>
                {d.tasks.length ? d.tasks.slice(0, 5).map((t) => (
                  <div key={t.id} className={`day-task ${t.due_date! < today ? "late" : ""}`}>
                    {t.title}{t.client_name && <small>{t.client_name}</small>}
                  </div>
                )) : <div className="mono" style={{ color: "var(--dim)" }}>—</div>}
                {d.tasks.length > 5 && <div className="mono">+{d.tasks.length - 5}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid2 section">
        <div className="card">
          <div className="chart-title"><span>Отримано по місяцях</span><b>{money(byMonth.reduce((s, x) => s + x.total, 0))}</b></div>
          <BarChart fmt={(n) => money(n)} data={byMonth.map((x) => ({ label: monthLabel(x.month), value: x.total, tip: `${monthLabel(x.month)}: ${money(x.total)}` }))} />
        </div>
        <div>
          <h2 style={{ marginBottom: 10, display: "flex", justifyContent: "space-between" }}>Свіжі ідеї <Link href="/ideas" style={{ color: "var(--cyan)" }}>всі →</Link></h2>
          <div className="list">
            {ideas.length ? ideas.map((i) => (
              <div key={i.id} className="row">
                <div className="row-main">
                  <div className="row-title">{i.text}</div>
                  {i.client_name && <div className="row-sub">{i.client_name}</div>}
                </div>
              </div>
            )) : <div className="empty">Ідей поки нема.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
