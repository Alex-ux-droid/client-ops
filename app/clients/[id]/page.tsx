import Link from "next/link";
import { notFound } from "next/navigation";
import AddTask from "@/components/AddTask";
import TaskItem from "@/components/TaskItem";
import { logWork, removeMaterial, saveIdea, saveMaterial } from "@/app/actions";
import { fmtDate, ymd } from "@/lib/dates";
import { KIND_LABEL, STATUS_LABEL, STATUS_TAG } from "@/lib/labels";
import { getClient } from "@/lib/repo/clients";
import { listIdeas } from "@/lib/repo/ideas";
import { listMaterials, MATERIAL_KINDS } from "@/lib/repo/materials";
import { listTasks } from "@/lib/repo/tasks";
import { listWork } from "@/lib/repo/worklog";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const c = getClient(id);
  if (!c) notFound();
  const tasks = listTasks("all", id);
  const work = listWork(id);
  const ideas = listIdeas({ clientId: id });
  const materials = listMaterials(id);
  const here = `/clients/${id}`;

  return (
    <>
      <div className="head">
        <div>
          <div className="kicker">{c.niche || "клієнт"}</div>
          <h1>{c.name}</h1>
          <div className="meta">
            <span className={`tag ${STATUS_TAG[c.status]}`}>{STATUS_LABEL[c.status]}</span>
            {c.budget && <span className="tag accent">{c.budget}</span>}
          </div>
        </div>
        <Link href={`${here}/edit`} className="btn ghost">Редагувати</Link>
      </div>

      <div className="grid2">
        <dl className="card kv">
          <div><dt>Що продаємо</dt><dd>{c.offer}</dd></div>
          <div><dt>Що хоче клієнт</dt><dd>{c.needs}</dd></div>
          <div><dt>Контакти</dt><dd>{c.contacts}</dd></div>
          <div><dt>Bitwarden</dt><dd>{c.bitwarden_ref}</dd></div>
        </dl>
        <dl className="card kv">
          <div><dt>Бачення клієнта</dt><dd>{c.client_vision}</dd></div>
          <div><dt style={{ color: "var(--accent)" }}>Моє бачення</dt><dd>{c.my_vision}</dd></div>
          <div><dt>Нотатки</dt><dd>{c.notes}</dd></div>
        </dl>
      </div>

      <div className="section">
        <h2>Задачі</h2>
        <AddTask clientId={id} />
        <div className="list" style={{ marginTop: 8 }}>
          {tasks.length ? tasks.map((t) => <TaskItem key={t.id} t={t} showClient={false} />) : <div className="empty">Відкритих задач нема.</div>}
        </div>
      </div>

      <div className="section">
        <h2>Історія робіт</h2>
        <details className="card" style={{ marginBottom: 8 }}>
          <summary className="mono" style={{ color: "var(--cyan)" }}>+ записати що зробили</summary>
          <form action={logWork} style={{ marginTop: 12 }}>
            <input type="hidden" name="client_id" value={id} />
            <div className="field"><input name="what" placeholder="Що зробив" required /></div>
            <div className="field"><input name="why" placeholder="Чому / навіщо" /></div>
            <div className="field"><input name="result" placeholder="Результат" /></div>
            <div className="inline"><input type="date" name="done_at" defaultValue={ymd()} /><button>Записати</button></div>
          </form>
        </details>
        <div className="list timeline">
          {work.length ? work.map((w) => (
            <div key={w.id} className="row">
              <div className="row-main">
                <div className="mono">{fmtDate(w.done_at)}</div>
                <div className="row-title">{w.what}</div>
                {w.why && <div className="row-sub">Чому: {w.why}</div>}
                {w.result && <div className="row-sub" style={{ color: "var(--ok)" }}>Результат: {w.result}</div>}
              </div>
            </div>
          )) : <div className="empty">Історії ще нема.</div>}
        </div>
      </div>

      <div className="section">
        <h2>Матеріали: чати, реклама, брифи</h2>
        <details className="card" style={{ marginBottom: 8 }}>
          <summary className="mono" style={{ color: "var(--cyan)" }}>+ вставити матеріал</summary>
          <form action={saveMaterial} style={{ marginTop: 12 }}>
            <input type="hidden" name="client_id" value={id} />
            <div className="inline field">
              <select name="kind" defaultValue="chat" style={{ maxWidth: 140 }}>
                {MATERIAL_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
              <input name="title" placeholder="Назва (необов'язково)" />
            </div>
            <div className="field"><textarea name="content" placeholder="Встав сюди чат з клієнтом, цифри з рекламного кабінету…" required style={{ minHeight: 140 }} /></div>
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
              <form action={removeMaterial} style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="back" value={here} />
                <button className="ghost small">Видалити</button>
              </form>
            </details>
          )) : <div className="empty">Матеріалів нема.</div>}
        </div>
      </div>

      <div className="section">
        <h2>Ідеї по клієнту</h2>
        <form action={saveIdea} className="inline" style={{ marginBottom: 8 }}>
          <input type="hidden" name="client_id" value={id} />
          <input name="text" placeholder="Ідея…" required />
          <button>✦</button>
        </form>
        <div className="list">
          {ideas.length ? ideas.map((i) => (
            <div key={i.id} className="row"><div className="row-main"><div className="row-title">{i.text}</div><div className="meta"><span className="tag">{i.status === "new" ? "нова" : i.status === "used" ? "використано" : "відкинуто"}</span></div></div></div>
          )) : <div className="empty">Ідей нема.</div>}
        </div>
      </div>
    </>
  );
}
