import Link from "next/link";
import AskAssistant from "@/components/AskAssistant";
import Pop from "@/components/Pop";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { orgItemAction, saveOrgAction } from "@/app/products/actions";
import { fmtDate } from "@/lib/dates";
import { listClients } from "@/lib/repo/clients";
import { listKb } from "@/lib/repo/kb";
import { getOrg, listOrgItems, listProducts, ORG_FIELDS, ORG_HORIZONS, ORG_KINDS, PRODUCT_STATUS, type OrgItem, type OrgKey } from "@/lib/repo/products";

export const dynamic = "force-dynamic";

// Розвиток організації: хто ми, позиціонування, послуги, підхід, куди рухаємось, план. Плюс інструкції (стара база знань).
export default async function DevPage({ searchParams }: { searchParams: Promise<{ q?: string; v?: string }> }) {
  const { q = "", v = q ? "docs" : "dev" } = await searchParams;
  return (
    <>
      <div className="head">
        <div>
          <h1>Розвиток</h1>
          <div className="row-sub">Паспорт нашої організації: хто ми, що даємо, як працюємо і куди рухаємось. Будуємо паралельно з системами для клієнтів.</div>
        </div>
        <div className="inline">
          <AskAssistant text="Подивись на наш розвиток (org_get), продукти і клієнтів. Що варто оновити в позиціонуванні, послугах і плані? Коротко, пунктами.">Джері, що оновити?</AskAssistant>
        </div>
      </div>
      <nav className="mx-tabs" style={{ marginBottom: "1rem" }}>
        <Link href="/kb" className={v === "dev" ? "on" : ""}>Напрямок</Link>
        <Link href="/kb?v=docs" className={v === "docs" ? "on" : ""}>Інструкції</Link>
      </nav>
      {v === "docs" ? <Docs q={q} /> : <Dev />}
    </>
  );
}

