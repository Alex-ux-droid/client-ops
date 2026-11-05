// Продажі клієнта з його CRM: повна воронка з усіх джерел + «реклама → продажі» по кожному оголошенню
import Link from "next/link";
import { headers } from "next/headers";
import SubmitButton from "@/components/SubmitButton";
import { CopyText } from "@/app/startups/[id]/CopyText";
import { connectCrmAction, crmDisconnectAction, crmPullAction, crmSecretAction } from "@/app/crm/actions";
import { crmByAd, crmKey, crmSecret, crmStats, REASON_UA, SOURCE_UA, STATUS_UA } from "@/lib/crm";
import { crmEvents, getCrmLink } from "@/lib/repo/crm";
import { accountsForClient, adTotalsForClient } from "@/lib/repo/meta";
import { getSetting } from "@/lib/repo/settings";

const BASE_UA: Record<string, string> = { leads_per_month: "лідів на місяць", conversion_pct: "конверсія в продаж, %", conversion: "конверсія в продаж", avg_check: "середній чек", revenue_per_month: "дохід на місяць", source: "звідки цифри", fixed_at: "зафіксовано", note: "примітка" };
const PERIODS = [{ k: "30", label: "30 днів" }, { k: "90", label: "90 днів" }, { k: "365", label: "Рік" }];
const dt = (t: string | null) => (t ? new Date(t).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const mins = (m: number | null) => (m == null ? "—" : m < 60 ? `${m} хв` : m < 1440 ? `${Math.round(m / 60)} год` : `${Math.round(m / 1440)} дн`);

export default async function SalesTab({ clientId, sp, err, pulled }: { clientId: number; sp?: string; err?: string; pulled?: string }) {
  const link = getCrmLink(clientId);
  const h = await headers();
  const hook = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? ""}/api/crm/${clientId}`;
  const once = getSetting(`crm.secret_once.${clientId}`) || "";
  const hid = <input type="hidden" name="client_id" value={clientId} />;
  const msg = err ? <div className="callout" style={{ borderColor: "var(--bad)" }}>{err}</div> : pulled ? <div className="callout" style={{ borderColor: "var(--ok)" }}>Забрав з CRM: {pulled} лідів.</div> : null;

  const secretBox = (
    <div className="card stack" style={{ gap: "0.5rem" }}>
      <b>Вебхук: CRM → сюди</b>
      <div className="mono">У CRM: Налаштування → Конектори → Client Ops → «Вебхук у Client Ops». Встав адресу і секрет, увімкни «Надсилати події», натисни «Тестова подія».</div>
      <div className="inline" style={{ flexWrap: "wrap" }}><span className="mono" style={{ overflowWrap: "anywhere" }}>{hook}</span><CopyText text={hook} label="Копіювати адресу" /></div>
      {once ? (
        <div className="inline" style={{ flexWrap: "wrap" }}>
          <span className="mono" style={{ overflowWrap: "anywhere" }}>Секрет: {once}</span><CopyText text={once} label="Копіювати секрет" />
          <form action={crmSecretAction}>{hid}<input type="hidden" name="op" value="hide" /><button className="ghost small">Вставив у CRM — сховати</button></form>
        </div>
      ) : (
        <form action={crmSecretAction} className="inline">{hid}<span className="mono">Секрет {crmSecret(clientId) ? "збережено (показується один раз)" : "ще нема"}.</span><button className="ghost small">Новий секрет</button></form>
      )}
    </div>
  );

  if (!link) return (
    <section className="stack" style={{ gap: "1rem" }}>
      {msg}
      <div className="card stack" style={{ gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Підключити CRM клієнта</h2>
        <div className="mono">Продажі, гроші, менеджери і «яка реклама реально продає». Ключ береш у CRM: Налаштування → Конектори → Client Ops → Ключі API → «Створити ключ». Ключ лежатиме тільки в .env на сервері.</div>
        <form action={connectCrmAction} className="stack" style={{ gap: "0.5rem" }}>
          {hid}
          <input name="base_url" required placeholder="https://назва.oselyacrm.com/api/integrations/client-ops" aria-label="Адреса API CRM" />
          <input name="key" type="password" required placeholder="Ключ API з CRM" autoComplete="off" aria-label="Ключ API" />
          <div><SubmitButton>Підключити і забрати ліди</SubmitButton></div>
        </form>
      </div>
    </section>
  );

  const days = Number(PERIODS.find((p) => p.k === sp)?.k ?? 30);
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const st = crmStats(clientId, since);
  const cur = st.currency;
  const m = (v: number | null) => (v == null ? "—" : `${Math.round(v).toLocaleString("uk-UA")} ${cur}`);
  const metaCur = accountsForClient(clientId)[0]?.currency ?? "";
  const ads = crmByAd(clientId, adTotalsForClient(clientId)).filter((a) => a.crmLeads || a.spend);
  const mm = (v: number | null) => (v == null ? "—" : `${Math.round(v).toLocaleString("uk-UA")} ${metaCur}`);
  const events = crmEvents(clientId, 12);
  let baseline: Record<string, unknown> | null = null;
  try { baseline = (JSON.parse(link.summary_json || "{}") as { baseline?: Record<string, unknown> }).baseline ?? null; } catch { /* нема */ }
  const base = `/clients/${clientId}?tab=sales`;

  return (
    <section className="stack" style={{ gap: "1rem" }}>
      {msg}
      <div className="card inline" style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <b>CRM підключена</b>
          <div className="mono" style={{ color: link.last_error ? "var(--warn)" : "var(--dim)" }}>
            остання подія {dt(link.last_event_at)} · підтягнуто {dt(link.last_pull_at)}{!crmKey(clientId) ? " · нема ключа" : ""}{link.last_error ? ` · ${link.last_error}` : ""}
          </div>
        </div>
        <div className="inline">
          <form action={crmPullAction}>{hid}<SubmitButton className="ghost small">Оновити зараз</SubmitButton></form>
        </div>
      </div>

      <nav className="mx-tabs">{PERIODS.map((p) => <Link key={p.k} href={p.k === "30" ? base : `${base}&sp=${p.k}`} scroll={false} className={String(days) === p.k ? "on" : ""}>{p.label}</Link>)}</nav>

      <div className="mx-blocks">
        <div><b>{st.leads}</b><span>лідів (усі джерела)</span></div>
        <div><b>{st.sales}</b><span>продажів</span></div>
        <div><b>{m(st.revenue)}</b><span>продано на суму</span></div>
        <div><b>{m(st.avgCheck)}</b><span>середній чек</span></div>
        <div><b>{st.conv == null ? "—" : `${st.conv.toFixed(1)}%`}</b><span>лід → продаж (ліди періоду)</span></div>
        <div><b>{m(st.paid)}</b><span>оплачено</span></div>
        <div><b>{mins(st.speedMin)}</b><span>до першого контакту (медіана)</span></div>
        <div><b style={st.noContact ? { color: "var(--warn)" } : undefined}>{st.noContact}</b><span>без контакту</span></div>
      </div>

      <div className="mono">Реклама → продажі, по кожному оголошенню за весь час (продаж може статись через місяці після заявки){metaCur && cur && metaCur !== cur ? ` · увага: реклама в ${metaCur}, продажі в ${cur}` : ""}</div>
      {ads.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Оголошення</th><th>Витрати</th><th>Ліди Meta</th><th>У CRM</th><th>Показ+</th><th>Продажі</th><th>Сума</th><th>Ціна продажу</th><th>ROAS</th></tr></thead>
            <tbody>{ads.slice(0, 40).map((a) => (
              <tr key={a.ad_id}>
                <td><div>{a.ad_name}</div>{a.campaign_name && <small className="mono">{a.campaign_name}</small>}</td>
                <td>{mm(a.spend)}</td><td>{a.metaLeads ?? "—"}</td><td>{a.crmLeads}</td><td>{a.meetings}</td><td>{a.sales}</td>
                <td>{a.revenue ? m(a.revenue) : "—"}</td><td>{mm(a.cps)}</td><td>{a.roas == null ? "—" : a.roas.toFixed(1)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="mono">Ще нема лідів з оголошеннями Meta або витрат по оголошеннях (витрати за весь час підтягуються раз на добу).</p>}

      <div className="grid2">
        <div className="card stack" style={{ gap: "0.5rem" }}>
          <b>Джерела</b>
          {st.bySource.length ? st.bySource.map((x) => <div key={x.key} className="inline" style={{ justifyContent: "space-between" }}><span>{SOURCE_UA[x.key] ?? x.key}</span><span className="mono">{x.leads} лід. · {x.sales} прод. · {m(x.revenue)}</span></div>) : <p className="mono">—</p>}
        </div>
        <div className="card stack" style={{ gap: "0.5rem" }}>
          <b>Менеджери</b>
          {st.managers.length ? st.managers.map((x) => <div key={x.key} className="inline" style={{ justifyContent: "space-between" }}><span>{x.key}</span><span className="mono">{x.leads} лід. · {x.sales} прод. · {m(x.revenue)} · реакція {mins(x.speedMin)}</span></div>) : <p className="mono">—</p>}
        </div>
        <div className="card stack" style={{ gap: "0.5rem" }}>
          <b>Де зараз ліди періоду</b>
          {st.byStatus.map((x) => <div key={x.key} className="inline" style={{ justifyContent: "space-between" }}><span>{STATUS_UA[x.key] ?? x.key}</span><span className="mono">{x.n}</span></div>)}
        </div>
        <div className="card stack" style={{ gap: "0.5rem" }}>
          <b>Чому відмовились</b>
          {st.lost.length ? st.lost.map((x) => <div key={x.key} className="inline" style={{ justifyContent: "space-between" }}><span>{REASON_UA[x.key] ?? x.key}</span><span className="mono">{x.n}</span></div>) : <p className="mono">Відмов з причиною нема.</p>}
        </div>
      </div>

      {baseline && Object.keys(baseline).length > 0 && (
        <div className="card stack" style={{ gap: "0.375rem" }}>
          <b>Точка нуль (до нас) — для кейсу «було → стало»</b>
          {Object.entries(baseline).filter(([, v]) => v != null && typeof v !== "object").map(([k, v]) => <div key={k} className="inline" style={{ justifyContent: "space-between" }}><span className="mono">{BASE_UA[k] ?? k}</span><span>{String(v)}</span></div>)}
        </div>
      )}

      {events.length > 0 && (
        <div className="card stack" style={{ gap: "0.375rem" }}>
          <b>Останні події з CRM</b>
          {events.map((e) => <div key={e.event_id} className="mono">{dt(e.occurred_at)} · {e.event} · {e.summary}</div>)}
        </div>
      )}

      <details className="card">
        <summary><b>Налаштування підключення</b></summary>
        <div className="stack" style={{ gap: "0.75rem", marginTop: "0.75rem" }}>
          {secretBox}
          <form action={connectCrmAction} className="stack" style={{ gap: "0.5rem" }}>
            {hid}
            <input name="base_url" defaultValue={link.base_url} required aria-label="Адреса API CRM" />
            <input name="key" type="password" placeholder="Новий ключ API (порожньо — лишити старий)" autoComplete="off" aria-label="Ключ API" />
            <div><SubmitButton className="ghost small">Зберегти і перевірити</SubmitButton></div>
          </form>
          <form action={crmDisconnectAction}>{hid}<button className="ghost small danger-text">Відключити CRM</button></form>
        </div>
      </details>
      {!link.last_event_at && secretBox}
    </section>
  );
}
