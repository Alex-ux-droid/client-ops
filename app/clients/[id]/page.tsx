import Link from "next/link";
import { notFound } from "next/navigation";
import {
  attachPlaybookAction, detachPlaybookAction, logWork, playbookToTasks, removeAdStat, removeMaterial, removeWork,
  saveAdStat, saveIdea, saveMaterial, saveNextStep, savePayment, toggleItem,
} from "@/app/actions";
import AddTask from "@/components/AddTask";
import { LineChart } from "@/components/Charts";
import PaymentRow from "@/components/PaymentRow";
import TaskItem from "@/components/TaskItem";
import { money } from "@/lib/config";
import { addDays, fmtDate, ymd } from "@/lib/dates";
import { KIND_LABEL, STAGE_LABEL, STATUS_LABEL, STATUS_TAG } from "@/lib/labels";
import { cpl, ctr, listAdStats, roas } from "@/lib/repo/ads";
import { clientFlags, getClientRow } from "@/lib/repo/clients";
import { listIdeas } from "@/lib/repo/ideas";
import { listMaterials, MATERIAL_KINDS } from "@/lib/repo/materials";
import { listPayments } from "@/lib/repo/payments";
import { checklistItems, clientPlaybooks, listPlaybooks } from "@/lib/repo/playbooks";
import { listTasks } from "@/lib/repo/tasks";
import { listWork } from "@/lib/repo/worklog";

