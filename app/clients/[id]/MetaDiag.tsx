// Діагностика «чому нема лідів»: кроки воронки кольором, де дірка, 3 дії (→ у Шлях стратегії)
import Pop from "@/components/Pop";
import { diagFacts, getDiag, type DiagStage } from "@/lib/metaDiagnose";
import { PATH_STAGES } from "@/lib/repo/strategyPath";
import DiagRun from "./DiagRun";
import { diagToPathAction } from "./diagActions";

const Pill = ({ s }: { s: DiagStage }) => <span className={`dg-pill ${s.status}`} title={s.finding}><b>{s.title}</b><span>{s.finding}</span></span>;

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
      {d && d.verdict && d.verdict.length <= 220 && <p className="dg-verdict">{d.verdict}</p>}
      {d && d.actions.length > 0 && (
        <ol className="dg-actions">
          {d.actions.map((a, i) => (
            <li key={i}>
              <div className="dg-a-h"><b>{a.title}</b><span className={`tag dg-st-${a.stage}`}>{PATH_STAGES[a.stage ?? "red"].label}</span></div>
              <span className="mono">{a.why}</span>
              <div className="inline" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                {a.how && <Pop className="pop-trigger pop-inline" title={a.title} trigger={<span className="h-link mono">як зробити →</span>}><p className="dg-how">{a.how}</p></Pop>}
                <form action={diagToPathAction}><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="i" value={i} /><button className="ghost small">→ у Шлях стратегії</button></form>
              </div>
            </li>
          ))}
        </ol>
      )}
      <Pop className="pop-trigger pop-inline" wide title="Факти, на яких розбір" trigger={<span className="h-link mono">факти, на яких розбір →</span>}>
        <pre className="dg-facts">{d?.facts || f.text}</pre>
      </Pop>
    </div>
  );
}
