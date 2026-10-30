import Link from "next/link";
import {
  attachPlaybookAction, detachPlaybookAction, logWork, playbookToTasks, removeMaterial, removeWork,
  saveMaterial, savePayment, toggleItem,
} from "@/app/actions";
import AddTask from "@/components/AddTask";
import PaymentRow from "@/components/PaymentRow";
import TaskItem from "@/components/TaskItem";
import { money } from "@/lib/config";
import { fmtDate, ymd } from "@/lib/dates";
import { KIND_LABEL } from "@/lib/labels";
import { listMaterials, MATERIAL_KINDS } from "@/lib/repo/materials";
import { listPayments } from "@/lib/repo/payments";
import { checklistItems, clientPlaybooks, listPlaybooks } from "@/lib/repo/playbooks";
import { listTasks } from "@/lib/repo/tasks";
import { listWork } from "@/lib/repo/worklog";

export function TasksTab({ id }: { id: number }) {
  const open = listTasks("all", id);
  const doneList = listTasks("done", id).slice(0, 10);
  return (
    <>
      <AddTask clientId={id} />
      <div className="list" style={{ marginTop: 10 }}>{open.length ? open.map((t) => <TaskItem key={t.id} t={t} showClient={false} />) : <div className="empty">Відкритих задач нема.</div>}</div>
      {doneList.length > 0 && (
        <div className="section"><h2 style={{ marginBottom: 10 }}>Нещодавно закриті</h2><div className="list">{doneList.map((t) => <TaskItem key={t.id} t={t} showClient={false} />)}</div></div>
      )}
    </>
  );
}

export function HistoryTab({ id }: { id: number }) {
  const work = listWork(id, 200);
  return (
    <>
      <details className="card" style={{ marginBottom: 10 }} open={!work.length}>
        <summary className="mono" style={{ color: "var(--link)" }}>+ записати що зробили</summary>
        <form action={logWork} className="stack" style={{ marginTop: 12 }}>
          <input type="hidden" name="client_id" value={id} />
          <input name="what" placeholder="Що зробив" required aria-label="Що зробив" />
          <input name="why" placeholder="Чому / навіщо" aria-label="Чому" />
          <input name="result" placeholder="Результат" aria-label="Результат" />
          <div className="inline"><input type="date" name="done_at" defaultValue={ymd()} aria-label="Дата" /><button>Записати</button></div>
        </form>
      </details>
      <div className="list timeline">
        {work.length ? work.map((w) => (
          <div key={w.id} className="row">
            <div className="row-main">
              <div className="mono">{fmtDate(w.done_at)}{w.task_id ? " · із задачі" : ""}</div>
              <div className="row-title">{w.what}</div>
              {w.why && <div className="row-sub">Чому: {w.why}</div>}
              {w.result && <div className="row-sub" style={{ color: "var(--ok)" }}>Результат: {w.result}</div>}
            </div>
            <form action={removeWork}><input type="hidden" name="id" value={w.id} /><button className="ghost small" title="Видалити">✕</button></form>
          </div>
        )) : <div className="empty">Історії ще нема.</div>}
      </div>
    </>
  );
}

export function MoneyTab({ id, fee, payDay, paidTotal }: { id: number; fee: number; payDay: number; paidTotal: number }) {
  const payments = listPayments({ clientId: id });
  return (
    <div className="split">
      <div>
        <div className="list">{payments.length ? payments.map((p) => <PaymentRow key={p.id} p={p} showClient={false} />) : <div className="empty">Оплат ще нема.</div>}</div>
      </div>
      <div className="stack">
        <div className="card mono">
          {fee ? `Щомісяця ${money(fee)}, день оплати ${payDay}.` : "Щомісячна оплата не вказана (Редагувати → «Платить щомісяця»)."} Всього отримано {money(paidTotal)}.
        </div>
        <form action={savePayment} className="card stack">
          <input type="hidden" name="client_id" value={id} />
          <div className="inline">
            <input name="amount" inputMode="decimal" placeholder="Сума" required defaultValue={fee || ""} aria-label="Сума" />
            <input type="date" name="due_date" defaultValue={ymd()} aria-label="Дата" />
          </div>
          <label className="check-line"><input type="checkbox" name="paid" value="1" defaultChecked /> Вже отримав</label>
          <input name="note" placeholder="Коментар" aria-label="Коментар" />
          <button>Додати оплату</button>
        </form>
      </div>
    </div>
  );
}

