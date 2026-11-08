import Link from "next/link";
import { notFound } from "next/navigation";
import { applyPlaybookAction, attachPlaybookAction, playbookStepAction, removePlaybook } from "@/app/actions";
import { ymd } from "@/lib/dates";
import Markdown from "@/components/Markdown";
import { clientOptions } from "@/lib/repo/counts";
import { checklistItems, getPlaybook, playbookClients, playbookSteps } from "@/lib/repo/playbooks";

export default async function PlaybookPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const p = getPlaybook(id);
  if (!p) notFound();
  const steps = playbookSteps(id);
  const total = checklistItems(p.body_md).length;
  const used = playbookClients(id);
  const free = clientOptions().filter((c) => !used.some((u) => u.client_id === c.id));
  return (
    <>
      <div className="head">
        <div><div className="kicker"><Link href="/playbooks">Плейбуки</Link> · {steps.length ? `${steps.length} кроків` : `${total} пунктів`}</div><h1>{p.title}</h1>{p.description && <div className="mono">{p.description}</div>}</div>
        <Link href={`/playbooks/${id}/edit`} className="btn ghost">Редагувати</Link>
      </div>
      <div className="split">
        <div className="stack" style={{ gap: 16 }}>
          <div className="card stack" style={{ gap: "0.5rem" }}>
            <b>Кроки {steps.length ? `· ${steps.length}` : ""}</b>
            <span className="mono">Кожен крок → задача клієнту з дедлайном «старт + N днів».</span>
            {steps.map((s, i) => (
              <details key={s.id} className="pb-step">
                <summary><span className="pb-day">день {s.offset_days}</span> <b>{i + 1}. {s.title}</b>{s.minutes ? <span className="mono"> · ~{s.minutes} хв</span> : null}</summary>
                <form action={playbookStepAction} className="stack" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>
                  <input type="hidden" name="playbook_id" value={id} /><input type="hidden" name="step_id" value={s.id} />
                  <input name="title" defaultValue={s.title} required aria-label="Назва кроку" />
                  <textarea name="description" defaultValue={s.description} rows={3} placeholder="Що зробити, посилання, на що звернути увагу" />
                  <div className="pb-nums"><label>Хв<input name="minutes" defaultValue={s.minutes || ""} inputMode="numeric" /></label><label>День від старту<input name="offset_days" defaultValue={s.offset_days} inputMode="numeric" /></label></div>
                  <div className="inline" style={{ flexWrap: "wrap" }}>
                    <button className="small">Зберегти</button>
                    <button name="op" value="up" className="ghost small" formNoValidate>↑</button>
                    <button name="op" value="down" className="ghost small" formNoValidate>↓</button>
                    <button name="op" value="delete" className="ghost small danger-text" formNoValidate>Видалити</button>
                  </div>
                </form>
              </details>
            ))}
            <form action={playbookStepAction} className="stack pb-new" style={{ gap: "0.5rem" }}>
              <input type="hidden" name="playbook_id" value={id} />
              <input name="title" required placeholder="Новий крок: напр. «Зібрати бриф у клієнта»" aria-label="Новий крок" />
              <div className="pb-nums"><label>Хв<input name="minutes" inputMode="numeric" placeholder="30" /></label><label>День від старту<input name="offset_days" inputMode="numeric" placeholder="0" /></label></div>
              <div><button className="small">+ Крок</button></div>
            </form>
          </div>
          {p.body_md.trim() && <div className="card"><Markdown md={p.body_md} /></div>}
        </div>
        <div className="stack" style={{ gap: 16 }}>
          {steps.length > 0 && (
            <form action={applyPlaybookAction} className="card stack">
              <input type="hidden" name="playbook_id" value={id} />
              <b>Застосувати до клієнта</b>
              <select name="client_id" required defaultValue="" aria-label="Клієнт">
                <option value="">Клієнт…</option>
                {clientOptions().map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label className="mono">Старт <input type="date" name="start" defaultValue={ymd()} /></label>
              <button>Створити {steps.length} задач</button>
              <span className="mono">Повторно — додасть лише нові кроки, без дублів.</span>
            </form>
          )}
          {free.length > 0 && !steps.length && (
            <form action={attachPlaybookAction} className="card stack">
              <input type="hidden" name="playbook_id" value={id} />
              <select name="client_id" required defaultValue="" aria-label="Клієнт">
                <option value="">Застосувати до клієнта…</option>
                {free.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button>Підключити</button>
            </form>
          )}
          <div>
            <h2 style={{ marginBottom: 10 }}>Де використовується</h2>
            <div className="list">
              {used.length ? used.map((u) => {
                const pct = total ? Math.round((u.checked / total) * 100) : 0;
                return (
                  <Link key={u.client_id} href={`/clients/${u.client_id}?tab=playbooks`} className="row" style={{ display: "block" }}>
                    <div className="hub-top" style={{ marginBottom: 6 }}><span className="row-title">{u.name}</span><span className="mono">{u.checked}/{total}</span></div>
                    <div className={`bar ${pct === 100 ? "ok" : ""}`}><i style={{ width: `${pct}%` }} /></div>
                  </Link>
                );
              }) : <div className="empty">Ще ні в кого.</div>}
            </div>
          </div>
          <form action={removePlaybook}>
            <input type="hidden" name="id" value={id} />
            <button className="ghost small">Видалити плейбук</button>
          </form>
        </div>
      </div>
    </>
  );
}
