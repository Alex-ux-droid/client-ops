import AskAssistant from "@/components/AskAssistant";
import Markdown from "@/components/Markdown";
import { PILLARS, type PillarKey, type Startup, type StartupItem } from "@/lib/repo/startups";
import { hasFinance } from "@/lib/startupFinance";
import { pillarSteps } from "@/lib/startupSystem";

export const stepsOf = (s: Startup, items: StartupItem[], p: PillarKey) =>
  pillarSteps(p, { idea: s.idea, mkt: s.mkt, items, spec: s.spec_md, financeSet: hasFinance(s.finance) });

// Смуга готовності опори: реальні кроки з галочками + «Джері, збудуй»
export function StepsBar({ s, items, p, ask }: { s: Startup; items: StartupItem[]; p: PillarKey; ask: string }) {
  const steps = stepsOf(s, items, p);
  const done = steps.filter((x) => x.done).length;
  return (
    <div className="card su-steps">
      <div className="su-steps-top">
        <div><b>{PILLARS.find((x) => x.k === p)!.label}: {done} з {steps.length}</b><span>{PILLARS.find((x) => x.k === p)!.hint}</span></div>
        <AskAssistant text={ask}>Джері, збудуй</AskAssistant>
      </div>
      <ol className="su-steps-list">{steps.map((x) => <li key={x.label} className={x.done ? "done" : ""}>{x.label}</li>)}</ol>
    </div>
  );
}

// Тексти зі старої версії (блоки) — щоб нічого не загубилось; Джері може перенести їх у нову структуру
export function OldNotes({ s, p }: { s: Startup; p: PillarKey }) {
  const blocks = PILLARS.find((x) => x.k === p)!.blocks.filter((b) => s.canvas[b.k as keyof Startup["canvas"]]?.trim());
  if (!blocks.length) return null;
  return (
    <details className="card su-old">
      <summary><b>Записи з попередньої версії</b> <span className="lab-muted">({blocks.length})</span></summary>
      <div className="stack" style={{ gap: "0.75rem", marginTop: "0.75rem" }}>
        {blocks.map((b) => <div key={b.k}><span className="lab-kicker">{b.label}</span><Markdown md={s.canvas[b.k as keyof Startup["canvas"]] ?? ""} /></div>)}
        <div><AskAssistant text={`Перенеси записи з попередньої версії опори «${PILLARS.find((x) => x.k === p)!.label}» цього стартапу в нову структуру (startup_item / startup_update), нічого не загубивши.`}>Джері, перенеси в нову структуру</AskAssistant></div>
      </div>
    </details>
  );
}
