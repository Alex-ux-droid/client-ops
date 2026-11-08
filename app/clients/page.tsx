import Link from "next/link";
import LogoMark from "@/components/LogoMark";
import { logoMap } from "@/lib/repo/logos";
import { money } from "@/lib/config";
import { fmtDate } from "@/lib/dates";
import { STAGE_LABEL, STATUS_LABEL, STATUS_TAG } from "@/lib/labels";
import { clientFlags, listClients } from "@/lib/repo/clients";
import { mainMetricBrief } from "@/lib/repo/metrics";

const FILTERS = [
  { k: "work", label: "В роботі" },
  { k: "active", label: "Активні" },
  { k: "lead", label: "Ліди" },
  { k: "paused", label: "Пауза" },
  { k: "archived", label: "Архів" },
] as const;

const KINDS = [{ k: "", label: "Усі" }, { k: "client", label: "Клієнти" }, { k: "partner", label: "Партнерства" }, { k: "own_product", label: "Свої продукти" }] as const;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ f?: string; k?: string }> }) {
  const sp = await searchParams;
  const f = FILTERS.find((x) => x.k === sp.f)?.k ?? "work";
  const kind = KINDS.find((x) => x.k && x.k === sp.k)?.k ?? "";
  const everyone = listClients();
  const hasPartners = everyone.some((c) => c.kind !== "client");
  const all = kind ? everyone.filter((c) => c.kind === kind) : everyone;
  const logos = logoMap("client");
  const clients = all.filter((c) => (f === "work" ? c.status === "active" || c.status === "lead" : c.status === f));
  const count = (k: string) => all.filter((c) => (k === "work" ? c.status === "active" || c.status === "lead" : c.status === k)).length;
  return (
    <>
      <div className="head">
        <div><div className="kicker">{everyone.length} у базі</div><h1>Клієнти</h1></div>
        <Link href="/clients/new" className="btn">+ Клієнт</Link>
      </div>
      <div className="tabs">
        {FILTERS.map((x) => <Link key={x.k} href={`/clients?f=${x.k}${kind ? `&k=${kind}` : ""}`} className={x.k === f ? "on" : ""}>{x.label}{count(x.k) ? <b>{count(x.k)}</b> : null}</Link>)}
      </div>
      {hasPartners && (
        <div className="rd-areas">
          {KINDS.map((x) => <Link key={x.k} href={`/clients?f=${f}${x.k ? `&k=${x.k}` : ""}`} className={x.k === kind ? "on" : ""}>{x.label}</Link>)}
        </div>
      )}
      <div className="list">
        {clients.length ? clients.map((c) => {
          const flags = clientFlags(c);
          return (
            <Link key={c.id} href={`/clients/${c.id}`} className="row">
              <LogoMark kind="client" id={c.id} name={c.name} src={logos.get(c.id)} size={40} />
              <div className="row-main">
                <div className="row-title">{c.name}</div>
                <div className="row-sub">{[c.niche, c.offer].filter(Boolean).join(" · ")}</div>
                <div className="meta">
                  {c.kind === "partner" && <span className="tag accent">партнерство</span>}
                  {c.deleted_at && <span className="tag bad">у кошику</span>}
                  {(() => { const ns = mainMetricBrief(c.id); return ns ? <span className={`tag ${ns.tone}`} title={ns.title}>★ {ns.text}</span> : null; })()}
                  <span className={`tag ${STATUS_TAG[c.status]}`}>{STATUS_LABEL[c.status]}{c.status === "lead" ? ` · ${STAGE_LABEL[c.stage]}` : ""}</span>
                  {flags.map((fl) => <span key={fl.text} className={`tag ${fl.level}`} title={fl.reason}>{fl.text}</span>)}
                  {c.next_step && <span className="mono" style={{ color: "var(--link)" }}>→ {c.next_step}</span>}
                </div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <div className="mono" style={{ color: "var(--text)" }}>{c.revenue_model === "profit_share" ? `частка ${c.share_percent || "?"}%` : c.revenue_model === "mixed" ? `${c.fee_monthly ? `${money(c.fee_monthly)}/міс + ` : ""}${c.share_percent || "?"}%` : c.fee_monthly ? `${money(c.fee_monthly)}/міс` : "—"}</div>
                <div className="mono">{c.open_tasks} задач</div>
                <div className="mono">{c.last_work ? fmtDate(c.last_work) : "—"}</div>
              </div>
            </Link>
          );
        }) : <div className="empty">Порожньо.</div>}
      </div>
    </>
  );
}
