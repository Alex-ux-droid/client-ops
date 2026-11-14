import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Markdown from "@/components/Markdown";
import Pop from "@/components/Pop";
import Timeline from "@/components/Timeline";
import EditBlock from "@/components/EditBlock";
import LogoMark from "@/components/LogoMark";
import { logoSrc } from "@/lib/repo/logos";
import ListPop from "@/components/ListPop";
import Icon from "@/components/Icon";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { CopyText } from "@/app/startups/[id]/CopyText";
import { fmtDate } from "@/lib/dates";
import { appSecret, kitText, productIssues } from "@/lib/products";
import { listClients } from "@/lib/repo/clients";
import { getProduct, listRequests, productCode, chatTitle, reqCode, REQ_STATUS, REQ_SOURCE, type PRequest, listPItems, P_KNOW, PRODUCT_KINDS, PRODUCT_STATUS, productClients, productEventCounts, productEvents, productTimeline, productUpdates, nextUpdateVer, hasPassport, type PItem } from "@/lib/repo/products";
import { getSetting } from "@/lib/repo/settings";
import { lines } from "@/lib/repo/strategy";
import { requestAction, productOwnerAction, issuesDoneAction, productClientAction, productItemAction, productSecretAction, saveProductAction } from "../actions";
import { CopyBig, ProductImport, ProductPrompt } from "../ProductClient";
import SitePulseCard from "@/components/SitePulseCard";
import { sitePulse } from "@/lib/sitePulse";

export const dynamic = "force-dynamic";

