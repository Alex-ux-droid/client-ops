"use client";
import { useMemo, useState } from "react";
import { calcFunnel, type Channel, type MktData } from "@/lib/startupSystem";
import { saveMktAction } from "../../actions";

// Воронка: етапи з % переходу + ціль клієнтів → скільки треба лідів, бюджету, яка ціна клієнта. Рахує вживу.
export default function FunnelCalc({ id, initial, channels, cur }: { id: number; initial: MktData; channels: Channel[]; cur: string }) {
  const [m, setM] = useState<MktData>(initial);
  const [dirty, setDirty] = useState(false);
  const r = useMemo(() => calcFunnel(m, channels), [m, channels]);
  const fmt = (n: number) => { const s = Math.round(n).toLocaleString("uk-UA"); return cur === "$" || cur === "€" ? `${cur}${s}` : `${s} ${cur}`; };
  const num = (v: string) => Math.max(0, Number(v.replace(",", ".")) || 0);
  const upd = (p: Partial<MktData>) => { setM((x) => ({ ...x, ...p })); setDirty(true); };
  const setStage = (i: number, k: "name" | "conv", v: string) => upd({ stages: m.stages.map((s, j) => (j === i ? { ...s, [k]: k === "conv" ? Math.min(100, num(v)) : v } : s)) });
  const fromChannels = r.plannedLeads > 0;
  const max = r.steps[0]?.count ?? 0;

  return (
    <form action={saveMktAction} className="card mk-funnel" id="funnel">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="stages" value={JSON.stringify(m.stages)} />
      <input type="hidden" name="target" value={m.target} />
      <input type="hidden" name="cpl" value={m.cpl} />
      <div className="mx-main-head"><b>Воронка: від ліда до оплати</b><span>{Math.round(r.conv * 1000) / 10}% лідів стають клієнтами</span></div>

      <div className="mk-funnel-grid">
        <div className="stack" style={{ gap: "0.5rem" }}>
          <div className="mk-stage head"><span>Крок</span><span>% з попереднього</span></div>
          <div className="mk-stage"><input value="Лід (заявка)" readOnly aria-label="Перший крок" /><span className="lab-muted">100%</span></div>
          {m.stages.map((s, i) => (
            <div key={i} className="mk-stage">
              <input value={s.name} onChange={(e) => setStage(i, "name", e.target.value)} aria-label="Назва кроку" />
              <div className="fin-input"><input inputMode="decimal" value={s.conv || ""} onChange={(e) => setStage(i, "conv", e.target.value)} aria-label="Конверсія, %" /><em>%</em></div>
              <button type="button" className="ghost small" onClick={() => upd({ stages: m.stages.filter((_, j) => j !== i) })} aria-label="Прибрати крок">✕</button>
            </div>
          ))}
          {m.stages.length < 8 && <button type="button" className="ghost small" style={{ alignSelf: "flex-start" }} onClick={() => upd({ stages: [...m.stages, { name: "Новий крок", conv: 50 }] })}>+ Крок</button>}
          <div className="fin-grid" style={{ marginTop: "0.5rem" }}>
            <label className="fin-field"><span>Ціль: клієнтів на місяць</span><div className="fin-input"><input inputMode="decimal" value={m.target || ""} placeholder="0" onChange={(e) => upd({ target: num(e.target.value) })} /><em>шт</em></div></label>
            <label className={`fin-field ${fromChannels ? "linked" : ""}`}>
              <span>Ціна ліда{fromChannels && <i className="fin-from">з каналів</i>}</span>
              <div className="fin-input"><input inputMode="decimal" readOnly={fromChannels} value={fromChannels ? Math.round(r.cpl * 100) / 100 : m.cpl || ""} placeholder="0" onChange={(e) => upd({ cpl: num(e.target.value) })} /><em>{cur}</em></div>
              <small>{fromChannels ? "середня по активних каналах з бюджетом" : "впиши або додай канали нижче"}</small>
            </label>
          </div>
        </div>

        <div className="mk-bars">
          {r.steps.map((s, i) => (
            <div key={i} className="mk-bar">
              <span>{s.name}</span>
              <div><i style={{ width: `${max ? Math.max(4, ((s.count ?? 0) / max) * 100) : 0}%` }} /><b>{s.count == null ? "—" : s.count < 10 ? Math.round(s.count * 10) / 10 : Math.round(s.count)}</b></div>
            </div>
          ))}
          <div className="mk-out">
            <div><span>Треба лідів</span><b>{r.leadsNeeded == null ? "—" : Math.ceil(r.leadsNeeded)}</b></div>
            <div><span>Бюджет реклами</span><b>{r.budgetNeeded == null ? "—" : fmt(r.budgetNeeded)}</b></div>
            <div><span>Ціна клієнта (CAC)</span><b>{r.cac == null ? "—" : fmt(r.cac)}</b></div>
            {fromChannels && <div><span>Канали зараз дають</span><b>{Math.round(r.plannedClients * 10) / 10} кл./міс</b><small>{Math.round(r.plannedLeads)} лідів за {fmt(r.plannedBudget)}</small></div>}
          </div>
        </div>
      </div>
      <div className="inline" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
        <button disabled={!dirty}>{dirty ? "Зберегти воронку" : "Збережено"}</button>
        <small style={{ color: "var(--dim)" }}>Ціль і бюджет можна підтягнути у Фінанси (тумблер «з маркетингу»).</small>
      </div>
    </form>
  );
}
