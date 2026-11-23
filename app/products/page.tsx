import Link from "next/link";
import { BrandDot, brandOf } from "@/components/Brand";
import Icon from "@/components/Icon";
import Pop from "@/components/Pop";
import { logoMap } from "@/lib/repo/logos";
import { lines } from "@/lib/repo/strategy";
import { listProducts, PRODUCT_KINDS, PRODUCT_STATUS, productClients, openRequestCounts, productCode, type Product } from "@/lib/repo/products";
import { listClients } from "@/lib/repo/clients";
import SubmitButton from "@/components/SubmitButton";
import { saveProductAction } from "./actions";
import { ProductImport, ProductPrompt } from "./ProductClient";

export const dynamic = "force-dynamic";

// Продукти: паспорти всього, що ми зробили і чим користуємось для клієнтів
// Тип застосунку «на око»: з назви й виду — свій колір і значок, як іконки в App Store
type AppType = { key: string; label: string; icon: string };
function appType(p: Product): AppType {
  if (p.kind === "kit") return { key: "kit", label: "Набір", icon: "book" };
  // Спершу назва (опис згадує й інше: «CRM … з форм сайту»), потім опис
  for (const t of [p.name.toLowerCase(), p.summary.toLowerCase()]) {
    if (/crm|срм/.test(t)) return { key: "crm", label: "CRM", icon: "users" };
    if (/сайт|site|лендінг|landing/.test(t)) return { key: "site", label: "Сайт", icon: "globe" };
    if (/бот|bot/.test(t)) return { key: "bot", label: "Бот", icon: "bot" };
  }
  if (p.kind === "service") return { key: "svc", label: "Послуга", icon: "wrench" };
  return { key: "app", label: "Програма", icon: "box" };
}

export default async function ProductsPage() {
  const ps = listProducts();
  const logos = logoMap("product");
  const reqs = openRequestCounts();
  const clientName = new Map(listClients().map((c) => [c.id, c.name]));
  const mine = ps.filter((p) => !p.client_id), theirs = ps.filter((p) => p.client_id);
  const tile = (p: Product) => {
    const ty = appType(p), rq = reqs.get(p.id) ?? 0, logo = logos.get(p.id);
    const who = p.client_id ? "проєкт клієнта" : productClients(p.id).length ? `клієнтів: ${productClients(p.id).length}` : "моє";
    const name = p.name.replace(/\s*·\s*/, " ");
    const ms = [...new Set(lines(p.stack).map((x) => brandOf(x)?.name).filter(Boolean))] as string[];
    return (
      <Link key={p.id} href={`/products/${p.id}`} className="app-tile">
        <span className={`app-icon t-${ty.key}`}>{logo ? <img src={logo} alt="" /> : <Icon name={ty.icon} size={30} stroke={2} />}</span>
        <span className="app-body">
          <b className="app-name">{name}</b>
          <span className="app-sub">{ty.label} · {who}</span>
          {p.summary && <span className="app-desc">{p.summary}</span>}
          <span className="app-foot">
            <span className={`tag st-s-${p.status}`}>{PRODUCT_STATUS[p.status] ?? p.status}</span>
            {rq > 0 && <span className="tag warn">правок {rq}</span>}
            <span className="grow" />
            {ms.slice(0, 3).map((m) => <BrandDot key={m} text={m} size={14} />)}
            <span className="pj-code sm">{productCode(p.id)}</span>
          </span>
        </span>
      </Link>
    );
  };
  return (
    <>
      <div className="head">
        <div>
          <h1>Проєкти</h1>
          <div className="row-sub">Мої програми й проєкти клієнтів. Код P-N = назва чату в Claude Code.</div>
        </div>
        <Pop className="pop-trigger pop-inline" title="Додати проєкт" trigger={<span className="btn small">+ Проєкт</span>}>
          <div className="stack" style={{ gap: "0.625rem" }}>
            <div className="mono">1. Скопіюй промпт → встав у Claude Code в репозиторії програми. 2. Він видасть паспорт [CLIENT-OPS:ПРОДУКТ]. 3. Встав сюди — проєкт створиться сам.</div>
            <div><ProductPrompt productId={null} label="Промпт: описати нову програму" /></div>
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
        </Pop>
      </div>
      <h2 className="app-h">Мої <span className="mono">{mine.length}</span></h2>
      <div className="app-grid">{mine.map(tile)}</div>
      <h2 className="app-h">Клієнтів <span className="mono">{theirs.length}</span></h2>
      {theirs.length ? <div className="app-grid">{[...theirs].sort((a, b) => (clientName.get(a.client_id!) ?? "").localeCompare(clientName.get(b.client_id!) ?? "")).map(tile)}</div>
        : <p className="mono">Ще нема. Проєкт клієнта зʼявиться, коли в його вкладці «Сайт» / «CRM» / «Автоматизація» натиснеш «Почати вести розвиток».</p>}
    </>
  );
}
