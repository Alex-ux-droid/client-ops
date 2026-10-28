import Link from "next/link";
import { closeTaskWithLog, setTask } from "@/app/actions";
import { fmtDate, ymd } from "@/lib/dates";
import type { TaskRow } from "@/lib/repo/tasks";

export default function TaskItem({ t, showClient = true }: { t: TaskRow; showClient?: boolean }) {
  const today = ymd();
  const done = t.status === "done";
  const overdue = !done && t.due_date && t.due_date < today;
  const isToday = !done && t.due_date === today;
  return (
    <div className="row">
      <form action={setTask}>
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="status" value={done ? "todo" : "done"} />
        <button className={`check ${done ? "done" : ""}`} title={done ? "Повернути" : "Виконано"}>✓</button>
      </form>
      <div className="row-main">
        <div className="row-title" style={done ? { textDecoration: "line-through", color: "var(--dim)" } : undefined}>{t.title}</div>
        {t.details && <div className="row-sub">{t.details}</div>}
        <div className="meta">
          {overdue && <span className="tag bad">прострочено · {fmtDate(t.due_date)}</span>}
          {isToday && <span className="tag accent">сьогодні</span>}
          {!overdue && !isToday && t.due_date && <span className="tag">{fmtDate(t.due_date)}</span>}
          {t.status === "doing" && <span className="tag warn">в роботі</span>}
          {showClient && t.client_name && <Link href={`/clients/${t.client_id}`} className="tag">{t.client_name}</Link>}
        </div>
        {!done && (
          <details className="close-log-wrap">
            <summary className="mono" style={{ marginTop: 8, color: "var(--cyan)" }}>▸ закрити + записати що зробили</summary>
            <form action={closeTaskWithLog} className="close-log">
              <input type="hidden" name="id" value={t.id} />
              <div className="field"><input name="what" placeholder="Що зробив" defaultValue={t.title} /></div>
              <div className="field"><input name="why" placeholder="Чому / навіщо" /></div>
              <div className="field"><input name="result" placeholder="Результат" /></div>
              {!t.client_id && <div className="mono" style={{ marginBottom: 10 }}>Задача без клієнта: в історію не піде, просто закриється.</div>}
              <button>Закрити задачу</button>
            </form>
          </details>
        )}
      </div>
    </div>
  );
}