const TABS = [
  { k: "overview", label: "Огляд" },
  { k: "tasks", label: "Задачі" },
  { k: "history", label: "Історія" },
  { k: "ads", label: "Реклама" },
  { k: "money", label: "Гроші" },
  { k: "materials", label: "Матеріали" },
  { k: "playbooks", label: "Плейбуки" },
] as const;
type Tab = (typeof TABS)[number]["k"];

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const id = Number((await params).id);
  const c = getClientRow(id);
  if (!c) notFound();
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.k === sp.tab)?.k ?? "overview") as Tab;
  const flags = clientFlags(c);
  const tasks = listTasks("all", id);
  const payments = listPayments({ clientId: id });
  const paidTotal = payments.filter((p) => p.paid_at).reduce((s, p) => s + p.amount, 0);
  const ads = listAdStats(id);
  const lastAd = ads.at(-1);
  const pbs = clientPlaybooks(id);
  const badge: Partial<Record<Tab, number>> = { tasks: tasks.length, playbooks: pbs.length };

  return (
    <>
      <div className="hub-head">
        <div className="hub-top">
          <div style={{ minWidth: 0 }}>
            <div className="kicker"><Link href="/clients">Клієнти</Link> / {c.niche || "без ніші"}</div>
            <h1>{c.name}</h1>
            <div className="meta">
              <span className={`tag ${STATUS_TAG[c.status]}`}>{STATUS_LABEL[c.status]}{c.status === "lead" ? ` · ${STAGE_LABEL[c.stage]}` : ""}</span>
              {c.offer && <span className="tag">{c.offer}</span>}
              {flags.map((f) => <span key={f.text} className={`tag ${f.level}`}>{f.text}</span>)}
            </div>
          </div>
          <Link href={`/clients/${id}/edit`} className="btn ghost">Редагувати</Link>
        </div>

        <form action={saveNextStep} className="next-step">
          <input type="hidden" name="id" value={id} />
          <span>Наступний крок</span>
          <input name="next_step" defaultValue={c.next_step} placeholder="Що робимо далі з цим клієнтом?" aria-label="Наступний крок" />
          <button className="ghost small">Ок</button>
        </form>

        <div className="kpis">
          <div className="kpi"><div className="n">{c.fee_monthly ? money(c.fee_monthly) : "—"}</div><div className="l">Платить / міс</div></div>
          <div className="kpi"><div className="n" style={{ color: c.debt ? "var(--bad)" : undefined }}>{money(c.debt)}</div><div className="l">Борг</div></div>
          <div className="kpi"><div className="n">{lastAd && cpl(lastAd) !== null ? money(cpl(lastAd)) : "—"}</div><div className="l">Ціна ліда (остання)</div></div>
          <div className="kpi"><div className="n">{c.last_work ? fmtDate(c.last_work) : "—"}</div><div className="l">Остання робота</div></div>
        </div>
      </div>

      <nav className="subnav">
        {TABS.map((t) => (
          <Link key={t.k} href={`/clients/${id}?tab=${t.k}`} className={t.k === tab ? "on" : ""} scroll={false}>
            {t.label}{badge[t.k] ? <b>{badge[t.k]}</b> : null}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <Overview c={c} id={id} tasks={tasks.slice(0, 5)} paidTotal={paidTotal} />}
      {tab === "tasks" && <TasksTab id={id} />}
      {tab === "history" && <HistoryTab id={id} />}
      {tab === "ads" && <AdsTab id={id} />}
      {tab === "money" && <MoneyTab id={id} fee={c.fee_monthly} payDay={c.pay_day} paidTotal={paidTotal} />}
      {tab === "materials" && <MaterialsTab id={id} />}
      {tab === "playbooks" && <PlaybooksTab id={id} />}
    </>
  );
}

function Overview({ c, id, tasks, paidTotal }: { c: NonNullable<ReturnType<typeof getClientRow>>; id: number; tasks: ReturnType<typeof listTasks>; paidTotal: number }) {
  const work = listWork(id, 4);
  const ideas = listIdeas({ clientId: id, status: "new" });
  return (
    <div className="split">
      <div className="stack" style={{ gap: 20 }}>
        <div className="grid2">
          <dl className="card kv">
            <div><dt>Що хоче клієнт</dt><dd>{c.needs}</dd></div>
            <div><dt>Бачення клієнта</dt><dd>{c.client_vision}</dd></div>
            <div><dt>Бюджет</dt><dd>{c.budget}</dd></div>
          </dl>
          <dl className="card kv">
            <div><dt style={{ color: "var(--accent)" }}>Моє бачення</dt><dd>{c.my_vision}</dd></div>
            <div><dt>Нотатки</dt><dd>{c.notes}</dd></div>
          </dl>
        </div>
        <div>
          <h2 style={{ marginBottom: 10, display: "flex", justifyContent: "space-between" }}>Відкриті задачі <Link href={`/clients/${id}?tab=tasks`} style={{ color: "var(--cyan)" }}>всі →</Link></h2>
          <div className="list">{tasks.length ? tasks.map((t) => <TaskItem key={t.id} t={t} showClient={false} />) : <div className="empty">Задач нема.</div>}</div>
        </div>
        <div>
          <h2 style={{ marginBottom: 10, display: "flex", justifyContent: "space-between" }}>Останні роботи <Link href={`/clients/${id}?tab=history`} style={{ color: "var(--cyan)" }}>вся історія →</Link></h2>
          <div className="list timeline">
            {work.length ? work.map((w) => (
              <div key={w.id} className="row"><div className="row-main"><div className="mono">{fmtDate(w.done_at)}</div><div className="row-title">{w.what}</div>{w.result && <div className="row-sub" style={{ color: "var(--ok)" }}>{w.result}</div>}</div></div>
            )) : <div className="empty">Ще нічого не записано.</div>}
          </div>
        </div>
      </div>
      <div className="stack" style={{ gap: 20 }}>
        <dl className="card kv">
          <div><dt>Контакти</dt><dd>{c.contacts}</dd></div>
          <div><dt>Bitwarden</dt><dd>{c.bitwarden_ref}</dd></div>
          <div><dt>Всього отримано</dt><dd style={{ fontFamily: "var(--font-mono)" }}>{money(paidTotal)}</dd></div>
          <div><dt>Клієнт з</dt><dd>{fmtDate(c.created_at)}</dd></div>
        </dl>
        <div>
          <h2 style={{ marginBottom: 10 }}>Ідеї</h2>
          <form action={saveIdea} className="inline" style={{ marginBottom: 8 }}>
            <input type="hidden" name="client_id" value={id} />
            <input name="text" placeholder="Ідея для клієнта…" required aria-label="Ідея" />
            <button>✦</button>
          </form>
          <div className="list">{ideas.length ? ideas.map((i) => <div key={i.id} className="row"><div className="row-main"><div className="row-title">{i.text}</div></div></div>) : <div className="empty">Ідей нема.</div>}</div>
        </div>
      </div>
    </div>
  );
}

function TasksTab({ id }: { id: number }) {
  const open = listTasks("all", id);
  const doneList = listTasks("done", id).slice(0, 10);
  return (
    <>
      <AddTask clientId={id} />
      <div className="list" style={{ marginTop: 10 }}>{open.length ? open.map((t) => <TaskItem key={t.id} t={t} showClient={false} />) : <div className="empty">Відкритих задач нема.</div>}</div>
      {doneList.length > 0 && (
        <div className="section"><h2 style={{ marginBottom: 10 }}>Нещодавно закриті</h2><div className="list">{doneList.map((t) => <TaskItem key={t.id} t={t} showClient={false} />)}</div></div>
      )}
    </>
  );
}

function HistoryTab({ id }: { id: number }) {
  const work = listWork(id, 200);
  return (
    <>
      <details className="card" style={{ marginBottom: 10 }} open={!work.length}>
        <summary className="mono" style={{ color: "var(--cyan)" }}>+ записати що зробили</summary>
        <form action={logWork} className="stack" style={{ marginTop: 12 }}>
          <input type="hidden" name="client_id" value={id} />
          <input name="what" placeholder="Що зробив" required aria-label="Що зробив" />
          <input name="why" placeholder="Чому / навіщо" aria-label="Чому" />
          <input name="result" placeholder="Результат" aria-label="Результат" />
          <div className="inline"><input type="date" name="done_at" defaultValue={ymd()} aria-label="Дата" /><button>Записати</button></div>
        </form>
      </details>
      <div className="list timeline">
        {work.length ? work.map((w) => (
          <div key={w.id} className="row">
            <div className="row-main">
              <div className="mono">{fmtDate(w.done_at)}{w.task_id ? " · із задачі" : ""}</div>
              <div className="row-title">{w.what}</div>
              {w.why && <div className="row-sub">Чому: {w.why}</div>}
              {w.result && <div className="row-sub" style={{ color: "var(--ok)" }}>Результат: {w.result}</div>}
            </div>
            <form action={removeWork}><input type="hidden" name="id" value={w.id} /><button className="ghost small" title="Видалити">✕</button></form>
          </div>
        )) : <div className="empty">Історії ще нема.</div>}
      </div>
    </>
  );
}

function AdsTab({ id }: { id: number }) {
  const ads = listAdStats(id);
  const tot = ads.reduce((a, s) => ({ spend: a.spend + s.spend, leads: a.leads + s.leads, sales: a.sales + s.sales, revenue: a.revenue + s.revenue, clicks: a.clicks + s.clicks, impressions: a.impressions + s.impressions }),
    { spend: 0, leads: 0, sales: 0, revenue: 0, clicks: 0, impressions: 0 });
  const label = (s: (typeof ads)[number]) => fmtDate(s.period_end).slice(0, 5);
  return (
    <>
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="n">{money(tot.spend)}</div><div className="l">Витрачено всього</div></div>
        <div className="kpi"><div className="n">{tot.leads}</div><div className="l">Лідів</div></div>
        <div className="kpi"><div className="n">{cpl(tot) !== null ? money(cpl(tot)) : "—"}</div><div className="l">Середня ціна ліда</div></div>
        <div className="kpi"><div className="n">{roas(tot) !== null ? `${roas(tot)!.toFixed(1)}×` : "—"}</div><div className="l">Окупність (ROAS)</div></div>
      </div>

      {ads.length > 1 && (
        <div className="grid2" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="chart-title"><span>Ціна ліда по періодах</span><b>{cpl(ads.at(-1)!) !== null ? money(cpl(ads.at(-1)!)) : "—"}</b></div>
            <LineChart fmt={(n) => money(n)} data={ads.map((s) => ({ label: label(s), value: cpl(s), tip: `${fmtDate(s.period_start)}–${fmtDate(s.period_end)}: ${cpl(s) !== null ? money(cpl(s)) : "нема лідів"}` }))} />
          </div>
          <div className="card">
            <div className="chart-title"><span>Ліди по періодах</span><b>{ads.at(-1)!.leads}</b></div>
            <LineChart fmt={(n) => String(Math.round(n))} data={ads.map((s) => ({ label: label(s), value: s.leads, tip: `${fmtDate(s.period_start)}–${fmtDate(s.period_end)}: ${s.leads} лідів` }))} />
          </div>
        </div>
      )}

      <details className="card" style={{ marginBottom: 10 }} open={!ads.length}>
        <summary className="mono" style={{ color: "var(--cyan)" }}>+ додати цифри з кабінету за період</summary>
        <form action={saveAdStat} className="form-grid" style={{ marginTop: 12 }}>
          <input type="hidden" name="client_id" value={id} />
          <div className="field"><label htmlFor="ps">Початок</label><input id="ps" type="date" name="period_start" defaultValue={addDays(-7)} required /></div>
          <div className="field"><label htmlFor="pe">Кінець</label><input id="pe" type="date" name="period_end" defaultValue={addDays(-1)} required /></div>
          <div className="field"><label htmlFor="spend">Витрачено</label><input id="spend" name="spend" inputMode="decimal" placeholder="0" /></div>
          <div className="field"><label htmlFor="leads">Ліди</label><input id="leads" name="leads" inputMode="numeric" placeholder="0" /></div>
          <div className="field"><label htmlFor="impr">Покази</label><input id="impr" name="impressions" inputMode="numeric" placeholder="0" /></div>
          <div className="field"><label htmlFor="clicks">Кліки</label><input id="clicks" name="clicks" inputMode="numeric" placeholder="0" /></div>
          <div className="field"><label htmlFor="sales">Продажі</label><input id="sales" name="sales" inputMode="numeric" placeholder="0" /></div>
          <div className="field"><label htmlFor="rev">Виручка клієнта</label><input id="rev" name="revenue" inputMode="decimal" placeholder="0" /></div>
          <div className="field"><label htmlFor="plat">Платформа</label><select id="plat" name="platform" defaultValue="facebook"><option value="facebook">Facebook / Instagram</option><option value="google">Google</option><option value="tiktok">TikTok</option><option value="other">Інше</option></select></div>
          <div className="field"><label htmlFor="adnote">Коментар</label><input id="adnote" name="note" placeholder="що змінювали" /></div>
          <div className="wide"><button>Зберегти період</button></div>
        </form>
      </details>

      {ads.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Період</th><th className="num">Витрачено</th><th className="num">Ліди</th><th className="num">Ціна ліда</th><th className="num">CTR</th><th className="num">Продажі</th><th className="num">ROAS</th><th>Коментар</th><th /></tr></thead>
            <tbody>
              {[...ads].reverse().map((s) => (
                <tr key={s.id}>
                  <td>{fmtDate(s.period_start)}–{fmtDate(s.period_end)}</td>
                  <td className="num">{money(s.spend)}</td>
                  <td className="num">{s.leads}</td>
                  <td className="num">{cpl(s) !== null ? money(cpl(s)) : "—"}</td>
                  <td className="num">{ctr(s) !== null ? `${ctr(s)!.toFixed(2)}%` : "—"}</td>
                  <td className="num">{s.sales || "—"}</td>
                  <td className="num">{roas(s) ? `${roas(s)!.toFixed(1)}×` : "—"}</td>
                  <td style={{ color: "var(--muted)" }}>{s.note}</td>
                  <td><form action={removeAdStat}><input type="hidden" name="id" value={s.id} /><button className="ghost small" title="Видалити">✕</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function MoneyTab({ id, fee, payDay, paidTotal }: { id: number; fee: number; payDay: number; paidTotal: number }) {
  const payments = listPayments({ clientId: id });
  return (
    <div className="split">
      <div>
        <div className="list">{payments.length ? payments.map((p) => <PaymentRow key={p.id} p={p} showClient={false} />) : <div className="empty">Оплат ще нема.</div>}</div>
      </div>
      <div className="stack">
        <div className="card mono">
          {fee ? `Щомісяця ${money(fee)}, день оплати ${payDay}.` : "Щомісячна оплата не вказана (Редагувати → «Платить щомісяця»)."} Всього отримано {money(paidTotal)}.
        </div>
        <form action={savePayment} className="card stack">
          <input type="hidden" name="client_id" value={id} />
          <div className="inline">
            <input name="amount" inputMode="decimal" placeholder="Сума" required defaultValue={fee || ""} aria-label="Сума" />
            <input type="date" name="due_date" defaultValue={ymd()} aria-label="Дата" />
          </div>
          <label className="check-line"><input type="checkbox" name="paid" value="1" defaultChecked /> Вже отримав</label>
          <input name="note" placeholder="Коментар" aria-label="Коментар" />
          <button>Додати оплату</button>
        </form>
      </div>
    </div>
  );
}

function MaterialsTab({ id }: { id: number }) {
  const materials = listMaterials(id);
  return (
    <>
      <details className="card" style={{ marginBottom: 10 }} open={!materials.length}>
        <summary className="mono" style={{ color: "var(--cyan)" }}>+ вставити чат, звіт або бриф</summary>
        <form action={saveMaterial} className="stack" style={{ marginTop: 12 }}>
          <input type="hidden" name="client_id" value={id} />
          <div className="inline">
            <select name="kind" defaultValue="chat" style={{ maxWidth: 140 }} aria-label="Тип">
              {MATERIAL_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <input name="title" placeholder="Назва (необов'язково)" aria-label="Назва" />
          </div>
          <textarea name="content" placeholder="Встав сюди переписку з клієнтом, цифри з кабінету, бриф…" required style={{ minHeight: 160 }} aria-label="Текст" />
          <button>Зберегти</button>
        </form>
      </details>
      <div className="list">
        {materials.length ? materials.map((m) => (
          <details key={m.id} className="row" style={{ display: "block" }}>
            <summary>
              <div className="row-title">{m.title}</div>
              <div className="meta"><span className="tag">{KIND_LABEL[m.kind]}</span><span className="mono">{fmtDate(m.created_at)}</span></div>
            </summary>
            <pre className="material">{m.content}</pre>
            <form action={removeMaterial} style={{ marginTop: 8 }}><input type="hidden" name="id" value={m.id} /><button className="ghost small">Видалити</button></form>
          </details>
        )) : <div className="empty">Матеріалів нема.</div>}
      </div>
    </>
  );
}

function PlaybooksTab({ id }: { id: number }) {
  const attached = clientPlaybooks(id);
  const free = listPlaybooks().filter((p) => !attached.some((a) => a.playbook_id === p.id));
  return (
    <>
      {free.length > 0 && (
        <form action={attachPlaybookAction} className="inline" style={{ marginBottom: 14 }}>
          <input type="hidden" name="client_id" value={id} />
          <select name="playbook_id" required defaultValue="" aria-label="Плейбук">
            <option value="">Підключити плейбук…</option>
            {free.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.items})</option>)}
          </select>
          <button>Підключити</button>
        </form>
      )}
      <div className="stack" style={{ gap: 12 }}>
        {attached.length ? attached.map((cp) => {
          const items = checklistItems(cp.body_md);
          const pct = items.length ? Math.round((cp.checked.length / items.length) * 100) : 0;
          return (
            <div key={cp.id} className="card">
              <div className="hub-top" style={{ marginBottom: 8 }}>
                <Link href={`/playbooks/${cp.playbook_id}`} className="row-title">{cp.title}</Link>
                <span className="mono">{cp.checked.length}/{items.length} · {pct}%</span>
              </div>
              <div className={`bar ${pct === 100 ? "ok" : ""}`} style={{ marginBottom: 8 }}><i style={{ width: `${pct}%` }} /></div>
              {items.map((it, i) => {
                const on = cp.checked.includes(i);
                return (
                  <form key={i} action={toggleItem} className={`check-item ${on ? "done" : ""}`}>
                    <input type="hidden" name="id" value={cp.id} />
                    <input type="hidden" name="index" value={i} />
                    <button className={`check ${on ? "done" : ""}`}>✓</button>
                    <span>{it}</span>
                  </form>
                );
              })}
              <div className="inline" style={{ marginTop: 10, flexWrap: "wrap" }}>
                {pct < 100 && (
                  <form action={playbookToTasks} className="inline">
                    <input type="hidden" name="id" value={cp.id} />
                    <input type="hidden" name="client_id" value={id} />
                    <input type="date" name="due_date" defaultValue={ymd()} aria-label="Дедлайн" style={{ maxWidth: 160 }} />
                    <button className="ghost small">Решту → в задачі</button>
                  </form>
                )}
                <form action={detachPlaybookAction}><input type="hidden" name="id" value={cp.id} /><button className="ghost small">Відключити</button></form>
              </div>
            </div>
          );
        }) : <div className="empty card">Жоден плейбук не підключено. {free.length ? "Обери вище." : <Link href="/playbooks/new" style={{ color: "var(--cyan)" }}>Створи перший →</Link>}</div>}
      </div>
    </>
  );
}
