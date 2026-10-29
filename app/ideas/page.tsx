import Link from "next/link";
import { ideaToTask, markIdea, saveIdea } from "@/app/actions";
import { fmtDate } from "@/lib/dates";
import { listClients } from "@/lib/repo/clients";
import { listIdeas, type IdeaStatus } from "@/lib/repo/ideas";

export const dynamic = "force-dynamic";

const TABS: { s: IdeaStatus; label: string }[] = [
  { s: "new", label: "Нові" },
  { s: "used", label: "Використані" },
  { s: "dropped", label: "Відкинуті" },
];

export default async function IdeasPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const status = (TABS.find((t) => t.s === s)?.s ?? "new") as IdeaStatus;
  const ideas = listIdeas({ status });
  const clients = listClients();

  return (
    <>
      <div className="head"><div><div className="kicker">Банк ідей</div><h1>Ідеї</h1></div></div>
      <form action={saveIdea} className="card" style={{ marginBottom: 14 }}>
        <div className="field"><textarea name="text" placeholder="Що спало на думку…" required style={{ minHeight: 60 }} /></div>
        <div className="inline">
          <select name="client_id" defaultValue="">
            <option value="">Загальна</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button>Записати</button>
        </div>
      </form>
      <div className="tabs">
        {TABS.map((t) => <Link key={t.s} href={`/ideas?s=${t.s}`} className={t.s === status ? "on" : ""}>{t.label}</Link>)}
      </div>
      <div className="list">
        {ideas.length ? ideas.map((i) => (
          <div key={i.id} className="row">
            <div className="row-main">
              <div className="row-title" style={{ whiteSpace: "pre-wrap" }}>{i.text}</div>
              <div className="meta">
                {i.client_name ? <Link href={`/clients/${i.client_id}`} className="tag">{i.client_name}</Link> : <span className="tag">загальна</span>}
                <span className="mono">{fmtDate(i.created_at)}</span>
              </div>
            </div>
            {status === "new" && (
              <div style={{ display: "flex", gap: 4 }}>
                <form action={ideaToTask}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="text" value={i.text} /><input type="hidden" name="client_id" value={i.client_id ?? ""} /><button className="ghost small" title="Зробити задачею на сьогодні">→ задача</button></form>
                <form action={markIdea}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="used" /><button className="ghost small" title="Використано">✓</button></form>
                <form action={markIdea}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="dropped" /><button className="ghost small" title="Відкинути">✕</button></form>
              </div>
            )}
          </div>
        )) : <div className="empty">Порожньо.</div>}
      </div>
    </>
  );
}
