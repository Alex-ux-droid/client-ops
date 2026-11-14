// Продажі клієнта з його CRM: повна воронка з усіх джерел + «реклама → продажі» по кожному оголошенню
import DataTable from "@/components/DataTable";
import Link from "next/link";
import { headers } from "next/headers";
import SubmitButton from "@/components/SubmitButton";
import { CopyText } from "@/app/startups/[id]/CopyText";
import { connectCrmAction, crmDisconnectAction, crmNotManagersAction, crmPullAction, crmSecretAction } from "@/app/crm/actions";
import { crmByAd, crmKey, crmSecret, crmStats, REASON_UA, SOURCE_UA, STATUS_UA } from "@/lib/crm";
import { crmEvents, crmLeads, getCrmLink, notManagers } from "@/lib/repo/crm";
import { ComboChart } from "@/components/Charts";
import Pop from "@/components/Pop";
import ListPop from "@/components/ListPop";
import Icon from "@/components/Icon";
import { BrandDot } from "@/components/Brand";
import { accountsForClient, adTotalsForClient } from "@/lib/repo/meta";
import { getSetting } from "@/lib/repo/settings";

const BASE_UA: Record<string, string> = { leads_per_month: "лідів на місяць", conversion_pct: "конверсія в продаж, %", conversion: "конверсія в продаж", avg_check: "середній чек", revenue_per_month: "дохід на місяць", source: "звідки цифри", fixed_at: "зафіксовано", note: "примітка" };
// Точка нуль: показуємо тільки відомі поля, дати — по-людськи
const baseVal = (k: string, v: unknown) => {
  const t = String(v);
  if (k === "fixed_at" && !Number.isNaN(Date.parse(t))) return new Date(t).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv", day: "numeric", month: "long", year: "numeric" });
  if (typeof v === "number") return v.toLocaleString("uk-UA");
  return t;
};
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
          <span className="mono" title="Секрет не показується на екрані — тільки копіювання">Секрет: ••••••{once.slice(-4)}</span><CopyText text={once} label="Копіювати секрет" />
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
  // Графік: ліди (за датою створення) і продажі (за датою продажу) — по днях / тижнях / місяцях
  const all = crmLeads(clientId);
  const bucket = (iso: string) => days <= 31 ? iso.slice(0, 10) : days <= 120 ? weekStart(iso) : iso.slice(0, 7);
  const keys: string[] = [];
  for (let t = Date.parse(since); t <= Date.now(); t += 86400_000) { const k = bucket(new Date(t).toISOString()); if (keys.at(-1) !== k) keys.push(k); }
  const series = keys.map((k) => {
    const leads = all.filter((l) => l.created_at >= since && bucket(l.created_at) === k).length;
    const sold = all.filter((l) => l.won_at && l.won_at >= since && bucket(l.won_at) === k);
    return { label: days <= 31 ? k.slice(8, 10) : days <= 120 ? k.slice(5).split("-").reverse().join(".") : k.slice(5), bar: leads, line: sold.length, tip: `${k}: лідів ${leads}, продажів ${sold.length}${sold.length ? ` на ${m(sold.reduce((x, l) => x + (l.deal_amount ?? 0), 0))}` : ""}` };
  });
  const row = (a: string, b: string) => `${a} — ${b}`;

  return (
    <section className="stack" style={{ gap: "1rem" }}>
      {msg}
      <div className="mx-warn sl-status" style={link.last_error ? undefined : { borderColor: "var(--line)", background: "var(--bg-raise)" }}>
        <Icon name={link.last_error ? "alert" : "check"} size={15} />
        <span><b>CRM підключена</b> · остання подія {dt(link.last_event_at)} · підтягнуто {dt(link.last_pull_at)}{!crmKey(clientId) ? " · нема ключа" : ""}{link.last_error ? ` · ${link.last_error}` : ""}</span>
        <span className="grow" />
        <form action={crmPullAction}>{hid}<SubmitButton className="ghost small">Оновити зараз</SubmitButton></form>
      </div>

      <nav className="mx-tabs">{PERIODS.map((p) => <Link key={p.k} href={p.k === "30" ? base : `${base}&sp=${p.k}`} scroll={false} className={String(days) === p.k ? "on" : ""}>{p.label}</Link>)}</nav>

      <div className="kpis meta-kpis">
        <div className="kpi"><div className="n">{st.leads}</div><div className="l">лідів (усі джерела)</div></div>
        <div className="kpi"><div className="n" style={{ color: st.sales ? "var(--ok)" : undefined }}>{st.sales}</div><div className="l">продажів</div></div>
        <div className="kpi"><div className="n" style={{ color: st.revenue ? "var(--ok)" : undefined }}>{m(st.revenue)}</div><div className="l">продано на суму</div></div>
        <div className="kpi"><div className="n">{st.conv == null ? "—" : `${st.conv.toFixed(1)}%`}</div><div className="l">лід → продаж</div></div>
      </div>
      <div className="mx-strip sl-strip">
        <span className="mx-strip-h">ще</span>
        <div><b>{m(st.avgCheck)}</b><span>середній чек</span></div>
        <div><b>{m(st.paid)}</b><span>оплачено</span></div>
        <div title={`Медіана по ${st.contacted} лідах, з якими вже звʼязались. Ті, з ким ще ні, — у «без контакту».`}><b>{mins(st.speedMin)}</b><span>до першого контакту{st.contacted ? ` (з ${st.contacted})` : ""}</span></div>
        <div title="Нема ні першого контакту, ні спроби дзвінка (сміття не рахуємо)"><b style={st.noContact ? { color: "var(--warn)" } : undefined}>{st.noContact}{st.noContactPct ? ` (${st.noContactPct}%)` : ""}</b><span>без контакту</span></div>
      </div>

      {series.length > 1 && <div className="card"><ComboChart barName="Ліди" lineName="Продажі" fmtBar={(n) => String(Math.round(n))} fmtLine={(n) => String(Math.round(n))} data={series} /></div>}

      <div className="qt-grid">
        <Pop className="pop-card qt qt-accent" wide title={`Реклама → продажі · по оголошеннях за весь час${metaCur && cur && metaCur !== cur ? ` · увага: реклама в ${metaCur}, продажі в ${cur}` : ""}`} trigger={
          <>
            <span className="qt-h"><span className="qt-t"><span className="qt-ico"><BrandDot text="Meta" size={14} /></span><b>Реклама → продажі</b></span><span className="qt-n">{ads.length}</span></span>
            {ads.filter((a) => a.sales).slice(0, 2).map((a) => <span key={a.ad_id} className="qt-l">{a.ad_name}: {a.sales} прод. · {a.roas == null ? "—" : `ROAS ${a.roas.toFixed(1)}`}</span>)}
            {!ads.some((a) => a.sales) && <span className="qt-l mono">{ads.length ? "продажів з реклами ще нема" : "ще нема даних по оголошеннях"}</span>}
            <span className="qt-more">таблиця →</span>
          </>
        }>
          {ads.length ? (
            <DataTable id="sales-by-ad" cols={[
              { id: "ad", label: "Оголошення", w: 280, pin: true }, { id: "spend", label: "Витрати", num: true }, { id: "meta", label: "Ліди Meta", num: true, w: 110 },
              { id: "crm", label: "У CRM", num: true, w: 100 }, { id: "meet", label: "Показ+", num: true, w: 100 }, { id: "sales", label: "Продажі", num: true, w: 100 },
              { id: "rev", label: "Сума", num: true, w: 140 }, { id: "cps", label: "Ціна продажу", num: true, w: 140 }, { id: "roas", label: "ROAS", num: true, w: 90 },
            ]} rows={ads.map((a) => ({ key: a.ad_id, cells: {
              ad: { v: a.ad_name, sub: a.campaign_name || undefined },
              spend: { v: a.spend, t: mm(a.spend) }, meta: a.metaLeads ?? null, crm: a.crmLeads, meet: a.meetings, sales: { v: a.sales, tone: a.sales ? "good" : undefined },
              rev: { v: a.revenue, t: a.revenue ? m(a.revenue) : "—" }, cps: { v: a.cps, t: mm(a.cps) },
              roas: { v: a.roas, t: a.roas == null ? "—" : a.roas.toFixed(1), tone: a.roas == null ? undefined : a.roas >= 1 ? "good" : "bad" },
            } }))} />
          ) : <p className="mono">Ще нема лідів з оголошеннями Meta або витрат по оголошеннях (витрати за весь час підтягуються раз на добу).</p>}
        </Pop>
        <ListPop title="Джерела" ico="funnel" items={st.bySource.map((x) => row(SOURCE_UA[x.key] ?? x.key, `${x.leads} лід. · ${x.sales} прод. · ${m(x.revenue)}`))} empty="—" />
        <ListPop title="Менеджери" ico="users" items={st.managers.map((x) => row(x.key, `${x.leads} лід. · ${x.sales} прод. · ${m(x.revenue)} · реакція ${mins(x.speedMin)}`))} empty="—" />
        <ListPop title="Де зараз ліди" ico="flag" items={st.byStatus.map((x) => row(STATUS_UA[x.key] ?? x.key, String(x.n)))} empty="—" />
        <ListPop title="Чому відмовились" ico="alert" tone="bad" items={st.lost.map((x) => row(REASON_UA[x.key] ?? x.key, String(x.n)))} empty="відмов з причиною нема" />
        {baseline && Object.keys(baseline).length > 0 && (
          <ListPop title="Точка нуль (до нас)" ico="compass" tone="accent" items={Object.entries(baseline).filter(([k, v]) => k in BASE_UA && v != null && v !== "" && typeof v !== "object").map(([k, v]) => row(BASE_UA[k], baseVal(k, v)))} empty="—" />
        )}
        <ListPop title="Події з CRM" ico="clock" items={events.map((e) => `${dt(e.occurred_at)} · ${e.event} · ${e.summary}`)} empty="подій ще не було" />
        <Pop className="pop-card qt" wide title="Підключення CRM" trigger={<><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="gear" /></span><b>Підключення</b></span></span><span className="qt-l">{link.base_url.replace(/^https?:\/\//, "")}</span><span className="qt-more">вебхук, ключ →</span></>}>
          <div className="stack" style={{ gap: "0.75rem" }}>
            {secretBox}
            <form action={connectCrmAction} className="stack" style={{ gap: "0.5rem" }}>
              {hid}
              <input name="base_url" defaultValue={link.base_url} required aria-label="Адреса API CRM" />
              <input name="key" type="password" placeholder="Новий ключ API (порожньо — лишити старий)" autoComplete="off" aria-label="Ключ API" />
              <div><SubmitButton className="ghost small">Зберегти і перевірити</SubmitButton></div>
            </form>
            <form action={crmNotManagersAction} className="stack" style={{ gap: "0.5rem" }}>
              {hid}
              <b>Хто не менеджер</b>
              <div className="mono">Імена з CRM, на кого ліди падають за замовчуванням (напр. власник). Їхні ліди в «Менеджерах» підуть як «не призначено». Через кому.</div>
              <input name="names" defaultValue={notManagers(clientId).join(", ")} placeholder="напр. Олег Власник" aria-label="Хто не менеджер" />
              <div><SubmitButton className="ghost small">Зберегти</SubmitButton></div>
            </form>
            <form action={crmDisconnectAction}>{hid}<button className="ghost small danger-text">Відключити CRM</button></form>
          </div>
        </Pop>
      </div>
      {!link.last_event_at && secretBox}
    </section>
  );
}

// Понеділок тижня (для графіка по тижнях)
function weekStart(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
