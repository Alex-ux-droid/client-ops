import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Markdown from "@/components/Markdown";
import Pop from "@/components/Pop";
import Timeline from "@/components/Timeline";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { CopyText } from "@/app/startups/[id]/CopyText";
import { fmtDate } from "@/lib/dates";
import { appSecret, kitText } from "@/lib/products";
import { listClients } from "@/lib/repo/clients";
import { getProduct, listPItems, P_KNOW, PRODUCT_KINDS, PRODUCT_STATUS, productClients, productEventCounts, productEvents, productTimeline, productUpdates, nextUpdateVer, hasPassport, type PItem } from "@/lib/repo/products";
import { getSetting } from "@/lib/repo/settings";
import { lines } from "@/lib/repo/strategy";
import { productClientAction, productItemAction, productSecretAction, saveProductAction } from "../actions";
import { CopyBig, ProductImport, ProductPrompt } from "../ProductClient";

export const dynamic = "force-dynamic";

const VIEWS = [{ k: "overview", label: "Паспорт" }, { k: "log", label: "Хронологія і план" }, { k: "knowledge", label: "Знання" }, { k: "kit", label: "Набір" }, { k: "connect", label: "Звʼязок" }, { k: "edit", label: "Змінити" }] as const;

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
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
  const List = ({ t, xs }: { t: string; xs: string[] }) => (xs.length ? <div className="card stack st-box"><b>{t}</b><ul className="st-list">{xs.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null);
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
      <Link href="/products" className="h-link">← Продукти</Link>
      <div className="st-head">
        <div style={{ minWidth: 0 }}>
          <div className="st-part-h"><h1 style={{ margin: 0 }}>{p.name}</h1><span className={`tag st-s-${p.status}`}>{PRODUCT_STATUS[p.status] ?? p.status}</span><span className="mono">{PRODUCT_KINDS[p.kind] ?? p.kind} · оновлено {fmtDate(p.updated_at)}</span></div>
          {p.summary && <p style={{ margin: "0.375rem 0 0", color: "var(--muted)" }}>{p.summary}</p>}
        </div>
        <div className="inline" style={{ flexWrap: "wrap" }}>
          {hasPassport(id) ? <>
            <ProductPrompt productId={id} mode="update" primary label={`Промпт: оновлення ${nextUpdateVer(id)}`} />
            <ProductPrompt productId={id} label="Повний промпт" />
          </> : <ProductPrompt productId={id} label="Промпт для Claude Code" />}
          <ProductImport productId={id} compact />
        </div>
      </div>
      <nav className="mx-tabs st-tabs">{views.map((x) => <Link key={x.k} href={x.k === "overview" ? base : `${base}?v=${x.k}`} scroll={false} className={x.k === v ? "on" : ""}>{x.label}</Link>)}</nav>

      {v === "overview" && <Overview />}
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
    return (
      <div className="stack" style={{ gap: "1rem" }}>
        {(stopped || ups[0]) && <div className="card dv-focus stack" style={{ gap: "0.25rem" }}><b>Де зупинились</b><span>{stopped ?? ups[0].title}</span><span className="mono">після «{ups[0].title}» · {fmtDate(ups[0].created_at)}</span></div>}
        {(p!.how || p!.next_step) && <div className="card st-part-head">{p!.how && <p>{p!.how}</p>}{p!.next_step && <p className="st-next">Наступний крок: {p!.next_step}</p>}</div>}
        <div className="st-grid">
          <List t="Головні фічі" xs={lines(p!.features)} />
          <List t={`З чого складається · ${lines(p!.stack).length}`} xs={lines(p!.stack)} />
          <List t="Плюси" xs={lines(p!.pros)} />
          <List t="Мінуси / ризики" xs={lines(p!.cons)} />
          {lines(p!.links).length > 0 && <div className="card stack st-box"><b>Посилання</b><ul className="st-list">{lines(p!.links).map((l, i) => { const u = l.match(/https?:\/\/\S+/)?.[0]; return <li key={i}>{u ? <a href={u} target="_blank" rel="noreferrer" className="h-link">{l.replace(u, "").replace(/[—-]\s*$/, "").trim() || u}</a> : l}</li>; })}</ul></div>}
          {plan.length > 0 && <div className="card stack st-box"><b>Відкриті кроки</b><ul className="st-list">{plan.map((x) => <li key={x.id}>{x.title}</li>)}</ul></div>}
        </div>
        <div className="card stack" style={{ gap: "0.75rem" }}>
          <div className="mx-main-head"><b>Хронологія — як ми сюди дійшли</b><Link href={`${base}?v=log`}>план і додати →</Link></div>
          <Timeline items={tl()} empty="Ще порожньо. Встав витяжку з Claude Code — етапи стануть блоками." />
        </div>
        {ups.length > 0 && <div className="card stack st-box"><b>Оновлення · {ups.length}</b><div className="st-grid">{ups.map(item)}</div></div>}
        {kn.length > 0 && <div className="card stack st-box"><div className="mx-main-head"><b>Що знаємо (останнє)</b><Link href={`${base}?v=knowledge`}>усе →</Link></div><div className="st-grid">{kn.map(item)}</div></div>}
        <div className="card stack" style={{ gap: "0.5rem" }}>
          <b>Клієнти, які користуються</b>
          {cl.length ? cl.map((c) => (
            <div key={c.client_id} className="inline" style={{ justifyContent: "space-between" }}>
              <Link href={`/clients/${c.client_id}`} className="h-link">{c.name}{c.note ? ` · ${c.note}` : ""}</Link>
              <form action={productClientAction}>{hid}<input type="hidden" name="client_id" value={c.client_id} /><input type="hidden" name="on" value="0" /><button className="ghost small">×</button></form>
            </div>
          )) : <p className="mono">Ще нікого.</p>}
          {all.length > 0 && <form action={productClientAction} className="inline" style={{ flexWrap: "wrap" }}>{hid}<select name="client_id" aria-label="Клієнт">{all.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input name="note" placeholder="примітка (необовʼязково)" /><button className="ghost small">Додати</button></form>}
        </div>
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
    const ev = productEvents(id, 25), cnt = productEventCounts(id, 7);
    return (
      <div className="stack" style={{ gap: "1rem" }}>
        <div className="card stack" style={{ gap: "0.5rem" }}>
          <b>Програма → Client Ops (події)</b>
          <div className="mono">Програма, підключена набором «Client Ops Connect», шле сюди помилки, відгуки, релізи, використання. PRODUCT_ID = {id}.</div>
          <div className="inline" style={{ flexWrap: "wrap" }}><span className="mono" style={{ overflowWrap: "anywhere" }}>{url}</span><CopyText text={url} label="Копіювати адресу" /></div>
          {once ? (
            <div className="inline" style={{ flexWrap: "wrap" }}>
              <span className="mono" style={{ overflowWrap: "anywhere" }}>Секрет: {once}</span><CopyText text={once} label="Копіювати секрет" />
              <form action={productSecretAction}>{hid}<input type="hidden" name="op" value="hide" /><button className="ghost small">Вставив у програму — сховати</button></form>
            </div>
          ) : <form action={productSecretAction} className="inline">{hid}<span className="mono">Секрет {appSecret(id) ? "збережено (показується один раз)" : "ще нема"}.</span><button className="ghost small">{appSecret(id) ? "Новий секрет" : "Створити секрет"}</button></form>}
          <div className="mono">Продажі клієнта (CRM, бот заявок) йдуть окремо: картка клієнта → «Продажі».</div>
        </div>
        <div className="card stack" style={{ gap: "0.375rem" }}>
          <b>Події{cnt.length ? ` · 7 днів: ${cnt.map((c) => `${c.event} ${c.n}`).join(", ")}` : ""}</b>
          {ev.length ? ev.map((e) => <div key={e.event_id} className="mono">{fmtDate(e.received_at)} {e.received_at.slice(11, 16)} · {e.event} · {e.summary}</div>) : <p className="mono">Подій ще не було.</p>}
        </div>
      </div>
    );
  }

  function Edit() {
    return (
      <form action={saveProductAction} className="card stack" style={{ gap: "0.5rem" }}>
        {hid}
        <div className="mk-form">
          <input name="name" defaultValue={p!.name} required />
          <select name="kind" defaultValue={p!.kind}>{Object.entries(PRODUCT_KINDS).map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select>
          <select name="status" defaultValue={p!.status}>{Object.entries(PRODUCT_STATUS).map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select>
        </div>
        {([["summary", "Що це і для кого", 3], ["how", "Як працює", 4], ["features", "Головні фічі (по рядку)", 5], ["stack", "З чого складається (по рядку)", 5], ["links", "Посилання (по рядку: Назва — https://…)", 3], ["pros", "Плюси (по рядку)", 3], ["cons", "Мінуси / ризики (по рядку)", 3], ["next_step", "Наступний крок", 2], ["kit_md", "Набір / промпт (для наборів; {{HOST}} = адреса системи)", 6]] as const).map(([k, l, r]) => (
          <label key={k} className="cm-field"><span>{l}</span><VoiceTextarea name={k} defaultValue={p![k]} style={{ minHeight: `${r * 1.4}rem` }} /></label>
        ))}
        <div className="inline"><SubmitButton className="small">Зберегти</SubmitButton><span className="grow" /><button name="delete" value="1" className="ghost small danger-text">Видалити продукт</button></div>
      </form>
    );
  }
}
