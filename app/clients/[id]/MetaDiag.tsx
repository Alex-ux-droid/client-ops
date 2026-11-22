// Діагностика «чому нема лідів»: кроки воронки кольором, де дірка, 3 дії (→ у Шлях стратегії)
import Pop from "@/components/Pop";
import { diagFacts, getDiag, type DiagStage } from "@/lib/metaDiagnose";
import { PATH_STAGES } from "@/lib/repo/strategyPath";
import DiagRun from "./DiagRun";
import { diagToPathAction } from "./diagActions";

// Крок воронки: на екрані тільки назва кольором, пояснення — підказкою і в «деталях» (22.11: стіна тексту)
const Pill = ({ s }: { s: DiagStage }) => <span className={`dg-pill ${s.status}`} title={s.finding}><b>{s.title}</b></span>;

export default function MetaDiag({ clientId }: { clientId: number }) {
  const d = getDiag(clientId);
  const f = diagFacts(clientId);
  if (!f.hasData && !d) return null;
  const age = d ? Math.round((Date.now() - Date.parse(d.at)) / 3600_000) : null;
  return (
    <div className={`card stack dg${d && d.stages.some((s) => s.status === "bad") ? " dg-bad" : ""}`} style={{ gap: "0.75rem" }}>
      <div className="sd-head">
        <b>Діагностика: де губляться ліди</b>
        <span className="mono">{d ? `розбір ${age! < 1 ? "щойно" : age! < 48 ? `${age} год тому` : d.at.slice(0, 10)}` : "поки тільки правила — натисни, щоб Джері розібрав"}</span>
        <span className="grow" />
        <DiagRun clientId={clientId} label={d ? "Розібрати знову" : "Розібрати рекламу"} />
      </div>
      {d && <div className="dg-leak">{d.leak}</div>}
      <div className="dg-stages">{(d?.stages.length ? d.stages : f.stages).map((s) => <Pill key={s.key} s={s} />)}</div>

      {d && d.actions.length > 0 && (
        <ol className="dg-actions">
          {d.actions.map((a, i) => (
            <li key={i}>
              <div className="dg-a-h"><b>{a.title}</b><span className={`tag dg-st-${a.stage}`}>{PATH_STAGES[a.stage ?? "red"].label}</span></div>
              <div className="inline" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                <Pop className="pop-trigger pop-inline" title={a.title} trigger={<span className="h-link mono">чому і як</span>}><div className="stack" style={{ gap: "0.5rem" }}><p className="mono" style={{ margin: 0 }}>{a.why}</p>{a.how && <p className="dg-how">{a.how}</p>}</div></Pop>
                <form action={diagToPathAction}><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="i" value={i} /><button className="ghost small">→ у Шлях стратегії</button></form>
              </div>
            </li>
          ))}
        </ol>
      )}
      <Pop className="pop-trigger pop-inline" wide title="Деталі розбору" trigger={<span className="h-link mono">деталі по кроках і факти</span>}>
        <div className="stack" style={{ gap: "0.5rem" }}>
          {d?.verdict && <p style={{ margin: 0 }}>{d.verdict}</p>}
          {(d?.stages.length ? d.stages : f.stages).map((st) => <p key={st.key} className="mono" style={{ margin: 0 }}><b>{st.title}:</b> {st.finding}</p>)}
          <pre className="dg-facts">{d?.facts || f.text}</pre>
        </div>
      </Pop>
    </div>
  );
}
