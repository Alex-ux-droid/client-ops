import Link from "next/link";
import { fmtDate } from "@/lib/dates";
import { listPlaybooks } from "@/lib/repo/playbooks";

export default function PlaybooksPage() {
  const pbs = listPlaybooks();
  return (
    <>
      <div className="head">
        <div><div className="kicker">Твої процеси, щоб не робити з нуля</div><h1>Плейбуки</h1></div>
        <Link href="/playbooks/new" className="btn">+ Плейбук</Link>
      </div>
      <div className="list">
        {pbs.length ? pbs.map((p) => (
          <Link key={p.id} href={`/playbooks/${p.id}`} className="row">
            <div className="row-main">
              <div className="row-title">{p.title}</div>
              <div className="meta">
                <span className="tag">{p.items} пунктів</span>
                {p.used > 0 && <span className="tag accent">у {p.used} клієнтів</span>}
                {p.tags && p.tags.split(",").map((t) => <span key={t} className="mono">#{t.trim()}</span>)}
              </div>
            </div>
            <div className="mono">{fmtDate(p.updated_at)}</div>
          </Link>
        )) : <div className="empty">Плейбуків ще нема. Запиши свій перший процес: налаштування CRM, запуск реклами, онбординг клієнта.</div>}
      </div>
    </>
  );
}
