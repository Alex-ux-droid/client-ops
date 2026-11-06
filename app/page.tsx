import Link from "next/link";
import { addTask } from "@/app/actions";
import TaskItem from "@/components/TaskItem";
import Icon from "@/components/Icon";
import { crmStats } from "@/lib/crm";
import { productIssues } from "@/lib/products";
import { listCrmLinks } from "@/lib/repo/crm";
import { getOrg, listProducts, productClients } from "@/lib/repo/products";
import { money } from "@/lib/config";
import { ymd } from "@/lib/dates";
import { monthLabel } from "@/lib/labels";
import { clientFlags, listClients } from "@/lib/repo/clients";
import { moneySummary, receivedByMonth } from "@/lib/repo/payments";
import { listTasks, taskCounts, weekPlan } from "@/lib/repo/tasks";

const DAYS = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];

function greeting(h: number) {
  return h < 5 ? "Доброї ночі" : h < 12 ? "Доброго ранку" : h < 18 ? "Доброго дня" : "Доброго вечора";
}

export default function Home() {
  const now = new Date();
  const today = ymd(now);
  const t = taskCounts();
  const focus = [...listTasks("overdue"), ...listTasks("today")];
  const clients = listClients();
  const active = clients.filter((c) => c.status === "active");
  const attention = clients
    .filter((c) => c.status === "active" || c.status === "lead")
    .map((c) => ({ c, flags: clientFlags(c) }))
    .filter((x) => x.flags.length)
    .sort((a, b) => b.flags.filter((f) => f.level === "bad").length - a.flags.filter((f) => f.level === "bad").length);
  const m = moneySummary(today.slice(0, 7));
  const byMonth = receivedByMonth(6);
  const week = weekPlan();
  const weekMax = Math.max(1, ...week.map((d) => d.tasks.length));
  const monthMax = Math.max(1, ...byMonth.map((x) => x.total));
  const todayTotal = t.today + t.overdue + t.doneToday;
  const planPct = m.mrr ? Math.min(100, Math.round((m.received / m.mrr) * 100)) : 0;
  const monthName = now.toLocaleDateString("uk-UA", { month: "long" });
  // Загальна картина: фокус організації, поломки наших продуктів, продажі клієнтів з CRM
  const orgFocus = (getOrg().focus || "").split("\n")[0].slice(0, 120);
  const broken = listProducts().map((p) => { const i = productIssues(p.id); return { id: p.id, name: p.name, n: i.errors.reduce((a, x) => a + x.n, 0) + i.feedback.length, clients: productClients(p.id).map((c) => c.name).join(", ") }; }).filter((x) => x.n > 0);
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const crm = listCrmLinks().reduce((acc, l) => { const st = crmStats(l.client_id, since30); return { sales: acc.sales + st.sales, revenue: acc.revenue + st.revenue, cur: acc.cur || st.currency }; }, { sales: 0, revenue: 0, cur: "" });

  // Одне речення про головне
  const brief = [
    t.overdue ? `${t.overdue} прострочено` : null,
    t.today ? `${t.today} на сьогодні` : "на сьогодні задач нема",
    m.overdue ? `борг ${money(m.overdue)}` : null,
    attention.length ? `${attention.length} клієнтів потребують уваги` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="dash">
      <header className="dash-head">
        <div>
          <div className="kicker">{now.toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1>{greeting(now.getHours())}, Саша</h1>
        </div>
        <div className="dash-right">
          <div className="dash-brief">{brief}</div>
          {orgFocus && <Link href="/kb" className="dash-focus" title="Розвиток → Головне зараз"><Icon name="compass" size={15} /> {orgFocus}</Link>}
        </div>
      </header>

      <section className="dash-kpis">
        <Link href="/tasks" className="kpi-tile">
          <div className="kpi-label">Сьогодні</div>
          <div className="kpi-value" style={{ color: t.overdue ? "var(--bad)" : undefined }}>{t.today + t.overdue}<small> задач</small></div>
          <div className="bar ok"><i style={{ width: `${todayTotal ? Math.round((t.doneToday / todayTotal) * 100) : 0}%` }} /></div>
          <div className="kpi-sub">{t.doneToday} зроблено{t.overdue ? <> · <b className="bad">{t.overdue} простр.</b></> : null}</div>
        </Link>
        <Link href="/money" className="kpi-tile">
          <div className="kpi-label">Дохід · {monthName}</div>
          <div className="kpi-value" style={{ color: "var(--ok)" }}>{money(m.received)}</div>
          <div className="bar ok"><i style={{ width: `${planPct}%` }} /></div>
          <div className="kpi-sub">{m.mrr ? `${planPct}% від ${money(m.mrr)} плану` : "вкажи щомісячну оплату клієнтам"}</div>
        </Link>
        <Link href="/money" className="kpi-tile">
          <div className="kpi-label">Борги</div>
          <div className="kpi-value" style={{ color: m.overdue ? "var(--bad)" : undefined }}>{money(m.overdue)}</div>
          <div className="bar"><i style={{ width: m.overdue ? "100%" : "0%", background: "var(--bad)" }} /></div>
          <div className="kpi-sub">{m.overdue ? `${m.overdueCount} оплат прострочено` : `ще очікую ${money(m.expected)}`}</div>
        </Link>
        <Link href="/clients" className="kpi-tile">
          <div className="kpi-label">Клієнти</div>
          <div className="kpi-value">{active.length}<small> активних</small></div>
          <div className="bar"><i style={{ width: `${clients.length ? Math.round((active.length / clients.length) * 100) : 0}%`, background: "var(--link)" }} /></div>
          <div className="kpi-sub">{crm.sales ? `продажі клієнтів за 30 дн.: ${crm.sales} на ${Math.round(crm.revenue).toLocaleString("uk-UA")} ${crm.cur}` : m.mrr ? `разом ${money(m.mrr)}/міс` : "вкажи щомісячну оплату клієнтам"}</div>
        </Link>
      </section>

      <section className="dash-grid">
        {/* Колонка 1: що робити зараз */}
        <div className="panel panel-tall">
          <div className="panel-head">
            <h2>Фокус на сьогодні</h2>
            <Link href="/tasks">всі задачі →</Link>
          </div>
          <form action={addTask} className="panel-add">
            <input type="hidden" name="due_date" value={today} />
            <input name="title" placeholder="+ Швидка задача на сьогодні" required aria-label="Нова задача" />
          </form>
          <div className="panel-body">
            {focus.length ? <div className="list flat">{focus.map((x) => <TaskItem key={x.id} t={x} />)}</div>
              : <div className="panel-empty"><b>Все чисто</b><span>На сьогодні нічого. Подивись план тижня або додай задачу вище.</span></div>}
          </div>
        </div>

        {/* Колонка 2: тиждень і гроші */}
        <div className="panel-stack">
          <div className="panel panel-grow">
            <div className="panel-head"><h2>Навантаження на тиждень</h2><Link href="/tasks?view=week">план →</Link></div>
            <div className="vbars">
              {week.map((d) => {
                const dt = new Date(d.date);
                const n = d.tasks.length;
                return (
                  <Link key={d.date} href="/tasks?view=week" className={`vb ${d.date === today ? "on" : ""}`} title={d.tasks.map((x) => x.title).join("\n") || "вільно"}>
                    <span className="vb-n">{n || ""}</span>
                    <span className="vb-col"><i style={{ height: `${(n / weekMax) * 100}%` }} /></span>
                    <span className="vb-l">{d.date === today ? "сьог" : DAYS[dt.getDay()]}</span>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="panel panel-grow">
            <div className="panel-head"><h2>Отримано по місяцях</h2><span className="mono">{money(byMonth.reduce((s, x) => s + x.total, 0))} за 6 міс.</span></div>
            <div className="vbars money">
              {byMonth.map((x, i) => (
                <Link key={x.month} href="/money" className={`vb ${i === byMonth.length - 1 ? "on" : ""}`} title={`${monthLabel(x.month)}: ${money(x.total)}`}>
                  <span className="vb-n">{x.total ? money(x.total) : ""}</span>
                  <span className="vb-col"><i style={{ height: `${(x.total / monthMax) * 100}%` }} /></span>
                  <span className="vb-l">{monthLabel(x.month)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Колонка 3: увага */}
        <div className="panel-stack">
          <div className="panel panel-grow">
            <div className="panel-head"><h2>Потребують уваги</h2><span className="mono">{attention.length + broken.length}</span></div>
            <div className="panel-body">
              {broken.length > 0 && (
                <div className="list flat">
                  {broken.map((b) => (
                    <Link key={b.id} href={`/products/${b.id}?v=connect`} className="row">
                      <div className="row-main">
                        <div className="row-title"><Icon name="box" size={14} /> {b.name}</div>
                        <div className="meta"><span className="tag bad">поломок: {b.n}</span>{b.clients && <span className="tag">{b.clients}</span>}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {attention.length ? (
                <div className="list flat">
                  {attention.map(({ c, flags }) => (
                    <Link key={c.id} href={`/clients/${c.id}`} className="row">
                      <div className="row-main">
                        <div className="row-title">{c.name}</div>
                        <div className="meta">{flags.map((f) => <span key={f.text} className={`tag ${f.level}`}>{f.text}</span>)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : broken.length ? null : clients.length ? (
                <div className="panel-empty"><b>Усе під контролем</b><span>Нема прострочок, боргів і клієнтів без руху.</span></div>
              ) : (
                <div className="panel-empty row-empty"><span>Клієнтів ще нема</span><Link href="/clients/new" className="btn small">+ Перший клієнт</Link></div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
