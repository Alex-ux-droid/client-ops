import Link from "next/link";
import AddTask from "@/components/AddTask";
import TaskItem from "@/components/TaskItem";
import { listClients } from "@/lib/repo/clients";
import { listTasks, taskCounts, weekPlan, type TaskView } from "@/lib/repo/tasks";
import { ymd } from "@/lib/dates";

export const dynamic = "force-dynamic";

const VIEWS: { v: TaskView; label: string }[] = [
  { v: "today", label: "Сьогодні" },
  { v: "overdue", label: "Прострочені" },
  { v: "week", label: "Тиждень по днях" },
  { v: "later", label: "Пізніше" },
  { v: "all", label: "Всі" },
  { v: "done", label: "Виконані" },
];

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: raw } = await searchParams;
  const view = (VIEWS.find((x) => x.v === raw)?.v ?? "today") as TaskView;
  const counts = taskCounts();
  const badge: Partial<Record<TaskView, number>> = { today: counts.today, overdue: counts.overdue, week: counts.week, all: counts.open };
  const tasks = view === "today" ? [...listTasks("overdue"), ...listTasks("today")] : listTasks(view);

  return (
    <>
      <div className="head"><div><div className="kicker">Задачі</div><h1>Що робимо</h1></div></div>
      <div className="tabs">
        {VIEWS.map((x) => (
          <Link key={x.v} href={`/tasks?view=${x.v}`} className={x.v === view ? "on" : ""}>
            {x.label}{badge[x.v] ? <b>{badge[x.v]}</b> : null}
          </Link>
        ))}
      </div>
      <AddTask clients={listClients()} />
      {view === "week" ? (
        <div className="stack" style={{ marginTop: 12, gap: 16 }}>
          {weekPlan().map((d) => (
            <div key={d.date}>
              <h2 style={{ marginBottom: 8, color: d.date === ymd() ? "var(--accent)" : undefined }}>
                {new Date(d.date).toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" })}
                <span className="mono">{d.tasks.length}</span>
              </h2>
              <div className="list">{d.tasks.length ? d.tasks.map((t) => <TaskItem key={t.id} t={t} />) : <div className="empty">Вільно.</div>}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="list" style={{ marginTop: 12 }}>
          {tasks.length ? tasks.map((t) => <TaskItem key={t.id} t={t} />) : <div className="empty">Порожньо.</div>}
        </div>
      )}
      {view === "today" && <div className="mono" style={{ marginTop: 10 }}>У «Сьогодні» також видно прострочені.</div>}
    </>
  );
}
