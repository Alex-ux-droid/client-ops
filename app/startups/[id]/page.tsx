import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import AskAssistant from "@/components/AskAssistant";
import Markdown from "@/components/Markdown";
import SubmitButton from "@/components/SubmitButton";
import TaskItem from "@/components/TaskItem";
import VoiceTextarea from "@/components/VoiceTextarea";
import { fmtDate } from "@/lib/dates";
import { getClient, listClients } from "@/lib/repo/clients";
import { FLOW, getStartup, listItems, PILLARS, STAGES, type PillarKey, type Startup, type StartupItem } from "@/lib/repo/startups";
import { currency, money } from "@/lib/config";
import { calcFinance, effectiveFinance, hasFinance } from "@/lib/startupFinance";
import FinanceCalc from "./FinanceCalc";
import IdeaView from "./views/IdeaView";
import MarketingView from "./views/MarketingView";
import TechView from "./views/TechView";
import { OldNotes, StepsBar, stepsOf } from "./views/shared";
import { finLinks, formulaText } from "@/lib/startupSystem";

import { startupTasks } from "@/lib/repo/tasks";
import {
  addItemAction, addStartupTaskAction, deleteItemAction, deleteStartupAction, saveStartupAction, updateItemAction,
} from "../actions";
import Monitor from "./Monitor";
import StartupAssistant from "./StartupAssistant";

export const dynamic = "force-dynamic";

// Чотири опори (ідея, маркетинг, технічна з ТЗ, фінанси) + робочі вкладки
const VIEWS = [
  { k: "overview", label: "Огляд" },
  { k: "idea", label: "1 · Ідея" },
  { k: "marketing", label: "2 · Маркетинг" },
  { k: "tech", label: "3 · Технічна" },
  { k: "finance", label: "4 · Фінанси" },
  { k: "plan", label: "План" },
  { k: "tests", label: "Тести" },
  { k: "decisions", label: "Рішення" },
  { k: "notes", label: "Нотатки" },
  { k: "monitor", label: "Моніторинг" },
] as const;
const ALIAS: Record<string, string> = { canvas: "idea", spec: "tech" }; // старі посилання
type View = (typeof VIEWS)[number]["k"];

const MS = [
  { k: "now", label: "Зараз" }, { k: "next", label: "Далі" }, { k: "later", label: "Потім" }, { k: "done", label: "Готово" },
] as const;
const EXP = [
  { k: "planned", label: "Плануємо" }, { k: "running", label: "Тестуємо" }, { k: "confirmed", label: "Підтвердилось" }, { k: "refuted", label: "Не підтвердилось" },
] as const;

