import Link from "next/link";
import { addTask, confirmDecide, taskFromFlag } from "@/app/actions";
import { CONFIRM_UA, pendingConfirms } from "@/lib/repo/confirm";
import TaskItem from "@/components/TaskItem";
import Icon from "@/components/Icon";
import { crmStats } from "@/lib/crm";
import { productIssues } from "@/lib/products";
import { getCrmLink, listCrmLinks } from "@/lib/repo/crm";
import { accountsForClient, kyivDay, totals as metaTotals } from "@/lib/repo/meta";
import { getOrg, listProducts, openRequestCounts, productClients } from "@/lib/repo/products";
import { money } from "@/lib/config";
import { ymd } from "@/lib/dates";
import { monthLabel } from "@/lib/labels";
import { clientFlags, listClients, type Flag } from "@/lib/repo/clients";
import { pl } from "@/lib/plural";
import DebtRemind from "@/components/DebtRemind";
import { listPayments } from "@/lib/repo/payments";
import { mainMetricBrief } from "@/lib/repo/metrics";
import { moneySummary, receivedByMonth } from "@/lib/repo/payments";
import { listTasks, taskCounts } from "@/lib/repo/tasks";


function greeting(h: number) {
  return h < 5 ? "Доброї ночі" : h < 12 ? "Доброго ранку" : h < 18 ? "Доброго дня" : "Доброго вечора";
}

// Гроші і продажі — вище за рекламу і роботу
const score = (fs: Flag[]) => fs.filter((f) => f.level === "bad").length * 10 + (fs.some((f) => f.kind === "money" || f.kind === "sales") ? 5 : 0);

