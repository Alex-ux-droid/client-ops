import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Markdown from "@/components/Markdown";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { CopyText } from "@/app/startups/[id]/CopyText";
import { fmtDate } from "@/lib/dates";
import { appSecret, kitText } from "@/lib/products";
import { listClients } from "@/lib/repo/clients";
import { getProduct, listPItems, P_KNOW, PRODUCT_KINDS, PRODUCT_STATUS, productClients, productEventCounts, productEvents, type PItem } from "@/lib/repo/products";
import { getSetting } from "@/lib/repo/settings";
import { lines } from "@/lib/repo/strategy";
import { productClientAction, productItemAction, productSecretAction, saveProductAction } from "../actions";
import { CopyBig, ProductImport, ProductPrompt } from "../ProductClient";

export const dynamic = "force-dynamic";

const VIEWS = [{ k: "overview", label: "Паспорт" }, { k: "knowledge", label: "Знання" }, { k: "log", label: "Хроніка і план" }, { k: "kit", label: "Набір" }, { k: "connect", label: "Звʼязок" }, { k: "edit", label: "Змінити" }] as const;

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
  const item = (i: PItem) => (
    <details key={i.id} className="st-k">
      <summary>{i.done ? <s>{i.title}</s> : i.title} <small className="mono">{fmtDate(i.created_at)}{i.source === "extract" ? " · з витяжки" : i.source === "jerry" ? " · Джері" : ""}</small></summary>
      {i.body && <div className="tm-details"><Markdown md={i.body} /></div>}
      <div className="inline">
        {(i.kind === "plan") && <form action={productItemAction}>{hid}<input type="hidden" name="item_id" value={i.id} /><input type="hidden" name="op" value="toggle" /><button className="ghost small">{i.done ? "↺ повернути" : "✓ зроблено"}</button></form>}
        <form action={productItemAction}>{hid}<input type="hidden" name="item_id" value={i.id} /><input type="hidden" name="op" value="delete" /><button className="ghost small">Прибрати</button></form>
      </div>
    </details>
  );

  return (
    <section className="st stack">
      <Link href="/products" className="h-link">← Продукти</Link>
      <div className="st-head">
        <div style={{ minWidth: 0 }}>
          <div className="st-part-h"><h1 style={{ margin: 0 }}>{p.name}</h1><span className={`tag st-s-${p.status}`}>{PRODUCT_STATUS[p.status] ?? p.status}</span><span className="mono">{PRODUCT_KINDS[p.kind] ?? p.kind} · оновлено {fmtDate(p.updated_at)}</span></div>
          {p.summary && <p style={{ margin: "0.375rem 0 0", color: "var(--muted)" }}>{p.summary}</p>}
        </div>
        <div className="inline" style={{ flexWrap: "wrap" }}>
          <ProductPrompt productId={id} label="Промпт для Claude Code" />
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
    return (
      <div className="stack" style={{ gap: "1rem" }}>
        {(p!.how || p!.next_step) && <div className="card st-part-head">{p!.how && <p>{p!.how}</p>}{p!.next_step && <p className="st-next">Наступний крок: {p!.next_step}</p>}</div>}
        <div className="st-grid">
          <List t="Головні фічі" xs={lines(p!.features)} />
          <List t={`З чого складається · ${lines(p!.stack).length}`} xs={lines(p!.stack)} />
          <List t="Плюси" xs={lines(p!.pros)} />
          <List t="Мінуси / ризики" xs={lines(p!.cons)} />
          {lines(p!.links).length > 0 && <div className="card stack st-box"><b>Посилання</b><ul className="st-list">{lines(p!.links).map((l, i) => { const u = l.match(/https?:\/\/\S+/)?.[0]; return <li key={i}>{u ? <a href={u} target="_blank" rel="noreferrer" className="h-link">{l.replace(u, "").replace(/[—-]\s*$/, "").trim() || u}</a> : l}</li>; })}</ul></div>}
          {plan.length > 0 && <div className="card stack st-box"><b>Відкриті кроки</b><ul className="st-list">{plan.map((x) => <li key={x.id}>{x.title}</li>)}</ul></div>}
        </div>
        {kn.length > 0 && <div className="card stack st-box"><div className="mx-main-head"><b>Що знаємо (останнє)</b><Link href={`${base}?v=knowledge`}>усе →</Link></div>{kn.map((k) => <div key={k.id}><small className="mono">{P_KNOW[k.cat as keyof typeof P_KNOW] ?? "знання"}</small> {k.title}</div>)}</div>}
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
        {Object.entries(P_KNOW).map(([k, t]) => { const xs = kn.filter((i) => (i.cat || "lesson") === k); return xs.length ? <div key={k} className="card stack st-box"><b>{t} · {xs.length}</b>{xs.map(item)}</div> : null; })}
        {dec.length > 0 && <div className="card stack st-box"><b>Рішення · {dec.length}</b>{dec.map(item)}</div>}
        {ideas.length > 0 && <div className="card stack st-box"><b>Ідеї · {ideas.length}</b>{ideas.map(item)}</div>}
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
          <select name="kind" defaultValue="plan"><option value="plan">Крок плану</option><option value="log">Що зроблено</option></select>
          <input name="title" required placeholder="Коротко" className="wide" />
          <div><SubmitButton className="small">Додати</SubmitButton></div>
        </form>
        {plan.length > 0 && <div className="card stack st-box"><b>План</b>{plan.map(item)}</div>}
        {log.length ? <div className="card stack st-box"><b>Хроніка</b>{log.map(item)}</div> : <p className="mono">Хроніка порожня. Кожна витяжка і кожен реліз програми лягають сюди.</p>}
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
