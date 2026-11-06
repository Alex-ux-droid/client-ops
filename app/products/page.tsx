import Link from "next/link";
import { BrandDot, brandOf } from "@/components/Brand";
import { lines } from "@/lib/repo/strategy";
import { fmtDate } from "@/lib/dates";
import { listProducts, PRODUCT_KINDS, PRODUCT_STATUS, productClients, listPItems } from "@/lib/repo/products";
import SubmitButton from "@/components/SubmitButton";
import { saveProductAction } from "./actions";
import { ProductImport, ProductPrompt } from "./ProductClient";

export const dynamic = "force-dynamic";

// Продукти: паспорти всього, що ми зробили і чим користуємось для клієнтів
export default async function ProductsPage() {
  const ps = listProducts();
  return (
    <>
      <div className="head">
        <div>
          <h1>Продукти</h1>
          <div className="row-sub">Наші програми, набори й послуги: що це, як працює, з чого складається, що ламалось і що треба знати наперед. Джері бачить усе це.</div>
        </div>
      </div>
      <div className="card stack" style={{ gap: "0.625rem", marginBottom: "1.25rem" }}>
        <b>Додати продукт з Claude Code</b>
        <div className="mono">1. Скопіюй промпт → встав у Claude Code в репозиторії програми. 2. Він видасть паспорт [CLIENT-OPS:ПРОДУКТ]. 3. Встав сюди — продукт створиться сам.</div>
        <div className="inline" style={{ flexWrap: "wrap" }}><ProductPrompt productId={null} label="Промпт: описати нову програму" /></div>
        <ProductImport productId={null} compact />
        <details>
          <summary className="h-link">або вручну</summary>
          <form action={saveProductAction} className="mk-form" style={{ marginTop: "0.625rem" }}>
            <input name="name" required placeholder="Назва: Oselya CRM, Бот заявок…" />
            <select name="kind" defaultValue="app">{Object.entries(PRODUCT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select name="status" defaultValue="building">{Object.entries(PRODUCT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input name="summary" placeholder="Що це і для кого" className="wide" />
            <div><SubmitButton className="small">Створити</SubmitButton></div>
          </form>
        </details>
      </div>
      {(Object.keys(PRODUCT_KINDS) as (keyof typeof PRODUCT_KINDS)[]).map((k) => {
        const xs = ps.filter((p) => p.kind === k);
        if (!xs.length) return null;
        return (
          <section key={k} style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ marginBottom: "0.75rem" }}>{PRODUCT_KINDS[k]}</h2>
            <div className="st-parts">
              {xs.map((p) => {
                const cl = productClients(p.id), kn = listPItems(p.id, "knowledge").length;
                return (
                  <Link key={p.id} href={`/products/${p.id}`} className={`card st-part s-${p.status}`}>
                    <div className="st-part-h"><b>{p.name}</b><span className={`tag st-s-${p.status}`}>{PRODUCT_STATUS[p.status] ?? p.status}</span></div>
                    {p.summary && <p className="pv-s">{p.summary}</p>}
                    {(() => { const ms = [...new Set(lines(p.stack).map((x) => brandOf(x)?.name).filter(Boolean))] as string[]; return ms.length ? <span className="qt-marks">{ms.slice(0, 8).map((m) => <BrandDot key={m} text={m} size={16} />)}</span> : null; })()}
                    <small>{[cl.length ? `клієнтів: ${cl.length}` : "", kn ? `знань: ${kn}` : "", `оновлено ${fmtDate(p.updated_at)}`].filter(Boolean).join(" · ")}</small>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
