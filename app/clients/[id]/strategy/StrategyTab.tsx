// Стратегія клієнта: вкладка в картці. Підрозділи (?sv=): Огляд · Екосистема · План · Хроніка · Знання · Висновки; частина — ?sv=part&p=ID.
// Каркас на місяці роботи: конспект зверху, екосистема з частинами (будуємо / надаємо / сервіси), план по горизонтах, памʼять.
import Link from "next/link";
import Markdown from "@/components/Markdown";
import Pop from "@/components/Pop";
import ListPop from "@/components/ListPop";
import Icon from "@/components/Icon";
import { BrandDot, brandOf } from "@/components/Brand";
import Timeline from "@/components/Timeline";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { fmtDate } from "@/lib/dates";
import { listLabForClient } from "@/lib/repo/lab";
import { getStrategy, HORIZONS, planConflict, KNOW_CATS, lines, listItems, listParts, PART_KINDS, PART_STATUS, type Part, type SItem } from "@/lib/repo/strategy";
import Hypotheses from "./Hypotheses";
import Path from "./Path";
import Board from "./Board";
import { boardCount, getBoard } from "@/lib/repo/strategyPath";
import { getClient } from "@/lib/repo/clients";
import { crmAlerts } from "@/lib/repo/crmAlerts";
import { getClientMemory } from "@/lib/repo/clientMemory";
import { addItemAction, itemAction, savePartAction, saveSummaryAction } from "./actions";
import { ImportBox, PromptCopy } from "./StrategyClient";

const VIEWS = [
  { k: "overview", label: "Огляд" },
  { k: "systems", label: "Екосистема" },
  { k: "plan", label: "План" },
  { k: "hypotheses", label: "Гіпотези" },
  { k: "log", label: "Хроніка" },
  { k: "knowledge", label: "Знання і рішення" },
  { k: "insights", label: "Висновки" },
] as const;

export default function StrategyTab({ clientId, sv, p }: { clientId: number; sv?: string; p?: string }) {
  const base = `/clients/${clientId}?tab=strategy`;
  const parts = listParts(clientId);
  const part = sv === "part" ? parts.find((x) => x.id === Number(p)) : undefined;
  const v = part ? "systems" : VIEWS.find((x) => x.k === sv)?.k ?? "overview";
  const hid = <input type="hidden" name="client_id" value={clientId} />;
  if (sv === "board") return <Board clientId={clientId} name={getClient(clientId)?.name ?? ""} initial={getBoard(clientId)} back={base} />;
  return (
    <section className="st stack">
      <div className="st-head">
        <div className="mono" style={{ alignSelf: "center" }}>Де ми, куди йдемо, з чого складається система клієнта і що далі</div>
        <div className="inline" style={{ flexWrap: "wrap" }}>
          <PromptCopy clientId={clientId} partId={part?.id ?? null} label={part ? `Промпт: ${part.title}` : undefined} />
          <ImportBox clientId={clientId} compact />
        </div>
      </div>
      <nav className="mx-tabs st-tabs">
        {VIEWS.map((x) => <Link key={x.k} href={x.k === "overview" ? base : `${base}&sv=${x.k}`} scroll={false} className={x.k === v ? "on" : ""}>{x.label}</Link>)}
      </nav>
      {part ? <PartView part={part} base={base} hid={hid} />
        : v === "overview" ? <Overview clientId={clientId} parts={parts} base={base} hid={hid} />
        : v === "systems" ? <Systems clientId={clientId} parts={parts} base={base} hid={hid} />
        : v === "plan" ? <><Conflict clientId={clientId} /><Plan clientId={clientId} parts={parts} hid={hid} /></>
        : v === "hypotheses" ? <Hypotheses clientId={clientId} />
        : v === "log" ? <Log clientId={clientId} parts={parts} />
        : v === "knowledge" ? <Knowledge clientId={clientId} parts={parts} hid={hid} />
        : <Insights clientId={clientId} hid={hid} />}
    </section>
  );
}

const statusTag = (s: Part["status"]) => <span className={`tag st-s-${s}`}>{PART_STATUS[s]}</span>;
// B22: назву частини показуємо, тільки коли частин більше однієї
const partName = (parts: Part[], id: number | null) => (id && parts.length > 1 ? parts.find((p) => p.id === id)?.title : undefined);

