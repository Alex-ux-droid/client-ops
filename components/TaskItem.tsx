import Link from "next/link";
import { setTask } from "@/app/actions";
import { fmtDate, ymd } from "@/lib/dates";
import type { TaskRow } from "@/lib/repo/tasks";
import TaskOpen from "./TaskOpen";

// Рядок задачі: галочка, назва, дати/клієнт/пріоритет, прогрес підзадач. Клік — вікно задачі з усім.
export default function TaskItem({ t, showClient = true }: { t: TaskRow; showClient?: boolean }) {
  const today = ymd();
  const done = t.status === "done";
  const overdue = !done && t.due_date && t.due_date < today;
  const isToday = !done && t.due_date === today;
  const total = t.items_total ?? 0, ok = t.items_done ?? 0;
  const firstLine = t.details.split("\n").find((l) => l.trim())?.replace(/[*`#>]/g, "").trim() ?? "";
  return (
    <div className={`row task-row ${t.priority === "high" && !done ? "prio-high" : ""}`}>
      <form action={setTask}>
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="status" value={done ? "todo" : "done"} />
        <button className={`check ${done ? "done" : ""}`} title={done ? "Повернути" : "Виконано"}>✓</button>
      </form>
      <TaskOpen id={t.id} className="row-main task-open">
        <div className="row-title" style={done ? { textDecoration: "line-through", color: "var(--dim)" } : undefined}>{t.title}</div>
        {firstLine && <div className="row-sub task-sub">{firstLine}</div>}
        <div className="meta">
          {t.priority === "high" && !done && <span className="tag bad">терміново</span>}
          {overdue && <span className="tag bad">прострочено · {fmtDate(t.due_date)}</span>}
          {isToday && <span className="tag accent">сьогодні</span>}
          {!overdue && !isToday && t.due_date && <span className="tag">{fmtDate(t.due_date)}</span>}
          {t.status === "doing" && <span className="tag warn">в роботі</span>}
          {total > 0 && (
            <span className={`task-prog ${ok === total ? "full" : ""}`} title={`Підзадачі: ${ok} з ${total}`}>
              <i><b style={{ width: `${(ok / total) * 100}%` }} /></i>{ok}/{total}
            </span>
          )}
          {t.details && <span className="task-ico" title="Є інструкція">📝</span>}
          {(t.links_count ?? 0) > 0 && <span className="task-ico" title="Посилання і файли">🔗 {t.links_count}</span>}
          {showClient && t.client_name && <Link href={`/clients/${t.client_id}`} className="tag">{t.client_name}</Link>}
        </div>
      </TaskOpen>
    </div>
  );
}