const VIEWS = [{ k: "overview", label: "Паспорт" }, { k: "requests", label: "Правки" }, { k: "log", label: "Хронологія і план" }, { k: "knowledge", label: "Знання" }, { k: "kit", label: "Набір" }, { k: "connect", label: "Звʼязок" }, { k: "edit", label: "Змінити" }] as const;

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; saved?: string }> }) {
  const id = Number((await params).id);
  const p = getProduct(id);
  if (!p) notFound();
  const sp = await searchParams;
  const views = VIEWS.filter((x) => x.k !== "kit" || p.kit_md);
  const v = views.find((x) => x.k === sp.v)?.k ?? "overview";
  const base = `/products/${id}`;
  const h = await headers();
  const host = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? ""}`;
  const hid = <input type="hidden" name="product_id" value={id} />;
  const openReq = listRequests(id, true);
  const clientsAll = listClients().filter((c) => c.status !== "archived");
  const owner = p.client_id ? clientsAll.find((c) => c.id === p.client_id) ?? null : null;
  const src = (i: PItem) => `${fmtDate(i.created_at)}${i.ver ? ` · Оновлення ${i.ver}` : i.source === "extract" ? " · старт" : i.source === "jerry" ? " · Джері" : ""}`;
  const acts = (i: PItem) => (
    <>
      {i.kind === "plan" && <form action={productItemAction}>{hid}<input type="hidden" name="item_id" value={i.id} /><input type="hidden" name="op" value="toggle" /><button className="ghost small">{i.done ? "↺ повернути" : "✓ зроблено"}</button></form>}
      <form action={productItemAction}>{hid}<input type="hidden" name="item_id" value={i.id} /><input type="hidden" name="op" value="delete" /><button className="ghost small">Прибрати</button></form>
    </>
  );
  // Плитка: коротко на екрані, повністю — у попапі
  const item = (i: PItem) => (
    <Pop key={i.id} title={i.title} sub={src(i)} trigger={<div className="pv"><div className="pv-t">{i.done ? <s>{i.title}</s> : i.title}</div>{i.body && <div className="pv-s">{i.body.replace(/\*\*/g, "")}</div>}<div className="pv-m">{src(i)}</div></div>}>
      {i.body ? <div className="tm-details"><Markdown md={i.body} /></div> : <p className="mono">Деталей нема.</p>}
      <div className="inline" style={{ marginTop: "0.75rem" }}>{acts(i)}</div>
    </Pop>
  );
  const verTag = (i: PItem) => (i.ver ? `Оновлення ${i.ver}` : i.ver === 0 ? "старт" : i.source === "jerry" ? "Джері" : undefined);
  const tl = () => productTimeline(id).map((l) => ({ id: l.id, at: l.created_at, title: l.title, body: l.body, tag: verTag(l), actions: acts(l) }));

  return (
    <section className="st stack">
      <Link href="/products" className="h-link">← Проєкти</Link>
      <div className="st-head">
        <div className="ent-head">
          <LogoMark kind="product" id={id} name={p.name} src={logoSrc("product", id)} size={52} editable />
          <div style={{ minWidth: 0 }}>
          <div className="st-part-h"><h1 style={{ margin: 0 }}>{p.name}</h1><span className={`tag st-s-${p.status}`}>{PRODUCT_STATUS[p.status] ?? p.status}</span><span className="mono">{PRODUCT_KINDS[p.kind] ?? p.kind} · оновлено {fmtDate(p.updated_at)}</span></div>
          {p.summary && <p style={{ margin: "0.375rem 0 0", color: "var(--muted)" }}>{p.summary}</p>}
          </div>
        </div>
        <div className="inline" style={{ flexWrap: "wrap" }}>
          {hasPassport(id) ? <>
            <ProductPrompt productId={id} mode="update" primary label={`Промпт: оновлення ${nextUpdateVer(id)}`} />
            <ProductPrompt productId={id} label="Повний промпт" />
          </> : <ProductPrompt productId={id} label="Промпт для Claude Code" />}
          <ProductImport productId={id} compact />
        </div>
      </div>
      <div className="pj-work">
        <span className="pj-code" title="Код проєкту — так само назви чат у Claude Code">{productCode(id)}</span>
        <CopyText text={chatTitle(p)} label="Скопіювати назву чату" />
        {p.chat_url ? <a href={p.chat_url} target="_blank" rel="noreferrer" className="btn small">Чат Claude Code ↗</a> : <Link href={`${base}?v=edit`} className="btn ghost small">+ чат Claude Code</Link>}
        {p.repo_url && <a href={p.repo_url} target="_blank" rel="noreferrer" className="btn ghost small">GitHub ↗</a>}
        {p.prod_url && <a href={p.prod_url} target="_blank" rel="noreferrer" className="btn ghost small">{p.kind === "app" ? "Відкрити" : "Сайт"} ↗</a>}
        {owner && <Link href={`/clients/${owner.id}`} className="btn ghost small">Клієнт: {owner.name}</Link>}
      </div>
      <nav className="mx-tabs st-tabs">{views.map((x) => <Link key={x.k} href={x.k === "overview" ? base : `${base}?v=${x.k}`} scroll={false} className={x.k === v ? "on" : ""}>{x.label}{x.k === "requests" && openReq.length ? ` · ${openReq.length}` : ""}</Link>)}</nav>

      {v === "overview" && <Overview />}
      {v === "requests" && <Requests />}
      {v === "knowledge" && <Knowledge />}
      {v === "log" && <Log />}
      {v === "kit" && <Kit />}
      {v === "connect" && <Connect />}
      {v === "edit" && <Edit />}
    </section>
  );

  function Overview() {
    const cl = productClients(id);
    const all = listClients().filter((c) => c.status !== "archived" && !cl.some((x) => x.client_id === c.id));
    const kn = listPItems(id, "knowledge", 5);
    const plan = listPItems(id, "plan").filter((x) => !x.done);
    const ups = productUpdates(id).reverse();
    const stopped = ups[0]?.body.match(/\*\*Де зупинились:\*\*\s*([^\n]+)/)?.[1];
    const links = lines(p!.links);
    const tlAll = tl();
    return (
      <div className="stack" style={{ gap: "1rem" }}>
        <div className="pp-top">
          <div className="card dv-focus pp-now">
            <span className="mono">Де зупинились{ups[0] ? ` · ${ups[0].title.replace(/ — .*/, "")} · ${fmtDate(ups[0].created_at)}` : ""}</span>
            <b>{stopped ?? ups[0]?.title.replace(/^Оновлення \d+ — /, "") ?? (tlAll.at(-1)?.title || "—")}</b>
            {p!.next_step && <span className="pp-next">→ {p!.next_step}</span>}
          </div>
          {p!.how && (
            <Pop className="pop-card pp-how" title="Як працює" trigger={<><span className="mono">Як працює</span><span className="pv-s l4">{p!.how}</span></>}>
              <div style={{ whiteSpace: "pre-wrap" }}>{p!.how}</div>
            </Pop>
          )}
        </div>
        <div className="qt-grid">
          {openReq.length > 0 && <Link href={`${base}?v=requests`} className="card qt qt-link pj-req-tile"><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="alert" /></span><b>Правки</b></span><span className="qt-n">{openReq.length}</span></span>{openReq.slice(0, 2).map((r) => <span key={r.id} className="qt-l">{reqCode(r.id)} · {r.text}</span>)}<span className="qt-more">виправити →</span></Link>}
          <ListPop title="Головні фічі" ico="sparkles" items={lines(p!.features)} tone="accent" empty="ще не описано" />
          <ListPop title="З чого складається" ico="layers" brands items={lines(p!.stack)} empty="ще не описано" />
          <ListPop title="Плюси" ico="check" items={lines(p!.pros)} tone="good" />
          <ListPop title="Мінуси / ризики" ico="alert" items={lines(p!.cons)} tone="bad" />
          <ListPop title="Відкриті кроки" ico="flag" items={plan.map((x) => x.title)} />
          {links.length > 0 && (
            <Pop className="pop-card qt" title="Посилання" trigger={<><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="link" /></span><b>Посилання</b></span><span className="qt-n">{links.length}</span></span>{links.slice(0, 2).map((l, i) => <span key={i} className="qt-l">{l.replace(/https?:\/\/\S+/, "").replace(/[—-]\s*$/, "").trim() || l}</span>)}</>}>
              <ul className="st-list">{links.map((l, i) => { const u = l.match(/https?:\/\/\S+/)?.[0]; return <li key={i}>{u ? <a href={u} target="_blank" rel="noreferrer" className="h-link">{l.replace(u, "").replace(/[—-]\s*$/, "").trim() || u}</a> : l}</li>; })}</ul>
            </Pop>
          )}
          <Pop className="pop-card qt" title="Клієнти, які користуються" trigger={<><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="users" /></span><b>Клієнти</b></span><span className="qt-n">{cl.length}</span></span>{cl.length ? cl.slice(0, 2).map((c) => <span key={c.client_id} className="qt-l">{c.name}</span>) : <span className="qt-l mono">додати →</span>}</>}>
            <div className="stack" style={{ gap: "0.5rem" }}>
              {cl.length ? cl.map((c) => (
                <div key={c.client_id} className="inline" style={{ justifyContent: "space-between" }}>
                  <Link href={`/clients/${c.client_id}`} className="h-link">{c.name}{c.note ? ` · ${c.note}` : ""}</Link>
                  <form action={productClientAction}>{hid}<input type="hidden" name="client_id" value={c.client_id} /><input type="hidden" name="on" value="0" /><button className="ghost small">×</button></form>
                </div>
              )) : <p className="mono">Ще нікого.</p>}
              {all.length > 0 && <form action={productClientAction} className="inline" style={{ flexWrap: "wrap" }}>{hid}<select name="client_id" aria-label="Клієнт">{all.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input name="note" placeholder="примітка" /><button className="ghost small">Додати</button></form>}
            </div>
          </Pop>
          {ups.length > 0 && (
            <Pop className="pop-card qt" title={`Оновлення · ${ups.length}`} trigger={<><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="clock" /></span><b>Оновлення</b></span><span className="qt-n">{ups.length}</span></span>{ups.slice(0, 2).map((u) => <span key={u.id} className="qt-l">{u.title}</span>)}</>}>
              <div className="stack" style={{ gap: "0.75rem" }}>{ups.map((u) => <div key={u.id} className="card stack" style={{ gap: "0.25rem" }}><b>{u.title}</b><span className="mono">{fmtDate(u.created_at)}</span>{u.body && <div className="tm-details"><Markdown md={u.body} /></div>}</div>)}</div>
            </Pop>
          )}
          {kn.length > 0 && <Link href={`${base}?v=knowledge`} className="card qt qt-link"><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="book" /></span><b>Що знаємо</b></span><span className="qt-n">{listPItems(id, "knowledge").length}</span></span>{kn.slice(0, 2).map((k) => <span key={k.id} className="qt-l">{k.title}</span>)}<span className="qt-more">відкрити →</span></Link>}
        </div>
        {(p!.service_type === "website" || p!.clarity_id || sitePulse(id, 30).last) && <SitePulseCard productId={id} />}
        <div className="card stack" style={{ gap: "0.75rem" }}>
          <div className="mx-main-head"><b>Хронологія{tlAll.length > 6 ? ` · останні 6 з ${tlAll.length}` : ""}</b><Link href={`${base}?v=log`}>уся і план →</Link></div>
          <Timeline items={tlAll.slice(-6)} empty="Ще порожньо. Встав витяжку з Claude Code — етапи стануть блоками." />
        </div>
      </div>
    );
  }

  function Requests() {
    const all = listRequests(id);
    const open = all.filter((r) => r.status === "new" || r.status === "doing"), closed = all.filter((r) => !open.includes(r));
    const row = (r: PRequest) => (
      <div key={r.id} className={`card pj-req s-${r.status}`}>
        <div className="pj-req-h">
          <b className="pj-rc">{reqCode(r.id)}</b>
          <span className={`tag ${r.status === "done" ? "ok" : r.status === "doing" ? "warn" : r.status === "rejected" ? "" : "bad"}`}>{REQ_STATUS[r.status]}</span>
          <span className="mono">{fmtDate(r.created_at)} · {r.author || REQ_SOURCE[r.source] || "—"}</span>
          <span className="grow" />
          {(Object.keys(REQ_STATUS) as (keyof typeof REQ_STATUS)[]).filter((st) => st !== r.status).map((st) => (
            <form key={st} action={requestAction}>{hid}<input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="status" /><input type="hidden" name="status" value={st} /><button className="ghost small">{st === "done" ? "✓ виправлено" : st === "doing" ? "в роботу" : st === "new" ? "повернути" : "не робимо"}</button></form>
          ))}
          <form action={requestAction}>{hid}<input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="delete" /><button className="ghost small" aria-label="Видалити">×</button></form>
        </div>
        <p className="pj-req-t">{r.text}</p>
        {r.done_note && <span className="mono">{r.done_note}</span>}
      </div>
    );
    return (
      <div className="stack" style={{ gap: "1rem" }}>
        <div className={`card stack${open.length ? " dv-focus" : ""}`} style={{ gap: "0.625rem" }}>
          <b>{open.length ? `Відкритих правок: ${open.length}` : "Відкритих правок нема"}</b>
          <div className="mono">Як працює: записуєш, що виправити → «Промпт: виправити» → вставляєш у чат «{chatTitle(p!)}» у Claude Code → він виправляє і видає оновлення → встав його сюди («Вставити витяжку» зверху). Правки, чиї коди R-N він назве закритими, закриються самі.</div>
          <div className="inline" style={{ flexWrap: "wrap" }}>
            {open.length > 0 && <ProductPrompt productId={id} mode="requests" primary label={`Промпт: виправити ${open.length}`} />}
            {p!.chat_url && <a href={p!.chat_url} target="_blank" rel="noreferrer" className="btn ghost small">Чат Claude Code ↗</a>}
          </div>
        </div>
        <form action={requestAction} className="card stack" style={{ gap: "0.5rem" }}>
          {hid}
          <b>Нова правка</b>
          <VoiceTextarea name="text" required placeholder={"Що не так і як має бути. Можна кілька — розділи порожнім рядком.\nнапр.: На телефоні форма заявки не відправляється — кнопка сіра"} style={{ minHeight: "6rem" }} />
          <div className="inline" style={{ flexWrap: "wrap" }}>
            <input name="author" placeholder="від кого (клієнт / менеджер)" aria-label="Від кого" style={{ maxWidth: "18rem" }} />
            <SubmitButton className="small">Записати</SubmitButton>
          </div>
        </form>
        {open.length > 0 && <div className="stack" style={{ gap: "0.5rem" }}>{open.map(row)}</div>}
        {closed.length > 0 && <details><summary className="h-link">Закриті · {closed.length}</summary><div className="stack" style={{ gap: "0.5rem", marginTop: "0.625rem" }}>{closed.map(row)}</div></details>}
      </div>
    );
  }

  function Knowledge() {
    const kn = listPItems(id, "knowledge"), dec = listPItems(id, "decision"), ideas = listPItems(id, "idea");
    return (
      <div className="stack" style={{ gap: "1rem" }}>
        <form action={productItemAction} className="card mk-form">
          {hid}
          <select name="kind" defaultValue="knowledge"><option value="knowledge">Знання</option><option value="decision">Рішення</option><option value="idea">Ідея</option></select>
          <select name="cat" defaultValue="fix">{Object.entries(P_KNOW).map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select>
          <input name="title" required placeholder="Коротко: напр. «Телефонія: договір тільки на ФОП 3 групи»" className="wide" />
          <VoiceTextarea name="body" placeholder="Деталі: що сталось → чому → як вирішили / що знати наперед" style={{ minHeight: "4rem" }} className="wide" />
          <div><SubmitButton className="small">Записати</SubmitButton></div>
        </form>
        {Object.entries(P_KNOW).map(([k, t]) => { const xs = kn.filter((i) => (i.cat || "lesson") === k); return xs.length ? <div key={k} className="card stack st-box"><b>{t} · {xs.length}</b><div className="st-grid">{xs.map(item)}</div></div> : null; })}
        {dec.length > 0 && <div className="card stack st-box"><b>Рішення · {dec.length}</b><div className="st-grid">{dec.map(item)}</div></div>}
        {ideas.length > 0 && <div className="card stack st-box"><b>Ідеї · {ideas.length}</b><div className="st-grid">{ideas.map(item)}</div></div>}
        {!kn.length && !dec.length && !ideas.length && <p className="mono">Поки порожньо. Сюди — що ламалось і як виправили, як підключали інтеграції, юридичні моменти, доступи, платежі.</p>}
      </div>
    );
  }

  function Log() {
    const log = listPItems(id, "log"), plan = listPItems(id, "plan");
    return (
      <div className="stack" style={{ gap: "1rem" }}>
        <form action={productItemAction} className="card mk-form">
          {hid}
          <select name="kind" defaultValue="log"><option value="log">Етап хронології</option><option value="plan">Крок плану</option></select>
          <input name="title" required placeholder="Що зробили (або крок плану)" className="wide" />
          <VoiceTextarea name="body" placeholder="До чого дійшли, деталі" style={{ minHeight: "3rem" }} className="wide" />
          <div><SubmitButton className="small">Додати</SubmitButton></div>
        </form>
        {plan.length > 0 && <div className="card stack st-box"><b>План</b><div className="st-grid">{plan.map(item)}</div></div>}
        <div className="card stack" style={{ gap: "0.75rem" }}><b>Хронологія · {log.length}</b><Timeline items={tl()} empty="Хронологія порожня. Кожна витяжка і кожен реліз програми лягають сюди." /></div>
      </div>
    );
  }

  function Kit() {
    const t = kitText(p!, host);
    return (
      <div className="stack" style={{ gap: "0.75rem" }}>
        <div className="inline" style={{ flexWrap: "wrap" }}><CopyBig text={t} label="Копіювати весь набір" /><span className="mono">Встав у Claude Code в репозиторії програми. {"<PRODUCT_ID>"} і секрет — у «Звʼязок» потрібного продукту.</span></div>
        <div className="card tm-details"><Markdown md={t} /></div>
      </div>
    );
  }

  function Connect() {
    const url = `${host}/api/app/${id}`;
    const once = getSetting(`app.secret_once.${id}`) || "";
    const ev = productEvents(id, 80).filter((e) => !/^app\.(usage|health|insight)$/.test(e.event)).slice(0, 15), cnt = productEventCounts(id, 7);
    const iss = productIssues(id);
    const found = listPItems(id, "idea").filter((x) => x.source === "app" && !x.done);
    const total = iss.errors.length + iss.feedback.length + found.length;
    return (
      <div className="stack" style={{ gap: "1rem" }}>
        <div className={`card stack${total ? " dv-focus" : ""}`} style={{ gap: "0.5rem" }}>
          <b>Що виправити{total ? ` · ${total}` : ""}</b>
          <div className="mono">Помилки і відгуки з програми{iss.since ? ` після ${fmtDate(iss.since)}` : ""} + знахідки самоаудиту (однакові згруповані).</div>
          {total ? (
            <>
              <div className="st-grid">
                {[...iss.errors.map((x) => ({ ...x, k: "помилка" })), ...iss.feedback.map((x) => ({ ...x, k: "відгук" }))].slice(0, 12).map((x, i) => (
                  <div key={i} className="pv"><div className="pv-t">{x.summary}</div><div className="pv-m">{x.k}{x.n > 1 ? ` · ×${x.n}` : ""} · {fmtDate(x.last)}</div></div>
                ))}
                {found.slice(0, 6).map(item)}
              </div>
              <div className="inline" style={{ flexWrap: "wrap" }}>
                <ProductPrompt productId={id} mode="fix" primary label="Промпт: виправити все це" />
                <form action={issuesDoneAction}>{hid}<button className="ghost small">Розібрано — почати з нуля</button></form>
              </div>
            </>
          ) : <p className="mono">Поки чисто.</p>}
        </div>
        <div className="card stack" style={{ gap: "0.5rem" }}>
          <b>Програма → Client Ops (події)</b>
          <div className="mono">Програма, підключена набором «Client Ops Connect», шле сюди помилки, відгуки, релізи, використання. PRODUCT_ID = {id}.</div>
          <div className="inline" style={{ flexWrap: "wrap" }}><span className="mono" style={{ overflowWrap: "anywhere" }}>{url}</span><CopyText text={url} label="Копіювати адресу" /></div>
          {once ? (
            <div className="inline" style={{ flexWrap: "wrap" }}>
              <span className="mono" title="Секрет не показується на екрані — тільки копіювання">Секрет: ••••••{once.slice(-4)}</span><CopyText text={once} label="Копіювати секрет" />
              <form action={productSecretAction}>{hid}<input type="hidden" name="op" value="hide" /><button className="ghost small">Вставив у програму — сховати</button></form>
            </div>
          ) : <form action={productSecretAction} className="inline">{hid}<span className="mono">Секрет {appSecret(id) ? "збережено (показується один раз)" : "ще нема"}.</span><button className="ghost small">{appSecret(id) ? "Новий секрет" : "Створити секрет"}</button></form>}
          <div className="mono">Продажі клієнта (CRM, бот заявок) йдуть окремо: картка клієнта → «Продажі».</div>
        </div>
        <div className="card stack" style={{ gap: "0.375rem" }}>
          <b>Події{cnt.length ? ` · 7 днів: ${cnt.map((c) => `${c.event} ${c.n}`).join(", ")}` : ""}</b>
          <div className="mono">Щоденні usage / health / insight — лише лічильником вище; нижче — помилки, відгуки, релізи.</div>
          {ev.length ? ev.map((e) => <div key={e.event_id} className="mono">{fmtDate(e.received_at)} {e.received_at.slice(11, 16)} · {e.event} · {e.summary}</div>) : <p className="mono">Подій ще не було.</p>}
        </div>
      </div>
    );
  }

  function Edit() {
    const blocks: ["summary" | "how" | "features" | "stack" | "pros" | "cons" | "links" | "next_step" | "kit_md", string, boolean, string, boolean?][] = [
      ["summary", "Що це і для кого", false, "1–2 речення: що робить і для кого", true],
      ["how", "Як працює", false, "Як це працює для користувача — коротко, по кроках", true],
      ["features", "Головні фічі", true, "Що вміє"], ["stack", "З чого складається", true, "Технології, сервіси, модулі"],
      ["pros", "Плюси", true, "Сильні сторони"], ["cons", "Мінуси / ризики", true, "Слабкі місця"],
      ["links", "Посилання", true, "Назва — https://…"], ["next_step", "Наступний крок", false, "Що робимо далі"],
      ["kit_md", "Набір / промпт", false, "Для наборів: текст промпту; {{HOST}} = адреса системи", true],
    ];
    return (
      <div className="stack" style={{ gap: "1rem" }}>
        <div className="card eb-head">
          <LogoMark kind="product" id={id} name={p!.name} src={logoSrc("product", id)} size={48} editable />
          <div className="stack" style={{ gap: "0.125rem", flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: "1.125rem" }}>{p!.name}</b>
            <span className="mono">{PRODUCT_KINDS[p!.kind] ?? p!.kind} · {PRODUCT_STATUS[p!.status] ?? p!.status}</span>
          </div>
          <Pop className="pop-trigger pop-inline" title="Основне" trigger={<span className="btn ghost small">Назва, тип, статус</span>}>
            <form action={saveProductAction} className="stack" style={{ gap: "0.5rem" }}>
              {hid}
              <input name="name" defaultValue={p!.name} required aria-label="Назва" />
              <select name="kind" defaultValue={p!.kind} aria-label="Тип">{Object.entries(PRODUCT_KINDS).map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select>
              <select name="status" defaultValue={p!.status} aria-label="Статус">{Object.entries(PRODUCT_STATUS).map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select>
              <div className="inline"><SubmitButton className="small">Зберегти</SubmitButton><span className="grow" /><button name="delete" value="1" className="ghost small danger-text">Видалити продукт</button></div>
            </form>
          </Pop>
        </div>
        <form action={saveProductAction} className="card stack" style={{ gap: "0.5rem" }}>
          {hid}
          <input type="hidden" name="ws" value="1" />
          <b>Робоче місце · {productCode(id)}{sp.saved && <span className="tag ok" style={{ marginLeft: "0.5rem" }}>Збережено ✓</span>}</b>
          <div className="mono">Назви чат у Claude Code: «{chatTitle(p!)}». Посилання на чат — з адресного рядка claude.ai/code.</div>
          <div className="pj-ws">
            <label>Чат Claude Code<input name="chat_url" defaultValue={p!.chat_url} placeholder="https://claude.ai/code/session_…" inputMode="url" autoCapitalize="off" /></label>
            <label>GitHub-репо<input name="repo_url" defaultValue={p!.repo_url} placeholder="https://github.com/…" inputMode="url" autoCapitalize="off" /></label>
            <label>Сайт / застосунок<input name="prod_url" defaultValue={p!.prod_url} placeholder="https://…" inputMode="url" autoCapitalize="off" /></label>
            <label>Microsoft Clarity (Project ID)<input name="clarity_id" defaultValue={p!.clarity_id} placeholder="напр. abcd1234ef" autoCapitalize="off" /></label>
          </div>
          <div><SubmitButton className="small">Зберегти</SubmitButton></div>
        </form>
        <form action={productOwnerAction} className="card inline" style={{ flexWrap: "wrap" }}>
          {hid}
          <b>Чий проєкт</b>
          <select name="owner" defaultValue={p!.client_id ?? ""} aria-label="Чий проєкт">
            <option value="">Мій продукт (загальний)</option>
            {clientsAll.map((c) => <option key={c.id} value={c.id}>Клієнта: {c.name}</option>)}
          </select>
          <SubmitButton className="small">Зберегти</SubmitButton>
        </form>
        <div className="eb-grid">
          {blocks.filter(([k]) => k !== "kit_md" || p!.kind === "kit" || p!.kit_md).map(([k, t, list, hint, wide]) => (
            <EditBlock key={k} title={t} name={k} value={String(p![k] ?? "")} list={list} hint={hint} wide={wide} action={saveProductAction} hidden={hid} rows={k === "kit_md" ? 16 : list ? 10 : 6} />
          ))}
        </div>
      </div>
    );
  }

}
