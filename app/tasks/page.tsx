import Link from "next/link";
import AddTask from "@/components/AddTask";
import TaskItem from "@/components/TaskItem";
import { listClients } from "@/lib/repo/clients";
import { listTasks, taskCounts, type TaskView } from "@/lib/repo/tasks";

export const dynamic = "force-dynamic";

const VIEWS: { v: TaskView; label: string }[] = [
  { v: "today", label: "Сьогодні" },
  { v: "overdue", label: "Прострочені" },
  { v: "week", label: "Тиждень" },
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
      <div className="list" style={{ marginTop: 12 }}>
        {tasks.length ? tasks.map((t) => <TaskItem key={t.id} t={t} />) : <div className="empty">Порожньо.</div>}
      </div>
      {view === "today" && <div className="mono" style={{ marginTop: 10 }}>У «Сьогодні» також видно прострочені.</div>}
    </>
  );
}