export default async function StartupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const id = Number((await params).id);
  const s = getStartup(id);
  if (!s) notFound();
  const sv = (await searchParams).v;
  const v = (VIEWS.find((x) => x.k === (ALIAS[sv ?? ""] ?? sv))?.k ?? "overview") as View;
  const items = listItems(id);
  const by = (k: StartupItem["kind"]) => items.filter((i) => i.kind === k);
  const client = s.client_id ? getClient(s.client_id) : undefined;
  const hidden = <input type="hidden" name="id" value={id} />;
  const base = `/startups/${id}`;

  return (
    <div className="su su-ws">
      <Suspense><StartupAssistant id={id} /></Suspense>
      <div className="su-head">
        <Link href="/startups" className="h-link">Стартапи</Link>
        <div className="su-title-row">
          <h1>{s.name}</h1>
          <details className="lab-edit su-edit-head">
            <summary>Редагувати</summary>
            <form action={saveStartupAction} className="stack" style={{ marginTop: "0.75rem" }}>
              {hidden}<input type="hidden" name="v" value={v} />
              <input name="name" defaultValue={s.name} placeholder="Назва" />
              <input name="one_liner" defaultValue={s.one_liner} placeholder="Одним реченням: що це і для кого" />
              <input name="north_star" defaultValue={s.north_star} placeholder="Головна метрика: напр. «10 забудовників платять $200/міс»" />
              <select name="client_id" defaultValue={s.client_id ?? ""}>
                <option value="">— без першого клієнта —</option>
                {listClients().filter((c) => c.status !== "archived").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <SubmitButton className="small" />
            </form>
          </details>
        </div>
        {formulaText(s.idea.formula) ? <p className="su-line">{formulaText(s.idea.formula)}</p> : s.one_liner ? <p className="su-line">{s.one_liner}</p> : <p className="su-line lab-muted">Одне речення суті — попроси Джері або «Редагувати».</p>}
        <Stages s={s} v={v} />
        <div className="su-links">
          {s.north_star && <span className="tag accent">★ {s.north_star}</span>}
          {client && <Link href={`/clients/${client.id}`} className="tag">перший клієнт: {client.name}</Link>}
          {s.lab_id && <Link href={`/lab/${s.lab_id}`} className="tag">з Лабораторії</Link>}
          {s.repo && <a href={`https://github.com/${s.repo}`} target="_blank" rel="noreferrer" className="tag">GitHub: {s.repo} ↗</a>}
          {s.prod_url && <a href={s.prod_url} target="_blank" rel="noreferrer" className="tag">{s.prod_url.replace(/^https?:\/\//, "")} ↗</a>}
        </div>
      </div>

      <nav className="mx-tabs su-tabs">
        {VIEWS.map((x) => (
          <Link key={x.k} href={x.k === "overview" ? base : `${base}?v=${x.k}`} scroll={false} className={x.k === v ? "on" : ""}>
            {x.label}{PILLARS.some((p) => p.k === x.k) ? (() => { const st = stepsOf(s, items, x.k as PillarKey); return <em>{st.filter((z) => z.done).length}/{st.length}</em>; })() : x.k === "tests" && by("experiment").length ? <em>{by("experiment").length}</em> : null}
          </Link>
        ))}
      </nav>

      {v === "overview" && <Overview s={s} items={items} />}
      {v === "idea" && <IdeaView s={s} items={items} />}
      {v === "marketing" && <MarketingView s={s} items={items} />}
      {v === "tech" && <TechView s={s} items={items} />}
      {v === "finance" && (
        <div className="stack" style={{ gap: "1.25rem" }}>
          <StepsBar s={s} items={items} p="finance" ask="Порахуй фінанси цього стартапу: тарифи з обґрунтуванням ціни, витрати на клієнта, стартові вкладення, ріст і відтік (startup_update finance; tiers — масив {name, price, share}). Якщо в маркетингу є воронка, а в технічній — ціни інфраструктури, увімкни link_mkt і link_tech. Поясни, звідки цифри, і дай чесний висновок: вигідно чи ні, що найризикованіше." />
          <FinanceCalc id={s.id} initial={s.finance} cur={currency()} links={finLinks(s.mkt, items)} />
          <OldNotes s={s} p="finance" />
        </div>
      )}
      {v === "plan" && <Plan s={s} milestones={by("milestone")} />}
      {v === "tests" && <Tests s={s} items={by("experiment")} />}
      {v === "decisions" && <Decisions s={s} items={by("decision")} />}
      {v === "notes" && <Notes s={s} items={items.filter((i) => i.kind === "note" || i.kind === "link")} />}
      {v === "monitor" && <Monitor s={s} />}

      <details className="danger-zone" style={{ marginTop: "2.5rem" }}>
        <summary>Видалити проєкт</summary>
        <form action={deleteStartupAction} style={{ marginTop: "0.75rem" }}>{hidden}<button className="ghost small">Так, видалити назавжди</button></form>
      </details>
    </div>
  );
}

// Стадії: клік — перейти; пауза/закрито окремо
function Stages({ s, v }: { s: Startup; v: View }) {
  const idx = FLOW.indexOf(s.stage);
  const Btn = ({ k, label, cls }: { k: string; label: string; cls: string }) => (
    <form action={saveStartupAction}>
      <input type="hidden" name="id" value={s.id} /><input type="hidden" name="v" value={v} /><input type="hidden" name="stage" value={k} />
      <button className={`su-stage ${cls}`} title={STAGES.find((x) => x.k === k)?.hint}>{label}</button>
    </form>
  );
  return (
    <div className="su-stages">
      {FLOW.map((k, i) => <Btn key={k} k={k} label={STAGES.find((x) => x.k === k)!.label} cls={i < idx ? "done" : i === idx ? "on" : ""} />)}
      <span className="su-stages-gap" />
      <Btn k="paused" label="Пауза" cls={s.stage === "paused" ? "on muted" : "muted"} />
      <Btn k="closed" label="Закрито" cls={s.stage === "closed" ? "on muted" : "muted"} />
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="lab-muted" style={{ margin: 0 }}>{children}</p>;

// ---------- Огляд: пульт проєкту
function Overview({ s, items }: { s: Startup; items: StartupItem[] }) {
  const ms = items.filter((i) => i.kind === "milestone");
  const current = ms.find((m) => m.status === "now") ?? ms.find((m) => m.status !== "done");
  const curTasks = current ? startupTasks(s.id, current.id) : [];
  const open = startupTasks(s.id).filter((t) => t.status !== "done");
  const questions = items.filter((i) => i.kind === "question" && i.status !== "closed");
  const decisions = items.filter((i) => i.kind === "decision").slice(0, 3);
  const exps = items.filter((i) => i.kind === "experiment");
  const running = exps.filter((e) => e.status === "running" || e.status === "planned");
  const fin = hasFinance(s.finance) ? calcFinance(effectiveFinance(s.finance, finLinks(s.mkt, items))) : null;
  const doneT = curTasks.filter((t) => t.status === "done").length;

  return (
    <div className="su-ov">
      <div className="su-ov-main">
        <form action={saveStartupAction} className="card su-next">
          <input type="hidden" name="id" value={s.id} />
          <span className="lab-kicker">Наступний крок</span>
          <div className="su-next-row">
            <input name="next_step" defaultValue={s.next_step} placeholder="Що робимо далі — одна конкретна дія" />
            <SubmitButton className="ghost small">Ок</SubmitButton>
          </div>
        </form>

        <div className="card stack">
          <div className="mx-main-head"><b>{current ? `Етап зараз: ${current.title}` : "Етап зараз"}</b><Link href={`/startups/${s.id}?v=plan`}>увесь план →</Link></div>
          {current ? (
            <>
              {curTasks.length > 0 && <div className="tm-progress"><i style={{ width: `${(doneT / curTasks.length) * 100}%` }} /></div>}
              {current.body && <p className="su-muted-p">{current.body}</p>}
              <div className="list flat">{curTasks.filter((t) => t.status !== "done").slice(0, 6).map((t) => <TaskItem key={t.id} t={t} showClient={false} />)}</div>
              {!curTasks.length && <Empty>Задач на етапі ще нема — додай у «Плані» або попроси Джері.</Empty>}
            </>
          ) : <Empty>Плану ще нема. Попроси Джері: «склади план етапами».</Empty>}
          {!current && open.length > 0 && <div className="list flat">{open.slice(0, 6).map((t) => <TaskItem key={t.id} t={t} showClient={false} />)}</div>}
        </div>

        <div className="card stack">
          <div className="mx-main-head"><b>Відкриті питання</b><span>{questions.length}</span></div>
          {questions.length ? (
            <ul className="su-q">
              {questions.map((q) => (
                <li key={q.id}>
                  <form action={updateItemAction}>
                    <input type="hidden" name="item_id" value={q.id} /><input type="hidden" name="status" value="closed" />
                    <button className="tm-box-check" title="Закрито — відповідь знайшли" aria-label="Закрити питання">✓</button>
                  </form>
                  <span>{q.title}{q.body && <small>{q.body}</small>}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>Нема — або ще не записали.</Empty>}
          <form action={addItemAction} className="inline">
            <input type="hidden" name="id" value={s.id} /><input type="hidden" name="kind" value="question" /><input type="hidden" name="status" value="open" />
            <input name="title" placeholder="+ Питання або ризик, на який треба відповісти" />
            <button className="ghost small">Додати</button>
          </form>
        </div>
      </div>

      <div className="su-ov-side">
        <div className="su-pillars">
          {PILLARS.map((p, i) => {
            const st = stepsOf(s, items, p.k);
            const filled = st.filter((x) => x.done).length, total = st.length;
            const next = st.find((x) => !x.done);
            const extra = p.k === "idea" && s.idea.formula.who ? null : p.k === "finance" && fin ? `окупність: ${fin.payback == null ? "> 3 р." : fin.payback === 0 ? "без вкладень" : `${fin.payback}-й міс`}` : null;
            return (
              <Link key={p.k} href={`/startups/${s.id}?v=${p.k}`} className="card su-ring-card">
                <div className="su-ring" style={{ "--p": Math.round((filled / total) * 100) } as React.CSSProperties}><b>{filled}/{total}</b></div>
                <div>
                  <b>{i + 1} · {p.label}</b>
                  <span>{next ? `Далі: ${next.label.toLowerCase()}` : "Усе готово"}</span>
                  {extra && <span className="su-ok">{extra}</span>}
                </div>
              </Link>
            );
          })}
        </div>
        {fin && (
          <Link href={`/startups/${s.id}?v=finance`} className="card su-fin-mini">
            <span>Прибуток за 1-й рік</span><b className={fin.year.profit >= 0 ? "pos" : "neg"}>{money(Math.round(fin.year.profit))}</b>
            {fin.breakEven != null && <span>у нуль: {Math.ceil(fin.breakEven)} {s.finance.model === "sub" ? "клієнтів" : "продажів/міс"}</span>}
          </Link>
        )}

        <div className="card stack">
          <div className="mx-main-head"><b>Гіпотези</b><Link href={`/startups/${s.id}?v=tests`}>усі →</Link></div>
          <div className="su-exp-mini">
            {EXP.map((e) => <span key={e.k} className={`s-${e.k}`}><b>{exps.filter((x) => x.status === e.k).length}</b>{e.label.toLowerCase()}</span>)}
          </div>
          {running.slice(0, 3).map((e) => <div key={e.id} className="su-mini-row">{e.title}</div>)}
        </div>

        <div className="card stack">
          <div className="mx-main-head"><b>Останні рішення</b><Link href={`/startups/${s.id}?v=decisions`}>журнал →</Link></div>
          {decisions.length ? decisions.map((d) => <div key={d.id} className="su-mini-row"><span>{fmtDate(d.created_at)}</span>{d.title}</div>) : <Empty>Ще нема.</Empty>}
        </div>

        <div className="card stack">
          <b>Джері</b>
          <div className="inline" style={{ flexWrap: "wrap", gap: "0.375rem" }}>
            <AskAssistant text="Подивись на цей стартап цілком: що зараз найважливіше зробити і чому? Онови «наступний крок».">Що далі?</AskAssistant>
            <AskAssistant text="Чого не вистачає цьому стартапу, щоб перейти на наступну стадію? Чесно, з ризиками.">Чого бракує?</AskAssistant>
            <AskAssistant text="Склади або онови план етапами з задачами для цього стартапу.">Склади план</AskAssistant>
            <AskAssistant text="Подивись на всі чотири опори цього стартапу (startup_get → steps): що з кожної ще не зроблено, що з цього ти можеш зробити зараз — зроби; що потребує мене (розмови з клієнтами, цифри, рішення) — запиши як питання і скажи коротко.">Добудуй опори</AskAssistant>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- План: етапи з задачами
function Plan({ s, milestones }: { s: Startup; milestones: StartupItem[] }) {
  const loose = startupTasks(s.id, null);
  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      {MS.map((g) => {
        const list = milestones.filter((m) => (m.status || "later") === g.k);
        if (!list.length) return null;
        return (
          <section key={g.k} className="stack" style={{ gap: "0.75rem" }}>
            <h2 className={`su-ms-group s-${g.k}`}>{g.label}</h2>
            {list.map((m) => {
              const tasks = startupTasks(s.id, m.id);
              const done = tasks.filter((t) => t.status === "done").length;
              return (
                <article key={m.id} id={`i-${m.id}`} className={`card su-ms s-${m.status}`}>
                  <div className="su-ms-head">
                    <div style={{ minWidth: 0 }}><b>{m.title}</b>{m.body && <p className="su-muted-p">{m.body}</p>}</div>
                    {tasks.length > 0 && <span className="su-ms-count">{done}/{tasks.length}</span>}
                  </div>
                  {tasks.length > 0 && <div className="tm-progress"><i style={{ width: `${(done / tasks.length) * 100}%` }} /></div>}
                  <div className="list flat">{tasks.map((t) => <TaskItem key={t.id} t={t} showClient={false} />)}</div>
                  <form action={addStartupTaskAction} className="inline">
                    <input type="hidden" name="id" value={s.id} /><input type="hidden" name="milestone_id" value={m.id} /><input type="hidden" name="v" value="plan" />
                    <input name="title" placeholder="+ Задача на цей етап" />
                    <button className="ghost small">Додати</button>
                  </form>
                  <details className="lab-edit">
                    <summary>Етап: змінити</summary>
                    <form action={updateItemAction} className="stack" style={{ marginTop: "0.625rem" }}>
                      <input type="hidden" name="item_id" value={m.id} /><input type="hidden" name="v" value="plan" />
                      <input name="title" defaultValue={m.title} />
                      <VoiceTextarea name="body" defaultValue={m.body} placeholder="Що має бути на виході етапу" />
                      <select name="status" defaultValue={m.status || "later"}>{MS.map((x) => <option key={x.k} value={x.k}>{x.label}</option>)}</select>
                      <div className="inline"><SubmitButton className="small" /><span className="grow" /><button formAction={deleteItemAction} className="ghost small danger-text">Прибрати етап</button></div>
                    </form>
                  </details>
                </article>
              );
            })}
          </section>
        );
      })}
      {!milestones.length && <div className="empty card">Плану ще нема. Додай перший етап нижче або попроси Джері: «склади план етапами».</div>}
      {loose.length > 0 && (
        <section className="card stack">
          <b>Задачі без етапу</b>
          <div className="list flat">{loose.map((t) => <TaskItem key={t.id} t={t} showClient={false} />)}</div>
        </section>
      )}
      <form action={addItemAction} className="card stack">
        <input type="hidden" name="id" value={s.id} /><input type="hidden" name="kind" value="milestone" /><input type="hidden" name="v" value="plan" />
        <b>Новий етап</b>
        <div className="inline" style={{ flexWrap: "wrap" }}>
          <input name="title" placeholder="Напр.: MVP — шахматка квартир і ліди з Facebook" required style={{ flex: "1 1 18rem" }} />
          <select name="status" defaultValue="next" style={{ maxWidth: "10rem" }}>{MS.map((x) => <option key={x.k} value={x.k}>{x.label}</option>)}</select>
          <button className="ghost">Додати</button>
        </div>
      </form>
    </div>
  );
}

// ---------- Тести: гіпотези і краш-тести дошкою
function Tests({ s, items }: { s: Startup; items: StartupItem[] }) {
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <p className="lab-muted" style={{ margin: 0 }}>Кожна гіпотеза: що думаємо → як перевіряємо → за якою цифрою вирішимо → що вийшло. Так видно, що вже доведено, а що — віра.</p>
      <div className="su-board">
        {EXP.map((g) => {
          const list = items.filter((e) => (e.status || "planned") === g.k);
          return (
            <section key={g.k} className={`su-col s-${g.k}`}>
              <div className="su-col-head"><b>{g.label}</b><span>{list.length}</span></div>
              {list.map((e) => (
                <article key={e.id} id={`i-${e.id}`} className="card su-exp">
                  <b>{e.title}</b>
                  {e.body && <p><span>Як:</span> {e.body}</p>}
                  {e.data.criterion && <p><span>Успіх, якщо:</span> {e.data.criterion}</p>}
                  {e.data.result && <p className="su-exp-res"><span>Вийшло:</span> {e.data.result}</p>}
                  <details className="lab-edit">
                    <summary>Змінити</summary>
                    <form action={updateItemAction} className="stack" style={{ marginTop: "0.625rem" }}>
                      <input type="hidden" name="item_id" value={e.id} /><input type="hidden" name="v" value="tests" />
                      <input name="title" defaultValue={e.title} />
                      <VoiceTextarea name="body" defaultValue={e.body} placeholder="Як перевіряємо" />
                      <input name="d_criterion" defaultValue={e.data.criterion ?? ""} placeholder="Успіх, якщо…" />
                      <VoiceTextarea name="d_result" defaultValue={e.data.result ?? ""} placeholder="Що вийшло, цифри, висновок" />
                      <select name="status" defaultValue={e.status || "planned"}>{EXP.map((x) => <option key={x.k} value={x.k}>{x.label}</option>)}</select>
                      <div className="inline"><SubmitButton className="small" /><span className="grow" /><button formAction={deleteItemAction} className="ghost small danger-text">Прибрати</button></div>
                    </form>
                  </details>
                </article>
              ))}
            </section>
          );
        })}
      </div>
      <form action={addItemAction} className="card stack">
        <input type="hidden" name="id" value={s.id} /><input type="hidden" name="kind" value="experiment" /><input type="hidden" name="status" value="planned" /><input type="hidden" name="v" value="tests" />
        <b>Нова гіпотеза</b>
        <input name="title" required placeholder="Що думаємо: «Забудовники заплатять $200/міс за шахматку з лідами»" />
        <div className="grid2" style={{ gap: "0.5rem" }}>
          <input name="body" placeholder="Як перевіряємо: напр. 10 дзвінків відділам продажу" />
          <input name="d_criterion" placeholder="Успіх, якщо: 3 з 10 хочуть демо" />
        </div>
        <div className="inline"><button className="ghost">Додати</button><span className="grow" /><AskAssistant text="Запропонуй 3 найважливіші гіпотези для перевірки цього стартапу (що, як перевірити дешево, критерій успіху) і запиши їх.">Джері, запропонуй</AskAssistant></div>
      </form>
    </div>
  );
}

// ---------- Рішення: журнал з причинами
function Decisions({ s, items }: { s: Startup; items: StartupItem[] }) {
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <p className="lab-muted" style={{ margin: 0 }}>Чому зроблено саме так. Через пів року, коли захочеш розширитись чи переробити — тут уся логіка.</p>
      <form action={addItemAction} className="card stack">
        <input type="hidden" name="id" value={s.id} /><input type="hidden" name="kind" value="decision" /><input type="hidden" name="v" value="decisions" />
        <input name="title" required placeholder="Що вирішили: напр. «База — PostgreSQL, не SQLite»" />
        <VoiceTextarea name="body" placeholder="Чому так" />
        <input name="d_alternatives" placeholder="Які були альтернативи" />
        <div><button className="ghost">Записати рішення</button></div>
      </form>
      {items.length ? (
        <div className="su-timeline">
          {items.map((d) => (
            <article key={d.id} id={`i-${d.id}`} className="su-dec">
              <span className="su-dec-date">{fmtDate(d.created_at)}</span>
              <div className="card stack">
                <b>{d.title}</b>
                {d.body && <div className="su-muted-p"><Markdown md={d.body} /></div>}
                {d.data.alternatives && <p className="su-muted-p"><span className="lab-kicker">Альтернативи:</span> {d.data.alternatives}</p>}
                {d.data.lab_id && <Link href={`/lab/${d.data.lab_id}`} className="h-link">Сесія Лабораторії →</Link>}
                <form action={deleteItemAction}><input type="hidden" name="item_id" value={d.id} /><input type="hidden" name="v" value="decisions" /><button className="ghost small">Прибрати</button></form>
              </div>
            </article>
          ))}
        </div>
      ) : <div className="empty card">Рішень ще нема.</div>}
    </div>
  );
}

// ---------- Нотатки: стрічка думок і посилань
function Notes({ s, items }: { s: Startup; items: StartupItem[] }) {
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <form action={addItemAction} className="card stack" data-nodraft>
        <input type="hidden" name="id" value={s.id} /><input type="hidden" name="kind" value="note" /><input type="hidden" name="v" value="notes" />
        <VoiceTextarea name="body" required placeholder="Думка, спостереження, що сказав клієнт, ідея фічі — надиктуй" style={{ minHeight: "5rem" }} />
        <div><SubmitButton className="small">Записати</SubmitButton></div>
      </form>
      <form action={addItemAction} className="inline">
        <input type="hidden" name="id" value={s.id} /><input type="hidden" name="kind" value="link" /><input type="hidden" name="v" value="notes" />
        <input name="d_url" type="url" placeholder="Посилання: конкурент, стаття, Figma, документ" required style={{ flex: "2 1 16rem" }} />
        <input name="title" placeholder="Що це" style={{ flex: "1 1 10rem" }} />
        <button className="ghost small">Додати</button>
      </form>
      {s.raw_text && <div className="card su-raw-orig"><span className="lab-kicker">Як ідея прийшла вперше</span><p>{s.raw_text}</p></div>}
      <div className="su-notes">
        {items.map((n) => (
          <article key={n.id} className="su-note">
            <span className="su-dec-date">{fmtDate(n.created_at)}</span>
            <div className="card">
              {n.kind === "link"
                ? <a href={n.data.url} target="_blank" rel="noreferrer" className="h-link">🔗 {n.title || n.data.url}</a>
                : <>{n.title && <b>{n.title}</b>}<div className="su-muted-p"><Markdown md={n.body} /></div></>}
              <form action={deleteItemAction} className="su-note-del"><input type="hidden" name="item_id" value={n.id} /><input type="hidden" name="v" value="notes" /><button className="ghost small" aria-label="Прибрати">✕</button></form>
            </div>
          </article>
        ))}
        {!items.length && <div className="empty card">Поки порожньо.</div>}
      </div>
    </div>
  );
}
