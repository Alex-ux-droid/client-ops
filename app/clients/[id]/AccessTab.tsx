import Link from "next/link";
import { accessCheckedAction, accessDeleteAction, accessLogAction, accessSaveAction } from "@/app/actions";
import { ACCESS_OWNERS, ACCESS_PAYER, ACCESS_PERIOD, ACCESS_STATUS, STALE_DAYS, accessLog, listAccess, monthlyCost, type Access } from "@/lib/repo/access";
import { fmtDate } from "@/lib/dates";

// Сервіси й доступи клієнта: що підключено, на кого акаунт, скільки й з чого платиться, журнал дій, де доступ у Bitwarden.
// Паролів і повних номерів карт тут нема — система їх не приймає.
const today = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
const daysTo = (d: string) => Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${today()}T12:00:00Z`)) / 864e5);
const sum = (m: Record<string, number>) => Object.entries(m).map(([c, v]) => `${v.toLocaleString("uk-UA")} ${c}`).join(" + ");
const price = (a: Access) => (a.period === "free" ? "безкоштовно" : a.cost != null ? `${a.cost.toLocaleString("uk-UA")} ${a.currency} ${ACCESS_PERIOD[a.period]}` : "");

export default function AccessTab({ clientId, err }: { clientId: number; err?: string }) {
  const list = listAccess(clientId);
  const stale = list.filter((a) => a.stale && a.status !== "off").length;
  const m = monthlyCost(list);
  const soon = list.filter((a) => a.next_pay && a.status !== "off" && daysTo(a.next_pay) <= 7);
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      {err && <div className="callout" style={{ borderColor: "var(--bad)" }}>{err}</div>}
      <div className="svc-sum">
        <div><span className="mono">Сервісів</span><b>{list.filter((a) => a.status !== "off").length}</b></div>
        <div><span className="mono">На місяць з рахунку клієнта</span><b>{sum(m.client) || "—"}</b></div>
        <div><span className="mono">На місяць з мого</span><b>{sum(m.mine) || "—"}</b></div>
        <div><span className="mono">Оплата за 7 днів</span><b className={soon.length ? "warn-text" : ""}>{soon.length ? soon.map((a) => a.service).join(", ") : "—"}</b></div>
      </div>
      <div className="callout">
        Що підключили клієнту, на кого акаунт, скільки й чим платили, що робили. Паролі — тільки в Bitwarden (тут лише назва запису), карта — лише останні 4 цифри.{" "}
        <Link href="/kb?q=Bitwarden" style={{ color: "var(--link)" }}>Як користуватись Bitwarden →</Link> Можна просто написати Джері: «підключив їм E-chat, 500 грн/міс з карти клієнта 4521, акаунт на Олю».
      </div>
      {stale > 0 && <div className="callout" style={{ borderColor: "var(--warn)" }}>Не перевіряли понад {STALE_DAYS / 30} міс: {stale}. Зайди, переконайся, що доступ живий, і тисни «Перевірено».</div>}

      <details className="card" open={list.length === 0}>
        <summary><b>+ Додати сервіс</b></summary>
        <AccessForm clientId={clientId} />
      </details>

      {list.length === 0 && <div className="mono" style={{ color: "var(--dim)" }}>Ще нічого не записано. Додай перше — CRM, E-chat, телефонія, домен, хостинг, Meta Business.</div>}
      <div className="acc-list">
        {list.map((a) => {
          const log = accessLog(a.id);
          const due = a.next_pay && a.status !== "off" ? daysTo(a.next_pay) : null;
          return (
            <div key={a.id} className={`card acc ${a.stale && a.status !== "off" ? "stale" : ""} ${a.status === "off" ? "off" : ""}`}>
              <div className="acc-top">
                <b className="acc-name">{a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.service} ↗</a> : a.service}</b>
                <span className={`tag ${a.status === "active" ? "ok" : a.status === "off" ? "" : "warn"}`}>{ACCESS_STATUS[a.status]}</span>
                <span className={`tag ${a.owner === "client" ? "" : a.owner === "mine" ? "accent" : "ok"}`}>{ACCESS_OWNERS[a.owner]}</span>
              </div>
              {a.purpose && <div style={{ marginTop: "0.25rem" }}>{a.purpose}</div>}
              <dl className="acc-dl">
                {price(a) && <><dt>Ціна</dt><dd><b>{price(a)}</b> · {ACCESS_PAYER[a.payer]}</dd></>}
                {a.pay_method && <><dt>Чим платимо</dt><dd>{a.pay_method}</dd></>}
                {a.next_pay && <><dt>Наступна оплата</dt><dd className={due != null && due <= 7 ? "warn-text" : ""}>{fmtDate(a.next_pay)}{due != null && due <= 7 ? (due < 0 ? ` · прострочено ${-due} дн.` : due === 0 ? " · сьогодні" : ` · через ${due} дн.`) : ""}</dd></>}
                {a.account_holder && <><dt>На кого акаунт</dt><dd>{a.account_holder}</dd></>}
                {a.connected_at && <><dt>Підключено</dt><dd>{fmtDate(a.connected_at)}</dd></>}
                {a.login && <><dt>Логін</dt><dd>{a.login}</dd></>}
                <dt>Bitwarden</dt>
                <dd>{a.vault_url ? <a href={a.vault_url} target="_blank" rel="noreferrer">{a.vault_name || "відкрити запис"} ↗</a> : a.vault_name || <span style={{ color: "var(--warn)" }}>не вказано</span>}</dd>
                {a.twofa && <><dt>2FA</dt><dd>{a.twofa}</dd></>}
                {a.note && <><dt>Нотатка</dt><dd>{a.note}</dd></>}
                <dt>Перевірено</dt><dd>{a.checked_at ? fmtDate(a.checked_at.slice(0, 10)) : "ніколи"}{a.stale && a.status !== "off" ? <span className="warn-text"> · давно</span> : null}</dd>
              </dl>
              <div className="svc-log">
                <b className="mono">Журнал</b>
                {log.slice(0, 6).map((l) => (
                  <div key={l.id} className="svc-log-i">
                    <span className="mono">{fmtDate(l.day)}</span><span className="grow">{l.text}</span>{l.amount != null && <b>{l.amount.toLocaleString("uk-UA")} {l.currency}</b>}
                    <form action={accessLogAction}><input type="hidden" name="access_id" value={a.id} /><input type="hidden" name="log_id" value={l.id} /><button className="ghost small" aria-label="Видалити запис" title="Видалити запис">×</button></form>
                  </div>
                ))}
                {!log.length && <span className="mono">порожньо</span>}
                {log.length > 6 && <span className="mono">ще {log.length - 6} раніше</span>}
                <details className="svc-log-more"><summary className="mono">+ запис: оплата, зміна, що зробили</summary>
                  <form action={accessLogAction} className="svc-log-add">
                    <input type="hidden" name="access_id" value={a.id} />
                    <input name="text" required placeholder="Оплатив за грудень / додав менеджера Олю…" aria-label="Що сталось" />
                    <input type="date" name="day" defaultValue={today()} aria-label="Дата" />
                    <input name="amount" inputMode="decimal" placeholder={`Сума, ${a.currency}`} aria-label="Сума" />
                    <button className="ghost small">Записати</button>
                  </form>
                </details>
              </div>
              <div className="inline" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                <form action={accessCheckedAction}><input type="hidden" name="access_id" value={a.id} /><button className="ghost small">Перевірено ✓</button></form>
                <details className="acc-edit">
                  <summary className="btn ghost small">Змінити</summary>
                  <AccessForm clientId={clientId} a={a} />
                  <form action={accessDeleteAction} style={{ marginTop: "0.5rem" }}><input type="hidden" name="access_id" value={a.id} /><button className="ghost small" style={{ color: "var(--bad)" }}>Видалити</button></form>
                </details>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccessForm({ clientId, a }: { clientId: number; a?: Access }) {
  return (
    <form action={accessSaveAction} className="form-grid" style={{ marginTop: "1rem" }}>
      <input type="hidden" name="client_id" value={clientId} />
      {a && <input type="hidden" name="access_id" value={a.id} />}
      <div className="field"><label>Сервіс</label><input name="service" required defaultValue={a?.service} placeholder="E-chat, KeyCRM, Zadarma, домен…" /></div>
      <div className="field"><label>Навіщо</label><input name="purpose" defaultValue={a?.purpose} placeholder="Viber/Telegram/WhatsApp у CRM" /></div>
      <div className="field"><label>Статус</label><select name="status" defaultValue={a?.status ?? "active"}>{Object.entries(ACCESS_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="field"><label>Підключено</label><input type="date" name="connected_at" defaultValue={a?.connected_at ?? (a ? "" : new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10))} /></div>
      <div className="field"><label>Ціна</label><input name="cost" inputMode="decimal" defaultValue={a?.cost ?? ""} placeholder="500" /></div>
      <div className="field"><label>Валюта</label><select name="currency" defaultValue={a?.currency ?? "UAH"}>{["UAH", "USD", "EUR"].map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="field"><label>Як часто</label><select name="period" defaultValue={a?.period ?? "month"}>{Object.entries(ACCESS_PERIOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="field"><label>Хто платить</label><select name="payer" defaultValue={a?.payer ?? "client"}>{Object.entries(ACCESS_PAYER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="field"><label>Чим платимо</label><input name="pay_method" defaultValue={a?.pay_method} placeholder="карта клієнта Моно •••• 4521 (лише 4 цифри)" /></div>
      <div className="field"><label>Наступна оплата</label><input type="date" name="next_pay" defaultValue={a?.next_pay ?? ""} /></div>
      {!a && <div className="field"><label>Вже сплатили зараз</label><input name="first_paid" inputMode="decimal" placeholder="сума, піде в журнал" /></div>}
      <div className="field"><label>На кого акаунт</label><input name="account_holder" defaultValue={a?.account_holder} placeholder="Оля (менеджер), директор, я" /></div>
      <div className="field"><label>Чий акаунт</label><select name="owner" defaultValue={a?.owner ?? "client"}>{Object.entries(ACCESS_OWNERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="field"><label>Логін / email</label><input name="login" defaultValue={a?.login} autoCapitalize="off" placeholder="не пароль!" /></div>
      <div className="field"><label>Адреса входу</label><input name="url" defaultValue={a?.url} inputMode="url" autoCapitalize="off" placeholder="e-chat.tech" /></div>
      <div className="field"><label>Назва запису в Bitwarden</label><input name="vault_name" defaultValue={a?.vault_name} placeholder="Аквавіта — E-chat" /></div>
      <div className="field"><label>Посилання на запис (необовʼязково)</label><input name="vault_url" defaultValue={a?.vault_url} inputMode="url" autoCapitalize="off" placeholder="https://vault.bitwarden.com/#/vault?itemId=…" /></div>
      <div className="field"><label>Де 2FA</label><input name="twofa" defaultValue={a?.twofa} placeholder="SMS на телефон клієнта / мій Authenticator / нема" /></div>
      <div className="field wide"><label>Нотатка</label><input name="note" defaultValue={a?.note} placeholder="напр. адмін — я, клієнт тільки перегляд" /></div>
      <div className="wide"><button>{a ? "Зберегти" : "Додати"}</button></div>
    </form>
  );
}
