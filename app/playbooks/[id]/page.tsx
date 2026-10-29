import Link from "next/link";
import { notFound } from "next/navigation";
import { attachPlaybookAction, removePlaybook } from "@/app/actions";
import Markdown from "@/components/Markdown";
import { clientOptions } from "@/lib/repo/counts";
import { checklistItems, getPlaybook, playbookClients } from "@/lib/repo/playbooks";

export default async function PlaybookPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const p = getPlaybook(id);
  if (!p) notFound();
  const total = checklistItems(p.body_md).length;
  const used = playbookClients(id);
  const free = clientOptions().filter((c) => !used.some((u) => u.client_id === c.id));
  return (
    <>
      <div className="head">
        <div><div className="kicker"><Link href="/playbooks">Плейбуки</Link> · {total} пунктів</div><h1>{p.title}</h1></div>
        <Link href={`/playbooks/${id}/edit`} className="btn ghost">Редагувати</Link>
      </div>
      <div className="split">
        <div className="card"><Markdown md={p.body_md} /></div>
        <div className="stack" style={{ gap: 16 }}>
          {free.length > 0 && (
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
