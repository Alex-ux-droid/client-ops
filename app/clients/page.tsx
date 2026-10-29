import Link from "next/link";
import { money } from "@/lib/config";
import { fmtDate } from "@/lib/dates";
import { STAGE_LABEL, STATUS_LABEL, STATUS_TAG } from "@/lib/labels";
import { clientFlags, listClients } from "@/lib/repo/clients";

const FILTERS = [
  { k: "work", label: "В роботі" },
  { k: "active", label: "Активні" },
  { k: "lead", label: "Ліди" },
  { k: "paused", label: "Пауза" },
  { k: "archived", label: "Архів" },
] as const;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const sp = await searchParams;
  const f = FILTERS.find((x) => x.k === sp.f)?.k ?? "work";
  const all = listClients();
  const clients = all.filter((c) => (f === "work" ? c.status === "active" || c.status === "lead" : c.status === f));
  const count = (k: string) => all.filter((c) => (k === "work" ? c.status === "active" || c.status === "lead" : c.status === k)).length;
  return (
    <>
      <div className="head">
        <div><div className="kicker">{all.length} у базі</div><h1>Клієнти</h1></div>
        <Link href="/clients/new" className="btn">+ Клієнт</Link>
      </div>
      <div className="tabs">
        {FILTERS.map((x) => <Link key={x.k} href={`/clients?f=${x.k}`} className={x.k === f ? "on" : ""}>{x.label}{count(x.k) ? <b>{count(x.k)}</b> : null}</Link>)}
      </div>
      <div className="list">
        {clients.length ? clients.map((c) => {
          const flags = clientFlags(c);
          return (
            <Link key={c.id} href={`/clients/${c.id}`} className="row">
              <div className="row-main">
                <div className="row-title">{c.name}</div>
                <div className="row-sub">{[c.niche, c.offer].filter(Boolean).join(" · ")}</div>
                <div className="meta">
                  <span className={`tag ${STATUS_TAG[c.status]}`}>{STATUS_LABEL[c.status]}{c.status === "lead" ? ` · ${STAGE_LABEL[c.stage]}` : ""}</span>
                  {flags.map((fl) => <span key={fl.text} className={`tag ${fl.level}`}>{fl.text}</span>)}
                  {c.next_step && <span className="mono" style={{ color: "var(--cyan)" }}>→ {c.next_step}</span>}
                </div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <div className="mono" style={{ color: "var(--text)" }}>{c.fee_monthly ? `${money(c.fee_monthly)}/міс` : "—"}</div>
                <div className="mono">{c.open_tasks} задач</div>
                <div className="mono">{c.last_work ? fmtDate(c.last_work) : "—"}</div>
              </div>
            </Link>
          );
        }) : <div className="empty">Порожньо.</div>}
      </div>
    </>
  );
}