export function MaterialsTab({ id }: { id: number }) {
  const materials = listMaterials(id);
  return (
    <>
      <details className="card" style={{ marginBottom: 10 }} open={!materials.length}>
        <summary className="mono" style={{ color: "var(--link)" }}>+ вставити чат, звіт або бриф</summary>
        <form action={saveMaterial} className="stack" style={{ marginTop: 12 }}>
          <input type="hidden" name="client_id" value={id} />
          <div className="inline">
            <select name="kind" defaultValue="chat" style={{ maxWidth: 140 }} aria-label="Тип">
              {MATERIAL_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <input name="title" placeholder="Назва (необов'язково)" aria-label="Назва" />
          </div>
          <textarea name="content" placeholder="Встав сюди переписку з клієнтом, цифри з кабінету, бриф…" required style={{ minHeight: 160 }} aria-label="Текст" />
          <button>Зберегти</button>
        </form>
      </details>
      <div className="list">
        {materials.length ? materials.map((m) => (
          <details key={m.id} className="row" style={{ display: "block" }}>
            <summary>
              <div className="row-title">{m.title}</div>
              <div className="meta"><span className="tag">{KIND_LABEL[m.kind]}</span><span className="mono">{fmtDate(m.created_at)}</span></div>
            </summary>
            <pre className="material">{m.content}</pre>
            <form action={removeMaterial} style={{ marginTop: 8 }}><input type="hidden" name="id" value={m.id} /><button className="ghost small">Видалити</button></form>
          </details>
        )) : <div className="empty">Матеріалів нема.</div>}
      </div>
    </>
  );
}

export function PlaybooksTab({ id }: { id: number }) {
  const attached = clientPlaybooks(id);
  const free = listPlaybooks().filter((p) => !attached.some((a) => a.playbook_id === p.id));
  return (
    <>
      {free.length > 0 && (
        <form action={attachPlaybookAction} className="inline" style={{ marginBottom: 14 }}>
          <input type="hidden" name="client_id" value={id} />
          <select name="playbook_id" required defaultValue="" aria-label="Плейбук">
            <option value="">Підключити плейбук…</option>
            {free.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.items})</option>)}
          </select>
          <button>Підключити</button>
        </form>
      )}
      <div className="stack" style={{ gap: 12 }}>
        {attached.length ? attached.map((cp) => {
          const items = checklistItems(cp.body_md);
          const pct = items.length ? Math.round((cp.checked.length / items.length) * 100) : 0;
          return (
            <div key={cp.id} className="card">
              <div className="hub-top" style={{ marginBottom: 8 }}>
                <Link href={`/playbooks/${cp.playbook_id}`} className="row-title">{cp.title}</Link>
                <span className="mono">{cp.checked.length}/{items.length} · {pct}%</span>
              </div>
              <div className={`bar ${pct === 100 ? "ok" : ""}`} style={{ marginBottom: 8 }}><i style={{ width: `${pct}%` }} /></div>
              {items.map((it, i) => {
                const on = cp.checked.includes(i);
                return (
                  <form key={i} action={toggleItem} className={`check-item ${on ? "done" : ""}`}>
                    <input type="hidden" name="id" value={cp.id} />
                    <input type="hidden" name="index" value={i} />
                    <button className={`check ${on ? "done" : ""}`}>✓</button>
                    <span>{it}</span>
                  </form>
                );
              })}
              <div className="inline" style={{ marginTop: 10, flexWrap: "wrap" }}>
                {pct < 100 && (
                  <form action={playbookToTasks} className="inline">
                    <input type="hidden" name="id" value={cp.id} />
                    <input type="hidden" name="client_id" value={id} />
                    <input type="date" name="due_date" defaultValue={ymd()} aria-label="Дедлайн" style={{ maxWidth: 160 }} />
                    <button className="ghost small">Решту → в задачі</button>
                  </form>
                )}
                <form action={detachPlaybookAction}><input type="hidden" name="id" value={cp.id} /><button className="ghost small">Відключити</button></form>
              </div>
            </div>
          );
        }) : <div className="empty card">Жоден плейбук не підключено. {free.length ? "Обери вище." : <Link href="/playbooks/new" style={{ color: "var(--link)" }}>Створи перший →</Link>}</div>}
      </div>
    </>
  );
}