// Перевірка пріоритетів: висновок / тривога «обробка заявок» проти плану «більше лідів»
function Conflict({ clientId }: { clientId: number }) {
  const msg = planConflict(clientId, crmAlerts(clientId).some((a) => a.text.startsWith("без контакту")));
  return msg ? <div className="mx-warn"><Icon name="alert" size={15} /><span>{msg}</span></div> : null;
}

// Огляд Стратегії — тільки головне: куди йдемо (Я), шлях до цього (дірки → червоні → жовті → зелені) і дошка.
// Решта (екосистема, план, хроніка, знання, висновки) — у підвкладках зверху.
function Overview({ clientId, base, hid }: { clientId: number; parts: Part[]; base: string; hid: React.ReactNode }) {
  const s = getStrategy(clientId);
  const n = boardCount(clientId);
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <Conflict clientId={clientId} />
      <Pop className="pop-card gl-card" title="Куди йдемо" wide closeOnSubmit trigger={
        <>
          <span className="gl-ico"><Icon name="flag" size={18} /></span>
          <span className="gl-body">
            <span className="gl-k">Куди йдемо</span>
            {s.goal ? <span className="gl-t">{s.goal}</span> : <span className="gl-t gl-empty">Ціль на 3–6 місяців у цифрах — натисни, щоб записати</span>}
          </span>
          <span className="gl-edit">Змінити</span>
        </>
      }>
        <form action={saveSummaryAction} className="gl-form">
          {hid}
          <label className="mono" htmlFor="gl-goal">Куди йдемо і як зрозуміємо, що дійшли: цифри, строк, що має з'явитись</label>
          <VoiceTextarea id="gl-goal" name="goal" defaultValue={s.goal} placeholder={"напр.:\n• 14–20 заявок на день по 3 $\n• 8 продажів на місяць до березня\n• своя CRM замість сторонньої"} />
          <div className="inline"><SubmitButton>Зберегти</SubmitButton><span className="mono">кожна думка з нового рядка — так легше читати</span></div>
        </form>
      </Pop>
      <Path clientId={clientId} />
      <Link href={`${base}&sv=board`} className="dk-open">
        <span className="dk-open-ico"><Icon name="layers" size={22} /></span>
        <span><b>Дошка</b><span className="mono">{n ? `${n} стікерів — відкрити` : "як Miro / детектив: стікери, нитки між ними, вільна карта думок"}</span></span>
        <span className="dk-open-go">Відкрити →</span>
      </Link>
    </div>
  );
}

function PartCard({ p, base }: { p: Part; base: string }) {
  const ms = [...new Set(lines(p.stack).map((x) => brandOf(x)?.name).filter(Boolean))] as string[];
  return (
    <Link href={`${base}&sv=part&p=${p.id}`} className={`card st-part s-${p.status}`}>
      <div className="sp-top">
        <b className="sp-title">{p.title}</b>
        {statusTag(p.status)}
      </div>
      <p className="sp-sum">{p.summary || "опис ще не додано"}</p>
      <div className="sp-bottom">
        {ms.length > 0 && <span className="qt-marks">{ms.slice(0, 6).map((m) => <BrandDot key={m} text={m} size={15} />)}</span>}
        {p.next_step && <span className="sp-next" title={p.next_step}><span>далі</span>{p.next_step}</span>}
      </div>
    </Link>
  );
}

