import Link from "next/link";
import { makeMonthInvoices, savePayment } from "@/app/actions";
import PaymentRow from "@/components/PaymentRow";
import { money } from "@/lib/config";
import { ymd } from "@/lib/dates";
import { monthLabel } from "@/lib/labels";
import { listClients } from "@/lib/repo/clients";
import { listPayments, moneySummary, receivedByMonth } from "@/lib/repo/payments";

export default function MoneyPage() {
  const month = ymd().slice(0, 7);
  const m = moneySummary(month);
  const open = listPayments({ open: true });
  const paid = listPayments({ month }).filter((p) => p.paid_at);
  const clients = listClients().filter((c) => c.status !== "archived");
  const payers = clients.filter((c) => c.status === "active" && c.fee_monthly > 0);
  const byMonth = receivedByMonth(12);
  const monthMax = Math.max(1, ...byMonth.map((x) => x.total));

  return (
    <>
      <div className="head">
        <div><div className="kicker">{new Date().toLocaleDateString("uk-UA", { month: "long", year: "numeric" })}</div><h1>Гроші</h1></div>
        <form action={makeMonthInvoices}>
          <input type="hidden" name="month" value={month} />
          <button className="ghost" title="Створити очікувані оплати для всіх активних клієнтів з щомісячною оплатою">Рахунки на місяць</button>
        </form>
      </div>

      <div className="stats">
        <div className="stat" style={{ "--c": "var(--ok)" } as React.CSSProperties}><div className="n">{money(m.received)}</div><div className="l">Отримано</div></div>
        <div className="stat" style={{ "--c": "var(--link)" } as React.CSSProperties}><div className="n">{money(m.expected)}</div><div className="l">Ще очікую</div></div>
        <div className="stat" style={{ "--c": m.overdue ? "var(--bad)" : undefined } as React.CSSProperties}><div className="n">{money(m.overdue)}</div><div className="l">Прострочено</div></div>
        <div className="stat"><div className="n">{money(m.mrr)}</div><div className="l">Щомісячний дохід</div></div>
      </div>

      <div className="split section">
        <div>
          <h2 style={{ marginBottom: 10 }}>Чекаю оплати</h2>
          <div className="list">
            {open.length ? open.map((p) => <PaymentRow key={p.id} p={p} />) : <div className="empty">Ніхто нічого не винен. Натисни «Рахунки на місяць», щоб створити очікувані оплати.</div>}
          </div>

          <h2 style={{ margin: "24px 0 10px" }}>Отримано цього місяця</h2>
          <div className="list">
            {paid.length ? paid.map((p) => <PaymentRow key={p.id} p={p} />) : <div className="empty">Поки нічого.</div>}
          </div>
        </div>

        <div>
          <h2 style={{ marginBottom: 10 }}>Додати оплату</h2>
          <form action={savePayment} className="card stack">
            <select name="client_id" required defaultValue="" aria-label="Клієнт">
              <option value="">Клієнт…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="inline">
              <input name="amount" inputMode="decimal" placeholder="Сума" required />
              <input type="date" name="due_date" defaultValue={ymd()} />
            </div>
            <label className="check-line"><input type="checkbox" name="paid" value="1" defaultChecked /> Вже отримав</label>
            <input name="note" placeholder="Коментар" />
            <button>Зберегти</button>
          </form>

          <h2 style={{ margin: "24px 0 10px" }}>Хто скільки платить</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Клієнт</th><th className="num">Щомісяця</th><th className="num">День</th></tr></thead>
              <tbody>
                {payers.length ? payers.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/clients/${c.id}?tab=money`}>{c.name}</Link></td>
                    <td className="num">{money(c.fee_monthly)}</td>
                    <td className="num">{c.pay_day}</td>
                  </tr>
                )) : <tr><td colSpan={3} style={{ color: "var(--dim)" }}>Вкажи щомісячну оплату в картці клієнта.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel section">
        <div className="panel-head"><h2>Отримано за 12 місяців</h2><span className="mono">{money(byMonth.reduce((s, x) => s + x.total, 0))}</span></div>
        <div className="vbars money" style={{ height: "13rem" }}>
          {byMonth.map((x, i) => (
            <div key={x.month} className={`vb ${i === byMonth.length - 1 ? "on" : ""}`} title={`${monthLabel(x.month)} ${x.month.slice(0, 4)}: ${money(x.total)}`}>
              <span className="vb-n">{x.total ? money(x.total) : "·"}</span>
              <span className="vb-col"><i style={{ height: `${(x.total / monthMax) * 100}%` }} /></span>
              <span className="vb-l">{monthLabel(x.month)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