function Dev() {
  const o = getOrg();
  const items = listOrgItems();
  const plan = (h: string) => items.filter((i) => i.kind === "plan" && i.horizon === h);
  const ps = listProducts();
  const live = ps.filter((p) => p.status === "live" || p.status === "improving");
  const clients = listClients().filter((c) => c.status === "active").length;
  const keys = Object.keys(ORG_FIELDS) as OrgKey[];
  const move = (i: OrgItem, h: string, l: string) => <form action={orgItemAction}><input type="hidden" name="op" value="move" /><input type="hidden" name="item_id" value={i.id} /><input type="hidden" name="horizon" value={h} /><button className="ghost small">{l}</button></form>;
  const del = (i: OrgItem) => <form action={orgItemAction}><input type="hidden" name="op" value="delete" /><input type="hidden" name="item_id" value={i.id} /><button className="ghost small">×</button></form>;
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="st-grid">
        {keys.map((k) => (
          <Pop key={k} className={`pop-card stack st-box${k === "focus" ? " dv-focus" : ""}`} title={ORG_FIELDS[k].label} trigger={
            <><b>{ORG_FIELDS[k].label}</b>{o[k] ? <div className="pv-s l4" style={{ whiteSpace: "pre-wrap" }}>{o[k]}</div> : <p className="mono" style={{ margin: 0 }}>{ORG_FIELDS[k].hint}</p>}</>
          }>
            {o[k] ? <div className="tm-details" style={{ whiteSpace: "pre-wrap" }}>{o[k]}</div> : <p className="mono">Порожньо. {ORG_FIELDS[k].hint}.</p>}
            <form action={saveOrgAction} className="stack" style={{ gap: "0.5rem", marginTop: "0.75rem" }}>
              <VoiceTextarea name={k} defaultValue={o[k]} placeholder={ORG_FIELDS[k].hint} style={{ minHeight: "6rem" }} />
              <div><SubmitButton className="small">Зберегти</SubmitButton></div>
            </form>
          </Pop>
        ))}
        <div className="card stack st-box">
          <b>Наші можливості зараз</b>
          <div className="mono">Активних клієнтів: {clients} · продуктів у роботі: {live.length} з {ps.length}</div>
          {ps.length ? <ul className="st-list">{ps.map((p) => <li key={p.id}><Link href={`/products/${p.id}`} className="h-link">{p.name}</Link> <small>· {PRODUCT_STATUS[p.status] ?? p.status}</small></li>)}</ul> : <p className="mono">Продуктів ще нема.</p>}
        </div>
      </div>
      <details className="card">
        <summary><b>✎ Змінити напрямок</b></summary>
        <form action={saveOrgAction} className="stack" style={{ gap: "0.5rem", marginTop: "0.75rem" }}>
          {keys.map((k) => <label key={k} className="cm-field"><span>{ORG_FIELDS[k].label}</span><VoiceTextarea name={k} defaultValue={o[k]} placeholder={ORG_FIELDS[k].hint} style={{ minHeight: "4rem" }} /></label>)}
          <div><SubmitButton className="small">Зберегти</SubmitButton></div>
        </form>
      </details>

      <h2 style={{ margin: "0.5rem 0 0" }}>План розвитку</h2>
      <form action={orgItemAction} className="card mk-form">
        <input type="hidden" name="op" value="add" />
        <select name="kind" defaultValue="plan">{Object.entries(ORG_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="horizon" defaultValue="now">{(["now", "next", "later"] as const).map((h) => <option key={h} value={h}>{ORG_HORIZONS[h]}</option>)}</select>
        <input name="title" required placeholder="Напр.: «Кейс Аква Віта: було → стало»" className="wide" />
        <select name="product_id" defaultValue=""><option value="">— продукт —</option>{ps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <div><SubmitButton className="small">Додати</SubmitButton></div>
      </form>
      <div className="st-cols">
        {(["now", "next", "later"] as const).map((h) => (
          <div key={h} className="card stack st-col">
            <b>{ORG_HORIZONS[h]} <span className="mono">{plan(h).length}</span></b>
            {plan(h).map((i) => (
              <div key={i.id} className="st-pi">
                <div>{i.title}{i.product_id && <small> · {ps.find((p) => p.id === i.product_id)?.name}</small>}</div>
                <div className="st-pi-act">{move(i, "done", "✓")}{h !== "now" && move(i, "now", "↑ зараз")}{h === "now" && move(i, "next", "↓ далі")}{del(i)}</div>
              </div>
            ))}
            {!plan(h).length && <p className="mono">—</p>}
          </div>
        ))}
      </div>
      {(["decision", "lesson", "idea"] as const).map((k) => {
        const xs = items.filter((i) => i.kind === k);
        return xs.length ? <div key={k} className="card stack st-box"><b>{k === "decision" ? "Рішення" : k === "lesson" ? "Уроки" : "Ідеї"} · {xs.length}</b><div className="st-grid">{xs.map((i) => (
          <Pop key={i.id} title={i.title} sub={fmtDate(i.created_at)} trigger={<div className="pv"><div className="pv-t">{i.title}</div>{i.body && <div className="pv-s">{i.body}</div>}</div>}>
            {i.body ? <div className="tm-details" style={{ whiteSpace: "pre-wrap" }}>{i.body}</div> : <p className="mono">Деталей нема.</p>}
            <div style={{ marginTop: "0.75rem" }}>{del(i)}</div>
          </Pop>
        ))}</div></div> : null;
      })}
      {plan("done").length > 0 && <details className="card"><summary><b>Зроблено · {plan("done").length}</b></summary><ul className="st-list">{plan("done").map((i) => <li key={i.id}>{i.title} <small>{i.done_at ? fmtDate(i.done_at) : ""}</small></li>)}</ul></details>}
    </div>
  );
}

function Docs({ q }: { q: string }) {
  const items = listKb(q);
  const groups = [...new Set(items.map((a) => a.category))];
  return (
    <>
      <div className="inline" style={{ marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <form className="inline grow">
          <input type="hidden" name="v" value="docs" />
          <input name="q" defaultValue={q} placeholder="Пошук по інструкціях…" aria-label="Пошук" />
          <button className="ghost">Знайти</button>
        </form>
        <AskAssistant text="Запиши в інструкції те, що ми щойно робили: кроки, підводні камені, що перевірити.">Джері, запиши</AskAssistant>
        <Link href="/kb/new" className="btn">+ Нова</Link>
      </div>
      {!items.length && <div className="empty card">{q ? "Нічого не знайшов." : "Поки порожньо."}</div>}
      {groups.map((g) => (
        <section key={g} style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>{g}</h2>
          <div className="list kb-list">
            {items.filter((a) => a.category === g).map((a) => (
              <Link key={a.id} href={`/kb/${a.id}`} className="row">
                <div className="row-main"><div className="row-title">{a.title}</div><div className="mono">оновлено {fmtDate(a.updated_at)}</div></div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