function Systems({ clientId, parts, base, hid }: { clientId: number; parts: Part[]; base: string; hid: React.ReactNode }) {
  const labs = listLabForClient(clientId);
  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      {(Object.keys(PART_KINDS) as (keyof typeof PART_KINDS)[]).map((k) => {
        const xs = parts.filter((p) => p.kind === k);
        return (
          <div key={k} className="stack" style={{ gap: "0.5rem" }}>
            <h3 className="st-h3">{PART_KINDS[k]} <span className="mono">{xs.length}</span></h3>
            {xs.length ? <div className="st-parts">{xs.map((p) => <PartCard key={p.id} p={p} base={base} />)}</div> : <p className="mono">{k === "build" ? "Що будуємо для клієнта: CRM, бот, сайт, дашборд…" : k === "service" ? "Що надаємо постійно: ведення реклами, підтримка, аналітика…" : "Підключені сервіси: Binotel, Meta, Google, хостинг…"}</p>}
          </div>
        );
      })}
      <details className="card">
        <summary><b>+ Частина екосистеми</b></summary>
        <form action={savePartAction} className="mk-form" style={{ marginTop: "0.75rem" }}>
          {hid}
          <input name="title" required placeholder="Назва: CRM, Бот заявок, Реклама Meta…" />
          <select name="kind" defaultValue="build">{Object.entries(PART_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select name="status" defaultValue="plan">{Object.entries(PART_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input name="summary" placeholder="Що це і що дає клієнту" className="wide" />
          <div className="wide"><SubmitButton className="small">Додати</SubmitButton></div>
        </form>
      </details>
      {labs.length > 0 && <details><summary className="h-link">Архів старої Лабораторії ({labs.length})</summary><ul className="st-list">{labs.map((l) => <li key={l.id}><Link href={`/lab/${l.id}`} className="h-link">{l.title}</Link></li>)}</ul></details>}
    </div>
  );
}

function PartView({ part: p, base, hid }: { part: Part; base: string; hid: React.ReactNode }) {
  const it = (kind: SItem["kind"]) => listItems(p.client_id, { kind, part: p.id, limit: 100 });
  const kn = it("knowledge"), dec = it("decision"), log = it("log"), ideas = it("idea");
  const plan = it("plan").filter((i) => i.horizon !== "done");
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <Link href={`${base}&sv=systems`} className="h-link">← Екосистема</Link>
      <div className="card st-part-head">
        <div className="st-part-h"><h3 style={{ margin: 0 }}>{p.title}</h3>{statusTag(p.status)}<span className="mono">{PART_KINDS[p.kind]} · оновлено {fmtDate(p.updated_at)}</span></div>
        {p.summary && <p>{p.summary}</p>}
        {p.next_step && <p className="st-next">Наступний крок: {p.next_step}</p>}
      </div>
      <div className="qt-grid">
        <ListPop title="З чого складається" ico="layers" brands items={lines(p.stack)} />
        <ListPop title="Плюси" ico="check" tone="good" items={lines(p.pros)} />
        <ListPop title="Мінуси / ризики" ico="alert" tone="bad" items={lines(p.cons)} />
        <ListPop title="Відкриті кроки" ico="flag" items={plan.map((i) => `${i.title} · ${HORIZONS[i.horizon as keyof typeof HORIZONS]}`)} />
        <ListPop title="Рішення" ico="book" items={dec.map((d) => d.body ? `${d.title} — ${d.body}` : d.title)} />
      </div>
      {kn.length > 0 && <div className="card stack st-box"><b>Що знаємо · {kn.length}</b><div className="st-grid">{kn.map((k) => tile(k, KNOW_CATS[k.cat as keyof typeof KNOW_CATS]))}</div></div>}
      {ideas.length > 0 && <div className="qt-grid"><ListPop title="Ідеї / масштабування" ico="sparkles" tone="accent" items={ideas.map((i) => i.title)} /></div>}
      {log.length > 0 && <div className="card stack st-box"><b>Хроніка частини</b><Timeline items={[...log].reverse().map((l) => ({ id: l.id, at: l.created_at, title: l.title, body: l.body, tag: l.source === "extract" ? "з витяжки" : undefined, actions: delForm(l.id) }))} /></div>}
      <details className="card">
        <summary><b>✎ Змінити частину</b></summary>
        <form action={savePartAction} className="stack" style={{ gap: "0.5rem", marginTop: "0.75rem" }}>
          {hid}<input type="hidden" name="part_id" value={p.id} />
          <div className="mk-form">
            <input name="title" defaultValue={p.title} required />
            <select name="kind" defaultValue={p.kind}>{Object.entries(PART_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select name="status" defaultValue={p.status}>{Object.entries(PART_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </div>
          <label className="cm-field"><span>Що це і що дає клієнту</span><VoiceTextarea name="summary" defaultValue={p.summary} style={{ minHeight: "3rem" }} /></label>
          <label className="cm-field"><span>З чого складається (по рядку: модулі, інструменти, API)</span><VoiceTextarea name="stack" defaultValue={p.stack} style={{ minHeight: "6rem" }} /></label>
          <div className="st-two">
            <label className="cm-field"><span>Плюси (по рядку)</span><VoiceTextarea name="pros" defaultValue={p.pros} style={{ minHeight: "4rem" }} /></label>
            <label className="cm-field"><span>Мінуси / ризики (по рядку)</span><VoiceTextarea name="cons" defaultValue={p.cons} style={{ minHeight: "4rem" }} /></label>
          </div>
          <label className="cm-field"><span>Наступний крок</span><input name="next_step" defaultValue={p.next_step} /></label>
          <div className="inline"><SubmitButton className="small">Зберегти</SubmitButton><span className="grow" /><button name="delete" value="1" className="ghost small danger-text">Видалити частину</button></div>
        </form>
      </details>
    </div>
  );
}

function Plan({ clientId, parts, hid }: { clientId: number; parts: Part[]; hid: React.ReactNode }) {
  const all = listItems(clientId, { kind: "plan" });
  const col = (h: keyof typeof HORIZONS) => all.filter((i) => i.horizon === h);
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <form action={addItemAction} className="card mk-form">
        {hid}<input type="hidden" name="kind" value="plan" />
        <input name="title" required placeholder="Крок: напр. «Підключити Binotel до CRM»" className="wide" />
        <select name="horizon" defaultValue="week">{(["week", "month", "later"] as const).map((h) => <option key={h} value={h}>{HORIZONS[h]}</option>)}</select>
        <select name="part_id" defaultValue=""><option value="">— частина —</option>{parts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        <div><SubmitButton className="small">Додати</SubmitButton></div>
      </form>
      <div className="st-cols">
        {(["week", "month", "later"] as const).map((h) => (
          <div key={h} className="card stack st-col">
            <b>{HORIZONS[h]} <span className="mono">{col(h).length}</span></b>
            {col(h).map((i) => <PlanItem key={i.id} i={i} parts={parts} />)}
            {!col(h).length && <p className="mono">—</p>}
          </div>
        ))}
      </div>
      {col("done").length > 0 && <details className="card"><summary><b>Зроблено · {col("done").length}</b></summary><ul className="st-list">{col("done").map((i) => <li key={i.id}>{i.title} <small>{i.done_at ? fmtDate(i.done_at) : ""}</small></li>)}</ul></details>}
    </div>
  );
}

function PlanItem({ i, parts }: { i: SItem; parts: Part[] }) {
  const f = (op: string, extra?: React.ReactNode, label?: string, cls = "ghost small") => (
    <form action={itemAction}><input type="hidden" name="item_id" value={i.id} /><input type="hidden" name="op" value={op} />{extra}<button className={cls}>{label}</button></form>
  );
  return (
    <div className="st-pi">
      <div>{i.title}{partName(parts, i.part_id) && <small> · {partName(parts, i.part_id)}</small>}</div>
      <div className="st-pi-act">
        {f("move", <input type="hidden" name="horizon" value="done" />, "✓")}
        {i.horizon !== "week" && f("move", <input type="hidden" name="horizon" value="week" />, "↑ тиждень")}
        {i.horizon === "week" && f("move", <input type="hidden" name="horizon" value="month" />, "↓ місяць")}
        {i.task_id ? <span className="mono">задача #{i.task_id}</span> : f("task", null, "→ задача")}
        {f("delete", null, "×")}
      </div>
    </div>
  );
}

function Log({ clientId, parts }: { clientId: number; parts: Part[] }) {
  const log = listItems(clientId, { kind: "log", limit: 200 }).reverse();
  const mem = getClientMemory(clientId);
  return <>
    <details className="card"><summary><b>Памʼять Джері по клієнту</b> <span className="mono">{mem ? `оновлено ${fmtDate(mem.updated_at)} · сам після розмов` : "ще порожньо"}</span></summary>
      {mem?.text ? <div className="tm-details" style={{ marginTop: "0.5rem" }}><Markdown md={mem.text} /></div> : <p className="mono">Розкажи Джері про клієнта — він запише сам.</p>}
    </details>
    <Timeline items={log.map((l) => ({ id: l.id, at: l.created_at, title: l.title, body: l.body, tag: [partName(parts, l.part_id), l.source === "extract" ? "з витяжки" : ""].filter(Boolean).join(" · ") || undefined, actions: delForm(l.id) }))} empty="Хроніка порожня. Кожна вставлена витяжка лягає сюди." />
  </>;
}

const delForm = (id: number) => <form action={itemAction}><input type="hidden" name="item_id" value={id} /><input type="hidden" name="op" value="delete" /><button className="ghost small">Прибрати</button></form>;

// Плитка: коротко на екрані, повністю — у попапі (з кнопкою «Прибрати»)
function tile(i: SItem, tag?: string, parts?: Part[]) {
  const sub = [tag, parts && partName(parts, i.part_id), fmtDate(i.created_at), i.owner && `відповідає ${i.owner}`, i.review_date && `переглянути до ${fmtDate(i.review_date)}`].filter(Boolean).join(" · ");
  return (
    <Pop key={i.id} title={i.title} sub={sub} trigger={<div className="pv"><div className="pv-t">{i.title}</div>{i.body && <div className="pv-s">{i.body}</div>}<div className="pv-m">{sub}</div></div>}>
      {i.body ? <div className="tm-details"><Markdown md={i.body} /></div> : <p className="mono">Деталей нема.</p>}
      <form action={itemAction} style={{ marginTop: "0.75rem" }}><input type="hidden" name="item_id" value={i.id} /><input type="hidden" name="op" value="delete" /><button className="ghost small">Прибрати</button></form>
    </Pop>
  );
}

function Knowledge({ clientId, parts, hid }: { clientId: number; parts: Part[]; hid: React.ReactNode }) {
  const kn = listItems(clientId, { kind: "knowledge" }), dec = listItems(clientId, { kind: "decision" }), ideas = listItems(clientId, { kind: "idea" });
  const row = (i: SItem) => tile(i, undefined, parts);
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <form action={addItemAction} className="card mk-form">
        {hid}
        <select name="kind" defaultValue="knowledge"><option value="knowledge">Знання</option><option value="decision">Рішення</option><option value="idea">Ідея</option></select>
        <select name="cat" defaultValue="fix">{Object.entries(KNOW_CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input name="title" required placeholder="Коротко" className="wide" />
        <input name="body" placeholder="Деталі: причина → рішення / чому" className="wide" />
        <input name="owner" placeholder="Хто відповідає (для рішення)" />
        <input name="review_date" type="date" aria-label="Переглянути до (для рішення)" title="Переглянути рішення до" />
        <select name="part_id" defaultValue=""><option value="">— частина —</option>{parts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        <div><SubmitButton className="small">Записати</SubmitButton></div>
      </form>
      {Object.entries(KNOW_CATS).map(([k, v]) => { const xs = kn.filter((i) => (i.cat || "lesson") === k); return xs.length ? <div key={k} className="card stack st-box"><b>{v} · {xs.length}</b><div className="st-grid">{xs.map(row)}</div></div> : null; })}
      {dec.length > 0 && <div className="card stack st-box"><b>Рішення · {dec.length}</b><div className="st-grid">{dec.map(row)}</div></div>}
      {ideas.length > 0 && <div className="card stack st-box"><b>Ідеї / масштабування · {ideas.length}</b><div className="st-grid">{ideas.map(row)}</div></div>}
      {!kn.length && !dec.length && !ideas.length && <p className="mono">Поки порожньо — з витяжок сюди лягає, що ламалось і як виправили, інтеграції, рішення.</p>}
    </div>
  );
}

function Insights({ clientId, hid }: { clientId: number; hid: React.ReactNode }) {
  const s = getStrategy(clientId);
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <p className="mono" style={{ margin: 0 }}>Що працює саме в цього клієнта: що повторювати, чого уникати. Джері переписує після кожної витяжки — і спирається на це в наступних кроках.</p>
      {s.insights ? <div className="card tm-details"><Markdown md={s.insights} /></div> : <p className="mono">Ще порожньо.</p>}
      <details className="card"><summary><b>✎ Правити</b></summary>
        <form action={saveSummaryAction} className="stack" style={{ gap: "0.5rem", marginTop: "0.75rem" }}>{hid}<VoiceTextarea name="insights" defaultValue={s.insights} style={{ minHeight: "10rem" }} /><div><SubmitButton className="small">Зберегти</SubmitButton></div></form>
      </details>
    </div>
  );
}