export default function Home() {
  const confirms = pendingConfirms();
  const todayK = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
  const debts = listPayments({ open: true }).filter((p) => p.due_date < todayK)
    .map((p) => ({ ...p, days: Math.round((Date.parse(todayK) - Date.parse(p.due_date)) / 86400_000) })).sort((a, b) => b.days - a.days);
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
    .sort((a, b) => score(b.flags) - score(a.flags));
  const m = moneySummary(today.slice(0, 7));
  const byMonth = receivedByMonth(6);
  const monthMax = Math.max(1, ...byMonth.map((x) => x.total));
  const todayTotal = t.today + t.overdue + t.doneToday;
  const planPct = m.mrr ? Math.min(100, Math.round((m.received / m.mrr) * 100)) : 0;
  const monthName = now.toLocaleDateString("uk-UA", { month: "long" });
  // Загальна картина: фокус організації, поломки наших продуктів, продажі клієнтів з CRM
  const orgFocus = (getOrg().focus || "").split("\n")[0].slice(0, 120);
  const reqOpen = openRequestCounts();
  const broken = listProducts().map((p) => { const i = productIssues(p.id); return { id: p.id, name: p.name, n: i.errors.reduce((a, x) => a + x.n, 0) + i.feedback.length, rq: reqOpen.get(p.id) ?? 0, clients: productClients(p.id).map((c) => c.name).join(", ") }; }).filter((x) => x.n > 0 || x.rq > 0);
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const crm = listCrmLinks().reduce((acc, l) => { const st = crmStats(l.client_id, since30); return { sales: acc.sales + st.sales, revenue: acc.revenue + st.revenue, cur: acc.cur || st.currency }; }, { sales: 0, revenue: 0, cur: "" });

  // «Зараз важливо» — топ-3 з того, що горить: поломки продуктів → борги → червоні тривоги клієнтів → прострочене → Підтверди
  const now3: { t: string; href: string; bad?: boolean; why: string }[] = [
    ...broken.filter((b) => b.n > 0).map((b) => ({ t: `${b.name}: ${pl(b.n, ["помилка", "помилки", "помилок"])}`, href: `/products/${b.id}?v=connect`, bad: true, why: "Поломка в нашому продукті — «Промпт: виправити» на вкладці Звʼязок" })),
    // борг — один пункт на клієнта (сума), а «борг по оплаті» з тривог цього ж клієнта не дублюємо
    ...[...new Map(debts.map((d) => [d.client_id, d])).values()].slice(0, 2).map((d) => {
      const sum = debts.filter((x) => x.client_id === d.client_id).reduce((a, x) => a + x.amount, 0);
      return { t: `${d.client_name}: борг ${money(sum)} · ${d.days} дн.`, href: `/clients/${d.client_id}?tab=money`, bad: true, why: "Прострочені оплати" };
    }),
    ...attention.flatMap((x) => x.flags.filter((f) => f.level === "bad" && !(f.kind === "money" && debts.some((d) => d.client_id === x.c.id))).slice(0, 1).map((f) => ({ t: `${x.c.name}: ${f.text}`, href: `/clients/${x.c.id}`, bad: true, why: f.reason ?? f.text }))),
    ...(t.overdue ? [{ t: `${pl(t.overdue, ["задача", "задачі", "задач"])} прострочено`, href: "/tasks?view=overdue", why: "Прострочені задачі" }] : []),
    ...(confirms.length ? [{ t: `Підтверди: ${confirms.length}`, href: "#confirm", why: "Джері знайшов у переписці — ✓ або ✕" }] : []),
  ].slice(0, 3);

  // Пульс клієнтів: ліди і ціна ліда 7/7, продажі 30 дн., головна метрика
  const delta = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
  const pulse = active.map((c) => {
    const hasMeta = accountsForClient(c.id).length > 0;
    const w = hasMeta ? metaTotals(c.id, kyivDay(6), kyivDay(0)) : null, p = hasMeta ? metaTotals(c.id, kyivDay(13), kyivDay(7)) : null;
    const cpl = w && w.leads ? w.spend / w.leads : null, cplP = p && p.leads ? p.spend / p.leads : null;
    const leadsD = w && p ? delta(w.leads, p.leads) : null, cplD = cpl != null && cplP != null ? delta(cpl, cplP) : null;
    const st = getCrmLink(c.id) ? crmStats(c.id, since30) : null;
    return {
      id: c.id, name: c.name, leads: w ? w.leads : null, leadsD, cpl: cpl != null ? money(cpl) : null, cplD,
      leadsTone: leadsD != null && leadsD <= -20 ? "bad" : leadsD != null && leadsD >= 20 ? "ok" : "",
      cplTone: cplD != null && cplD >= 20 ? "bad" : cplD != null && cplD <= -15 ? "ok" : "",
      sales: st ? st.sales : null, main: mainMetricBrief(c.id),
    };
  }).filter((r) => r.leads != null || r.sales != null || r.main);

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
          {now3.length ? (
            <div className="dash-now" aria-label="Зараз важливо">
              <span className="dash-now-h">Зараз важливо</span>
              {now3.map((x, i) => <Link key={i} href={x.href} className={`dash-now-i${x.bad ? " bad" : ""}`} title={x.why}><b>{i + 1}</b> {x.t}</Link>)}
            </div>
          ) : <div className="dash-brief">{brief} · усе чисто</div>}
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
          <div className="kpi-sub">{m.overdue ? `${pl(m.overdueCount, ["оплата прострочена", "оплати прострочено", "оплат прострочено"])}` : `ще очікую ${money(m.expected)}`}</div>
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
          {/* Пульс клієнтів: цифри тиждень до тижня — де просідає, видно кольором (22.11: «мені потрібна конкретика цифр») */}
          <div className="panel panel-grow">
            <div className="panel-head"><h2>Пульс клієнтів</h2><span className="mono">7 дн. проти попередніх 7</span></div>
            <div className="pulse panel-body">
              {pulse.length ? pulse.map((r) => (
                <Link key={r.id} href={`/clients/${r.id}`} className="pulse-row">
                  <b className="pulse-name">{r.name}</b>
                  <span className={`pulse-c ${r.leadsTone}`} title="Ліди з реклами за 7 днів"><small>ліди</small>{r.leads ?? "—"}{r.leadsD != null && <em>{r.leadsD > 0 ? "↑" : r.leadsD < 0 ? "↓" : ""}{Math.abs(r.leadsD)}%</em>}</span>
                  <span className={`pulse-c ${r.cplTone}`} title="Ціна ліда за 7 днів"><small>ціна ліда</small>{r.cpl ?? "—"}{r.cplD != null && <em>{r.cplD > 0 ? "↑" : r.cplD < 0 ? "↓" : ""}{Math.abs(r.cplD)}%</em>}</span>
                  <span className={`pulse-c ${r.sales != null && r.sales === 0 ? "bad" : r.sales ? "ok" : ""}`} title="Продажі в CRM за 30 днів"><small>продажі 30 дн.</small>{r.sales ?? "—"}</span>
                  {r.main && <span className={`pulse-m ${r.main.tone}`} title={r.main.title}>★ {r.main.text}</span>}
                </Link>
              )) : <p className="mono">Активних клієнтів з рекламою чи CRM ще нема.</p>}
            </div>
          </div>
          <div className="panel panel-grow">
            <div className="panel-head"><h2>Отримано по місяцях</h2><span className="mono">{money(byMonth.reduce((s, x) => s + x.total, 0))} за 6 міс.</span></div>
            {byMonth.every((x) => !x.total) ? <p className="mono" style={{ margin: "0.75rem 0 0" }}>Оплат ще не записано. Записуй одним натиском: «💸 Оплатив» у ранковому зведенні в Telegram або скажи Джері «Аква Віта заплатила 450».</p> : <div className="vbars money">
              {byMonth.map((x, i) => (
                <Link key={x.month} href="/money" className={`vb ${i === byMonth.length - 1 ? "on" : ""}`} title={`${monthLabel(x.month)}: ${money(x.total)}`}>
                  <span className="vb-n">{x.total ? money(x.total) : ""}</span>
                  <span className="vb-col"><i style={{ height: `${(x.total / monthMax) * 100}%` }} /></span>
                  <span className="vb-l">{monthLabel(x.month)}</span>
                </Link>
              ))}
            </div>}
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
                    <Link key={b.id} href={`/products/${b.id}?v=${b.rq ? "requests" : "connect"}`} className="row">
                      <div className="row-main">
                        <div className="row-title"><Icon name="box" size={14} /> {b.name}</div>
                        <div className="meta">{b.rq > 0 && <span className="tag warn">правок: {b.rq}</span>}{b.n > 0 && <span className="tag bad">поломок: {b.n}</span>}{b.clients && <span className="tag">{b.clients}</span>}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {debts.length > 0 && (
                <div className="cf-list">
                  <div className="cf-h" title="Прострочені оплати. «Нагадування» — чернетка за шаблоном «Оплата»: копіюєш або собі в Telegram; клієнту само нічого не йде"><Icon name="wallet" size={14} /> Борги <span className="muted">{pl(debts.length, ["оплата", "оплати", "оплат"])}</span></div>
                  {debts.slice(0, 5).map((p) => (
                    <div key={p.id} className="cf-row">
                      <div className="cf-main">
                        <div><Link href={`/clients/${p.client_id}?tab=money`}>{p.client_name}</Link>: <b>{money(p.amount)}</b></div>
                        <div className="cf-ev">прострочено {pl(p.days, ["день", "дні", "днів"])}{p.note ? ` · ${p.note}` : ""}</div>
                      </div>
                      <DebtRemind clientId={p.client_id} clientName={p.client_name} note={`Нагадати про оплату ${money(p.amount)} — мала бути ${p.due_date.split("-").reverse().join(".")} (${pl(p.days, ["день", "дні", "днів"])} тому)${p.note ? `, ${p.note}` : ""}. Ввічливо, без тиску.`} />
                    </div>
                  ))}
                  {debts.length > 5 && <Link href="/money" className="cf-ev">ще {debts.length - 5} → Гроші</Link>}
                </div>
              )}
              {confirms.length > 0 && (
                <div id="confirm" className="cf-list">
                  <div className="cf-h" title="Джері звірив задачі з перепискою груп. ✓ — система зробить, ✕ — відкинути"><Icon name="check" size={14} /> Підтверди <span className="muted">{confirms.length}</span></div>
                  {confirms.slice(0, 6).map((q) => (
                    <div key={q.id} className="cf-row">
                      <div className="cf-main">
                        <div><span className={`tag ${q.kind === "task_new" ? "warn" : q.kind === "task_done" ? "ok" : ""}`}>{CONFIRM_UA[q.kind]}</span> <Link href={`/clients/${q.client_id}`}>{q.client_name}</Link>: {q.title}</div>
                        {q.evidence && <div className="cf-ev">{q.evidence}</div>}
                      </div>
                      <form action={confirmDecide} className="cf-btns">
                        <input type="hidden" name="id" value={q.id} />
                        <button name="op" value="ok" className="small" title={q.kind === "task_done" ? "Закрити задачу + в історію" : q.kind === "task_new" ? "Створити задачу" : "Записати в історію"}>✓</button>
                        <button name="op" value="skip" className="ghost small" title="Не те — відкинути">✕</button>
                      </form>
                    </div>
                  ))}
                  {confirms.length > 6 && <div className="cf-ev">ще {confirms.length - 6} — спитай Джері «що в черзі Підтверди?»</div>}
                </div>
              )}
              {attention.length ? (
                <div className="list flat">
                  {attention.map(({ c, flags }) => (
                    <div key={c.id} className="row att-row">
                      <Link href={`/clients/${c.id}`} className="row-main">
                        <div className="row-title">{c.name}</div>
                        <div className="meta">
                          {(() => { const ns = mainMetricBrief(c.id); return ns ? <span className={`tag ${ns.tone}`} title={ns.title}>★ {ns.text}</span> : null; })()}
                          {flags.map((f) => <span key={f.text} className={`tag ${f.level}`} title={f.reason}>{f.text}</span>)}
                        </div>
                      </Link>
                      <form action={taskFromFlag}>
                        <input type="hidden" name="client_id" value={c.id} />
                        <input type="hidden" name="text" value={flags[0].text} />
                        <input type="hidden" name="reason" value={flags.map((f) => `- ${f.text}${f.reason ? ` — ${f.reason}` : ""}`).join("\n")} />
                        <input type="hidden" name="level" value={flags[0].level} />
                        <button className="ghost small att-task" title={`Створити задачу: «${flags[0].text}»`}>+ задача</button>
                      </form>
                    </div>
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
