import Link from "next/link";
import { Fragment } from "react";
import Pop from "@/components/Pop";
import { accessCheckedAction, accessDeleteAction, accessLogAction, accessSaveAction } from "@/app/actions";
import { ACCESS_OWNERS, ACCESS_PAYER, ACCESS_PERIOD, ACCESS_STATUS, accessLog, listAccess, monthlyCost, type Access } from "@/lib/repo/access";
import { fmtDate } from "@/lib/dates";

// Сервіси й доступи клієнта — мінімально: «+ Сервіс», що скоро платити, список; деталі, журнал і правка — по кліку.
// Паролів і повних номерів карт тут нема — система їх не приймає.
const today = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
const daysTo = (d: string) => Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${today()}T12:00:00Z`)) / 864e5);
const sum = (m: Record<string, number>) => Object.entries(m).map(([c, v]) => `${v.toLocaleString("uk-UA")} ${c}`).join(" + ");
const price = (a: Access) => (a.period === "free" ? "безкоштовно" : a.cost != null ? `${a.cost.toLocaleString("uk-UA")} ${a.currency}${a.period === "month" ? "/міс" : a.period === "year" ? "/рік" : " разово"}` : "");
const dueText = (d: number) => (d < 0 ? `прострочено ${-d} дн.` : d === 0 ? "сьогодні" : `через ${d} дн.`);

export default function AccessTab({ clientId, err }: { clientId: number; err?: string }) {
  const list = listAccess(clientId);
  const m = monthlyCost(list);
  const soon = list.filter((a) => a.next_pay && a.status !== "off" && daysTo(a.next_pay) <= 14).sort((a, b) => a.next_pay!.localeCompare(b.next_pay!));
  const total = [sum(m.client) && `клієнт ${sum(m.client)}`, sum(m.mine) && `мої ${sum(m.mine)}`].filter(Boolean).join(" · ");
  return (
    <div className="stack" style={{ gap: "0.75rem" }}>
      {err && <div className="mx-warn">{err}</div>}
      <div className="inline" style={{ flexWrap: "wrap" }}>
        <Pop className="pop-trigger pop-inline" closeOnSubmit title="Новий сервіс" trigger={<span className="btn small">+ Сервіс</span>}><AccessForm clientId={clientId} /></Pop>
        <span className="grow" />
        {total && <span className="mono">на місяць: {total}</span>}
      </div>
      {soon.length > 0 && (
        <div className="svc-soon">
          {soon.map((a) => <span key={a.id} className={daysTo(a.next_pay!) <= 3 ? "bad" : ""}><b>{a.service}</b> · {fmtDate(a.next_pay)} · {dueText(daysTo(a.next_pay!))}{a.cost != null ? ` · ${a.cost.toLocaleString("uk-UA")} ${a.currency}` : ""}</span>)}
        </div>
      )}
      {list.length === 0 ? <p className="mono">Порожньо. Додай, що підключив клієнту, — або напиши Джері: «підключив їм E-chat, 500 грн/міс з карти клієнта 4521».</p> : (
        <div className="svc-list">
          {list.map((a) => {
            const d = a.next_pay && a.status !== "off" ? daysTo(a.next_pay) : null;
            return (
              <Pop key={a.id} className="pop-trigger svc-row" wide title={a.service} trigger={<>
                <span className="grow svc-name"><b>{a.service}</b>{a.purpose && <span className="mono">{a.purpose}</span>}</span>
                {price(a) && <span>{price(a)}</span>}
                {d != null && <span className={`tag ${d <= 3 ? "bad" : d <= 14 ? "warn" : ""}`}>{d <= 14 ? dueText(d) : fmtDate(a.next_pay)}</span>}
                {a.status !== "active" && <span className="tag">{ACCESS_STATUS[a.status]}</span>}
              </>}>
                <Details a={a} clientId={clientId} />
              </Pop>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Details({ a, clientId }: { a: Access; clientId: number }) {
  const log = accessLog(a.id);
  const rows: [string, React.ReactNode][] = [
    ["Навіщо", a.purpose], ["Ціна", price(a) && `${price(a)} · ${ACCESS_PAYER[a.payer]}`], ["Чим платимо", a.pay_method],
    ["Наступна оплата", a.next_pay && fmtDate(a.next_pay)], ["На кого акаунт", a.account_holder], ["Підключено", a.connected_at && fmtDate(a.connected_at)],
    ["Статус", ACCESS_STATUS[a.status]], ["Логін", a.login], ["Адреса", a.url && <a href={a.url} target="_blank" rel="noreferrer">{a.url} ↗</a>],
    ["Bitwarden", a.vault_url ? <a href={a.vault_url} target="_blank" rel="noreferrer">{a.vault_name || "відкрити запис"} ↗</a> : a.vault_name], ["2FA", a.twofa], ["Нотатка", a.note],
  ];
  return (
    <div className="stack" style={{ gap: "0.75rem" }}>
      <dl className="acc-dl" style={{ margin: 0 }}>{rows.filter(([, v]) => v).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
      <div className="svc-log">
        <b className="mono">Журнал</b>
        {log.map((l) => (
          <div key={l.id} className="svc-log-i">
            <span className="mono">{fmtDate(l.day)}</span><span className="grow">{l.text}</span>{l.amount != null && <b>{l.amount.toLocaleString("uk-UA")} {l.currency}</b>}
            <form action={accessLogAction}><input type="hidden" name="access_id" value={a.id} /><input type="hidden" name="log_id" value={l.id} /><button className="ghost small" aria-label="Видалити запис">×</button></form>
          </div>
        ))}
        <form action={accessLogAction} className="svc-log-add">
          <input type="hidden" name="access_id" value={a.id} />
          <input name="text" required placeholder="Оплатив за грудень / додав менеджера…" aria-label="Що сталось" />
          <input type="date" name="day" defaultValue={today()} aria-label="Дата" />
          <input name="amount" inputMode="decimal" placeholder={`Сума, ${a.currency}`} aria-label="Сума" />
          <button className="ghost small">Записати</button>
        </form>
      </div>
      <details className="ct-more"><summary className="mono">Змінити</summary><AccessForm clientId={clientId} a={a} /></details>
      <div className="inline">
        <form action={accessCheckedAction}><input type="hidden" name="access_id" value={a.id} /><button className="ghost small">Доступ перевірено ✓</button></form>
        <span className="grow" />
        <form action={accessDeleteAction}><input type="hidden" name="access_id" value={a.id} /><button className="ghost small" style={{ color: "var(--bad)" }}>Видалити</button></form>
      </div>
    </div>
  );
}

function AccessForm({ clientId, a }: { clientId: number; a?: Access }) {
  return (
    <form action={accessSaveAction} className="svc-form">
      <input type="hidden" name="client_id" value={clientId} />
      {a && <input type="hidden" name="access_id" value={a.id} />}
      <input name="service" required defaultValue={a?.service} placeholder="Сервіс: E-chat, Zadarma, домен…" aria-label="Сервіс" />
      <input name="purpose" defaultValue={a?.purpose} placeholder="Навіщо (необовʼязково)" aria-label="Навіщо" />
      <div className="svc-f3">
        <input name="cost" inputMode="decimal" defaultValue={a?.cost ?? ""} placeholder="Ціна" aria-label="Ціна" />
        <select name="currency" defaultValue={a?.currency ?? "UAH"} aria-label="Валюта">{["UAH", "USD", "EUR"].map((c) => <option key={c}>{c}</option>)}</select>
        <select name="period" defaultValue={a?.period ?? "month"} aria-label="Як часто">{Object.entries(ACCESS_PERIOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <label className="svc-lbl">Наступна оплата / закінчується<input type="date" name="next_pay" defaultValue={a?.next_pay ?? ""} /></label>
      <details>
        <summary className="mono">Хто платить, на кого акаунт, доступ</summary>
        <div className="svc-form" style={{ marginTop: "0.5rem" }}>
          <select name="payer" defaultValue={a?.payer ?? "client"} aria-label="Хто платить">{Object.entries(ACCESS_PAYER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input name="pay_method" defaultValue={a?.pay_method} placeholder="Чим: карта клієнта Моно •••• 4521 (лише 4 цифри)" aria-label="Чим платимо" />
          <input name="account_holder" defaultValue={a?.account_holder} placeholder="На кого акаунт: Оля, директор, я" aria-label="На кого акаунт" />
          <div className="svc-f3">
            <select name="status" defaultValue={a?.status ?? "active"} aria-label="Статус">{Object.entries(ACCESS_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select name="owner" defaultValue={a?.owner ?? "client"} aria-label="Чий акаунт">{Object.entries(ACCESS_OWNERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input type="date" name="connected_at" defaultValue={a?.connected_at ?? (a ? "" : today())} aria-label="Підключено" title="Підключено" />
          </div>
          <input name="login" defaultValue={a?.login} autoCapitalize="off" placeholder="Логін / email (не пароль)" aria-label="Логін" />
          <input name="url" defaultValue={a?.url} inputMode="url" autoCapitalize="off" placeholder="Адреса входу" aria-label="Адреса входу" />
          <input name="vault_name" defaultValue={a?.vault_name} placeholder="Запис у Bitwarden: Аквавіта — E-chat" aria-label="Bitwarden" />
          <input name="vault_url" defaultValue={a?.vault_url} inputMode="url" autoCapitalize="off" placeholder="Посилання на запис Bitwarden" aria-label="Посилання Bitwarden" />
          <input name="twofa" defaultValue={a?.twofa} placeholder="Де 2FA" aria-label="2FA" />
          <input name="note" defaultValue={a?.note} placeholder="Нотатка" aria-label="Нотатка" />
          {!a && <input name="first_paid" inputMode="decimal" placeholder="Вже сплатили зараз (сума — піде в журнал)" aria-label="Вже сплатили" />}
          <span className="mono">Паролі — лише в Bitwarden. <Link href="/kb?q=Bitwarden">Як →</Link></span>
        </div>
      </details>
      <div><button className="small">{a ? "Зберегти" : "Додати"}</button></div>
    </form>
  );
}
