import Link from "next/link";
import { removePayment, togglePaid } from "@/app/actions";
import { money } from "@/lib/config";
import { fmtDate, ymd } from "@/lib/dates";
import type { PaymentRow as P } from "@/lib/repo/payments";

export default function PaymentRow({ p, showClient = true }: { p: P; showClient?: boolean }) {
  const late = !p.paid_at && p.due_date < ymd();
  return (
    <div className="row">
      <form action={togglePaid}>
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="paid" value={p.paid_at ? "0" : "1"} />
        <button className={`check ${p.paid_at ? "done" : ""}`} title={p.paid_at ? "Позначити як неоплачене" : "Отримав"}>✓</button>
      </form>
      <div className="row-main">
        <div className="row-title">{money(p.amount)}</div>
        <div className="meta">
          {p.paid_at ? <span className="tag ok">отримано {fmtDate(p.paid_at)}</span>
            : late ? <span className="tag bad">прострочено · {fmtDate(p.due_date)}</span>
            : <span className="tag">чекаю {fmtDate(p.due_date)}</span>}
          {showClient && <Link href={`/clients/${p.client_id}?tab=money`} className="tag">{p.client_name}</Link>}
          {p.note && <span className="mono">{p.note}</span>}
        </div>
      </div>
      <form action={removePayment}>
        <input type="hidden" name="id" value={p.id} />
        <button className="ghost small" title="Видалити">✕</button>
      </form>
    </div>
  );
}
