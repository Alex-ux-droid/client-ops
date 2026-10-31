import Link from "next/link";
import { accessCheckedAction, accessDeleteAction, accessSaveAction } from "@/app/actions";
import { ACCESS_OWNERS, listAccess, STALE_DAYS, type Access } from "@/lib/repo/access";
import { fmtDate } from "@/lib/dates";

// Доступи клієнта: що є, чий акаунт, де 2FA, де в Bitwarden. Паролів тут нема — система їх не приймає.
export default function AccessTab({ clientId, err }: { clientId: number; err?: string }) {
  const list = listAccess(clientId);
  const stale = list.filter((a) => a.stale).length;
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      {err && <div className="callout" style={{ borderColor: "var(--bad)" }}>{err}</div>}
      <div className="callout">
        Тут тільки <b>де шукати</b> доступ. Самі паролі — в Bitwarden (папка «Клієнти», запис «Клієнт — Сервіс»).{" "}
        <Link href="/kb?q=Bitwarden" style={{ color: "var(--link)" }}>Як користуватись Bitwarden →</Link>
      </div>
      {stale > 0 && <div className="callout" style={{ borderColor: "var(--warn)" }}>Не перевіряли понад {STALE_DAYS / 30} міс: {stale}. Зайди, переконайся, що доступ живий, і тисни «Перевірено».</div>}

      {list.length === 0 && <div className="mono" style={{ color: "var(--dim)" }}>Доступів ще нема. Додай перший — CRM, Meta Business, хостинг, домен, телефонія.</div>}
      <div className="acc-list">
        {list.map((a) => (
          <div key={a.id} className={`card acc ${a.stale ? "stale" : ""}`}>
            <div className="acc-top">
              <b className="acc-name">{a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.service} ↗</a> : a.service}</b>
              <span className={`tag ${a.owner === "client" ? "" : a.owner === "mine" ? "accent" : "ok"}`}>{ACCESS_OWNERS[a.owner]}</span>
              {a.stale && <span className="tag warn">давно не перевіряли</span>}
            </div>
            <dl className="acc-dl">
              {a.login && <><dt>Логін</dt><dd>{a.login}</dd></>}
              <dt>Bitwarden</dt>
              <dd>{a.vault_url ? <a href={a.vault_url} target="_blank" rel="noreferrer">{a.vault_name || "відкрити запис"} ↗</a> : a.vault_name || <span style={{ color: "var(--warn)" }}>не вказано</span>}</dd>
              {a.twofa && <><dt>2FA</dt><dd>{a.twofa}</dd></>}
              {a.note && <><dt>Нотатка</dt><dd>{a.note}</dd></>}
              <dt>Перевірено</dt><dd>{a.checked_at ? fmtDate(a.checked_at.slice(0, 10)) : "ніколи"}</dd>
            </dl>
            <div className="inline" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              <form action={accessCheckedAction}><input type="hidden" name="access_id" value={a.id} /><button className="ghost small">Перевірено ✓</button></form>
              <details className="acc-edit">
                <summary className="btn ghost small">Змінити</summary>
                <AccessForm clientId={clientId} a={a} />
                <form action={accessDeleteAction} style={{ marginTop: "0.5rem" }}><input type="hidden" name="access_id" value={a.id} /><button className="ghost small" style={{ color: "var(--bad)" }}>Видалити</button></form>
              </details>
            </div>
          </div>
        ))}
      </div>

      <details className="card" open={list.length === 0}>
        <summary><b>Додати доступ</b></summary>
        <AccessForm clientId={clientId} />
      </details>
    </div>
  );
}

function AccessForm({ clientId, a }: { clientId: number; a?: Access }) {
  return (
    <form action={accessSaveAction} className="form-grid" style={{ marginTop: "1rem" }}>
      <input type="hidden" name="client_id" value={clientId} />
      {a && <input type="hidden" name="access_id" value={a.id} />}
      <div className="field"><label>Сервіс</label><input name="service" required defaultValue={a?.service} placeholder="KeyCRM, Meta Business, хостинг…" /></div>
      <div className="field"><label>Логін / email</label><input name="login" defaultValue={a?.login} autoCapitalize="off" placeholder="не пароль!" /></div>
      <div className="field"><label>Назва запису в Bitwarden</label><input name="vault_name" defaultValue={a?.vault_name} placeholder="Іванов — KeyCRM" /></div>
      <div className="field"><label>Посилання на запис (необовʼязково)</label><input name="vault_url" defaultValue={a?.vault_url} inputMode="url" autoCapitalize="off" placeholder="https://vault.bitwarden.com/#/vault?itemId=…" /></div>
      <div className="field"><label>Адреса входу</label><input name="url" defaultValue={a?.url} inputMode="url" autoCapitalize="off" placeholder="app.keycrm.app" /></div>
      <div className="field"><label>Чий акаунт</label>
        <select name="owner" defaultValue={a?.owner ?? "client"}>{Object.entries(ACCESS_OWNERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <div className="field"><label>Де 2FA</label><input name="twofa" defaultValue={a?.twofa} placeholder="SMS на телефон клієнта / мій Authenticator / нема" /></div>
      <div className="field wide"><label>Нотатка</label><input name="note" defaultValue={a?.note} placeholder="напр. адмін — я, клієнт тільки перегляд" /></div>
      <div className="wide"><button>{a ? "Зберегти" : "Додати"}</button></div>
    </form>
  );
}
