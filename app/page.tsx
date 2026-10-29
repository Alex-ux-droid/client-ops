import Link from "next/link";
import AddTask from "@/components/AddTask";
import TaskItem from "@/components/TaskItem";
import { saveIdea } from "@/app/actions";
import { fmtDate } from "@/lib/dates";
import { listClients } from "@/lib/repo/clients";
import { listIdeas } from "@/lib/repo/ideas";
import { listTasks, taskCounts } from "@/lib/repo/tasks";
import { listWork } from "@/lib/repo/worklog";

export const dynamic = "force-dynamic";

export default function Home() {
  const counts = taskCounts();
  const focus = [...listTasks("overdue"), ...listTasks("today")];
  const clients = listClients();
  const active = clients.filter((c) => c.status === "active" || c.status === "lead");
  const work = listWork(undefined, 5);
  const ideas = listIdeas({ status: "new" }).slice(0, 3);
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
        <Link href="/tasks?view=overdue" className="stat" style={{ "--c": counts.overdue ? "var(--bad)" : undefined } as React.CSSProperties}>
          <div className="n">{counts.overdue}</div><div className="l">Прострочено</div>
        </Link>
        <Link href="/tasks?view=today" className="stat" style={{ "--c": "var(--accent)" } as React.CSSProperties}>
          <div className="n">{counts.today}</div><div className="l">Сьогодні</div>
        </Link>
        <Link href="/tasks?view=week" className="stat" style={{ "--c": "var(--cyan)" } as React.CSSProperties}>
          <div className="n">{counts.week}</div><div className="l">Ще цього тижня</div>
        </Link>
        <div className="stat" style={{ "--c": "var(--ok)" } as React.CSSProperties}>
          <div className="n">{counts.doneWeek}</div><div className="l">Зроблено за 7 днів</div>
        </div>
      </div>

      <div className="section">
        <h2>Фокус на сьогодні <Link href="/tasks">всі →</Link></h2>
        <div className="list">
          {focus.length ? focus.map((t) => <TaskItem key={t.id} t={t} />) : <div className="empty">На сьогодні все чисто.</div>}
        </div>
      </div>

      <div className="section">
        <h2>Швидко додати</h2>
        <div className="grid2">
          <AddTask clients={clients} />
          <form action={saveIdea} className="card">
            <div className="field"><input name="text" placeholder="Ідея, щоб не забути…" required /></div>
            <div className="inline">
              <select name="client_id" defaultValue="">
                <option value="">Загальна</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button>✦</button>
            </div>
          </form>
        </div>
      </div>

      <div className="section">
        <h2>Клієнти в роботі <Link href="/clients">всі →</Link></h2>
        <div className="list">
          {active.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="row">
              <div className="row-main">
                <div className="row-title">{c.name}</div>
                <div className="row-sub">{c.offer || c.niche}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ color: c.open_tasks ? "var(--accent)" : undefined }}>{c.open_tasks} задач</div>
                <div className="mono">{c.last_work ? fmtDate(c.last_work) : "—"}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid2 section">
        <div>
          <h2 style={{ marginBottom: 10 }}>Останні роботи</h2>
          <div className="list timeline">
            {work.length ? work.map((w) => (
              <div key={w.id} className="row">
                <div className="row-main">
                  <div className="row-title">{w.what}</div>
                  <div className="row-sub">{w.client_name} · {fmtDate(w.done_at)}{w.result ? ` · ${w.result}` : ""}</div>
                </div>
              </div>
            )) : <div className="empty">Ще нічого не записано.</div>}
          </div>
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
