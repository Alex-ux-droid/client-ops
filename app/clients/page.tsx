import Link from "next/link";
import { fmtDate } from "@/lib/dates";
import { STATUS_LABEL, STATUS_TAG } from "@/lib/labels";
import { listClients } from "@/lib/repo/clients";

export const dynamic = "force-dynamic";

export default function ClientsPage() {
  const clients = listClients();
  return (
    <>
      <div className="head">
        <div><div className="kicker">{clients.length} у базі</div><h1>Клієнти</h1></div>
        <Link href="/clients/new" className="btn">+ Клієнт</Link>
      </div>
      <div className="list">
        {clients.length ? clients.map((c) => (
          <Link key={c.id} href={`/clients/${c.id}`} className="row">
            <div className="row-main">
              <div className="row-title">{c.name}</div>
              <div className="row-sub">{[c.niche, c.offer, c.budget].filter(Boolean).join(" · ")}</div>
              <div className="meta">
                <span className={`tag ${STATUS_TAG[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                {c.open_tasks > 0 && <span className="tag accent">{c.open_tasks} задач</span>}
                {c.last_work && <span className="tag">остання робота {fmtDate(c.last_work)}</span>}
              </div>
            </div>
          </Link>
        )) : <div className="empty">Клієнтів ще нема.</div>}
      </div>
    </>
  );
}
