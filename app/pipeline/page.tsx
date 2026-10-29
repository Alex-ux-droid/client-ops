import Link from "next/link";
import { moveLead } from "@/app/actions";
import { money } from "@/lib/config";
import { STAGE_LABEL } from "@/lib/labels";
import { LEAD_STAGES, listClients } from "@/lib/repo/clients";

function Move({ id, to, label, cls = "ghost" }: { id: number; to: string; label: string; cls?: string }) {
  return (
    <form action={moveLead}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <button className={`${cls} small`}>{label}</button>
    </form>
  );
}

export default function PipelinePage() {
  const leads = listClients().filter((c) => c.status === "lead");
  const potential = leads.reduce((s, l) => s + l.fee_monthly, 0);
  return (
    <>
      <div className="head">
        <div><div className="kicker">{leads.length} у роботі · потенціал {money(potential)}/міс</div><h1>Воронка</h1></div>
        <Link href="/clients/new?lead=1" className="btn">+ Лід</Link>
      </div>
      <div className="kanban">
        {LEAD_STAGES.map((stage, si) => {
          const items = leads.filter((l) => l.stage === stage);
          return (
            <div key={stage} className="lane">
              <div className="lane-head"><span>{STAGE_LABEL[stage]}</span><span>{items.length}</span></div>
              {items.map((l) => (
                <div key={l.id} className="deal">
                  <Link href={`/clients/${l.id}`} className="row-title">{l.name}</Link>
                  <div className="row-sub">{[l.offer, l.fee_monthly ? `${money(l.fee_monthly)}/міс` : ""].filter(Boolean).join(" · ")}</div>
                  {l.next_step
                    ? <div className="mono" style={{ color: "var(--link)" }}>→ {l.next_step}</div>
                    : <div className="mono" style={{ color: "var(--warn)" }}>нема наступного кроку</div>}
                  <div className="deal-actions">
                    {si > 0 && <Move id={l.id} to={LEAD_STAGES[si - 1]} label="←" />}
                    {si < LEAD_STAGES.length - 1 && <Move id={l.id} to={LEAD_STAGES[si + 1]} label={`${STAGE_LABEL[LEAD_STAGES[si + 1]]} →`} />}
                    {si === LEAD_STAGES.length - 1 && <Move id={l.id} to="won" label="✓ Клієнт" cls="" />}
                    <Move id={l.id} to="lost" label="✕" />
                  </div>
                </div>
              ))}
              {!items.length && <div className="mono" style={{ color: "var(--dim)", padding: 4 }}>порожньо</div>}
            </div>
          );
        })}
      </div>
      <div className="mono" style={{ marginTop: 10 }}>«✓ Клієнт» робить його активним. «✕» відправляє в архів.</div>
    </>
  );
}
