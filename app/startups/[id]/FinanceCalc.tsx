"use client";
import { useMemo, useState } from "react";
import { calcFinance, effectiveFinance, FIN_FIELDS, SCENARIOS, tiersPrice, type Finance, type FinLinks, type FinNumKey, type Tier } from "@/lib/startupFinance";
import { saveFinanceAction } from "../actions";

// Живий калькулятор окупності: міняєш цифру — одразу бачиш рік, окупність, скільки треба клієнтів. «Зберегти» — у базу.
// Звʼязки: нові клієнти і реклама — з воронки маркетингу, постійні витрати — з інфраструктури технічної опори.
export default function FinanceCalc({ id, initial, cur, links }: { id: number; initial: Finance; cur: string; links: FinLinks }) {
  const [raw, setF] = useState<Finance>(initial);
  const [dirty, setDirty] = useState(false);
  const f = useMemo(() => effectiveFinance(raw, links), [raw, links]);
  const r = useMemo(() => calcFinance(f), [f]);
  const scen = useMemo(() => SCENARIOS.map((x) => ({ ...x, r: calcFinance(x.apply(f)) })), [f]);
  const tp = tiersPrice(raw.tiers);
  const linked = (k: FinNumKey): string | null =>
    k === "price" && tp != null ? "з тарифів" :
    raw.link_mkt && ((k === "new_clients" && links.mktClients != null) || (k === "marketing" && links.mktBudget != null)) ? "з маркетингу" :
    null;
  const plusTech = raw.link_tech && links.techFixed != null ? links.techFixed : 0;
  const setTiers = (t: Tier[]) => { setF((x) => ({ ...x, tiers: t })); setDirty(true); };
  const toggle = (k: "link_mkt" | "link_tech") => { setF((x) => ({ ...x, [k]: !x[k] })); setDirty(true); };
  const fmt = (n: number) => {
    const v = Math.round(n);
    const s = Math.abs(v).toLocaleString("uk-UA");
    const m = v < 0 ? "−" : "";
    return cur === "$" || cur === "€" ? `${m}${cur}${s}` : `${m}${s} ${cur}`;
  };
  const set = (k: FinNumKey | "model", v: string) => { setF((x) => ({ ...x, [k]: k === "model" ? v : Math.max(0, Number(v.replace(",", ".")) || 0) })); setDirty(true); };
  const sub = f.model === "sub";
  const unit = sub ? "клієнтів" : "продажів/міс";
  const ready = f.price > 0;

  return (
    <form action={saveFinanceAction} className="fin" id="calc">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="f_model" value={raw.model} />
      {FIN_FIELDS.map((x) => <input key={x.k} type="hidden" name={`f_${x.k}`} value={raw[x.k]} />)}
      <input type="hidden" name="f_tiers" value={JSON.stringify(raw.tiers)} />
      <input type="hidden" name="f_link_mkt" value={raw.link_mkt ? "1" : "0"} />
      <input type="hidden" name="f_link_tech" value={raw.link_tech ? "1" : "0"} />

      <div className="card fin-inputs">
        <div className="fin-model">
          <button type="button" className={sub ? "on" : ""} onClick={() => set("model", "sub")}>Підписка щомісяця</button>
          <button type="button" className={!sub ? "on" : ""} onClick={() => set("model", "once")}>Разовий продаж</button>
        </div>
        <div className="fin-links">
          <label className={`fin-link ${raw.link_mkt ? "on" : ""}`}>
            <input type="checkbox" checked={raw.link_mkt} onChange={() => toggle("link_mkt")} />
            <span><b>Клієнти і реклама — з маркетингу</b><small>{links.mktClients != null ? `воронка: ${Math.round(links.mktClients * 10) / 10} клієнтів/міс за ${fmt(links.mktBudget ?? 0)}` : "у маркетингу ще нема цілі воронки"}</small></span>
          </label>
          <label className={`fin-link ${raw.link_tech ? "on" : ""}`}>
            <input type="checkbox" checked={raw.link_tech} onChange={() => toggle("link_tech")} />
            <span><b>Інфраструктура — з технічної</b><small>{links.techFixed != null ? `${fmt(links.techFixed)}/міс додається до інших постійних (люди, сервіси)` : "в інфраструктурі ще нема цін"}</small></span>
          </label>
        </div>
        <Tiers tiers={raw.tiers} set={setTiers} cur={cur} model={raw.model} />
        <div className="fin-grid">
          {FIN_FIELDS.filter((x) => !x.only || x.only === f.model).map((x) => (
            <label key={x.k} className={`fin-field ${linked(x.k) ? "linked" : ""}`}>
              <span>{x.k === "fixed" && plusTech ? "Інші постійні / міс" : x.label}{linked(x.k) && <i className="fin-from">{linked(x.k)}</i>}{x.k === "fixed" && plusTech > 0 && <i className="fin-from">+ {fmt(plusTech)} з технічної</i>}</span>
              <div className="fin-input">
                <input inputMode="decimal" value={linked(x.k) ? Math.round(f[x.k] * 10) / 10 : raw[x.k] || ""} placeholder="0" readOnly={!!linked(x.k)} onChange={(e) => set(x.k, e.target.value)} aria-label={x.label} />
                <em>{x.pct ? "%" : x.count ? "шт" : cur}</em>
              </div>
              <small>{x.hint}</small>
            </label>
          ))}
        </div>
        <div className="inline" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
          <button disabled={!dirty}>{dirty ? "Зберегти цифри" : "Збережено"}</button>
          <small style={{ color: "var(--dim)" }}>Рахує сам, поки вводиш. Валюта — як у системі ({cur}).</small>
        </div>
      </div>

      {ready ? (
        <>
          <div className="fin-kpis">
            <Kpi label="Прибуток за рік" value={fmt(r.year.profit)} tone={r.year.profit >= 0 ? "ok" : "bad"} sub={`виручка ${fmt(r.year.revenue)} · витрати ${fmt(r.year.costs)}`} />
            <Kpi label="Окупність" value={r.payback == null ? "> 3 років" : r.payback === 0 ? "без вкладень" : `${r.payback}-й міс`} tone={r.payback != null && r.payback <= 12 ? "ok" : "warn"} sub={f.invest ? `повертаємо ${fmt(f.invest)}` : "стартових вкладень нема"} />
            <Kpi label="Вихід у нуль" value={r.breakEven == null ? "ніколи" : `${Math.ceil(r.breakEven)} ${unit}`} tone={r.breakEven == null ? "bad" : undefined} sub={r.margin > 0 ? `з одного лишається ${fmt(r.margin)}` : "ціна ≤ витрат на клієнта"} />
            <Kpi label={f.goal ? `Щоб мати ${fmt(f.goal)}/міс` : "Ціль на місяць"} value={r.forGoal == null ? "—" : `${Math.ceil(r.forGoal)} ${unit}`} sub={f.goal ? "чистими, після всіх витрат" : "впиши «Хочу заробляти»"} />
            {sub && <Kpi label="Клієнтів на кінець року" value={String(Math.round(r.year.clients))} sub={`продано за рік ${Math.round(r.year.sales)}`} />}
            {r.cac != null && <Kpi label="Ціна клієнта (CAC)" value={fmt(r.cac)} sub="реклама ÷ нові клієнти" />}
            {r.ltv != null && <Kpi label="Клієнт за весь час (LTV)" value={fmt(r.ltv)} tone={r.cac && r.ltv / r.cac < 3 ? "warn" : "ok"} sub={r.cac ? `LTV/CAC = ${(r.ltv / r.cac).toFixed(1)} (норма від 3)` : `при відтоку ${f.churn}%`} />}
          </div>

          <div className="fin-scen">
            {scen.map((x) => (
              <div key={x.k} className={`card fin-scen-col s-${x.k}`}>
                <b>{x.label}</b><small>{x.hint}</small>
                <dl>
                  <dt>Прибуток за рік</dt><dd className={x.r.year.profit >= 0 ? "pos" : "neg"}>{fmt(x.r.year.profit)}</dd>
                  <dt>Окупність</dt><dd>{x.r.payback == null ? "> 3 р." : x.r.payback === 0 ? "—" : `${x.r.payback}-й міс`}</dd>
                  <dt>{sub ? "Клієнтів через рік" : "Продажів за рік"}</dt><dd>{Math.round(sub ? x.r.year.clients : x.r.year.sales)}</dd>
                </dl>
              </div>
            ))}
          </div>

          <div className="card stack">
            <div className="mx-main-head"><b>2 роки по місяцях</b><span className="fin-legend"><i className="pos" />прибуток місяця <i className="neg" />збиток <i className="cum" />накопичено</span></div>
            <FinChart months={r.months} fmt={fmt} />
          </div>

          <details className="card">
            <summary><b>Таблиця перших 12 місяців</b></summary>
            <div className="fin-table-wrap">
              <table className="fin-table">
                <thead><tr><th>Міс</th><th>Продажі</th>{sub && <th>Клієнтів</th>}<th>Виручка</th><th>Витрати</th><th>Прибуток</th><th>Накопичено</th></tr></thead>
                <tbody>
                  {r.months.slice(0, 12).map((m) => (
                    <tr key={m.m}>
                      <td>{m.m}</td><td>{m.sales.toFixed(m.sales < 10 ? 1 : 0)}</td>{sub && <td>{Math.round(m.clients)}</td>}
                      <td>{fmt(m.revenue)}</td><td>{fmt(m.costs)}</td>
                      <td className={m.profit < 0 ? "neg" : "pos"}>{fmt(m.profit)}</td>
                      <td className={m.cumulative < 0 ? "neg" : "pos"}>{fmt(m.cumulative)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : <div className="empty card">Впиши хоча б ціну — і калькулятор покаже рік, окупність і скільки треба продавати. Або попроси Джері порахувати.</div>}
    </form>
  );
}

// Тарифи: кілька пакетів з часткою продажів → середня ціна
function Tiers({ tiers, set, cur, model }: { tiers: Tier[]; set: (t: Tier[]) => void; cur: string; model: string }) {
  const upd = (i: number, k: keyof Tier, v: string) => set(tiers.map((t, j) => (j === i ? { ...t, [k]: k === "name" ? v : Math.max(0, Number(v.replace(",", ".")) || 0) } : t)));
  const total = tiers.reduce((a, t) => a + t.share, 0);
  return (
    <details className="fin-tiers" open={tiers.length > 0}>
      <summary><b>Тарифи</b> <span>{tiers.length ? `${tiers.length} · середня ціна рахується за часткою продажів` : "кілька пакетів замість однієї ціни"}</span></summary>
      {tiers.map((t, i) => (
        <div key={i} className="fin-tier">
          <input value={t.name} onChange={(e) => upd(i, "name", e.target.value)} placeholder="Назва: Старт" aria-label="Назва тарифу" />
          <div className="fin-input"><input inputMode="decimal" value={t.price || ""} onChange={(e) => upd(i, "price", e.target.value)} placeholder="Ціна" aria-label="Ціна тарифу" /><em>{cur}{model === "sub" ? "/міс" : ""}</em></div>
          <div className="fin-input"><input inputMode="decimal" value={t.share || ""} onChange={(e) => upd(i, "share", e.target.value)} placeholder="Частка" aria-label="Частка продажів" /><em>%</em></div>
          <button type="button" className="ghost small" onClick={() => set(tiers.filter((_, j) => j !== i))} aria-label="Прибрати тариф">✕</button>
        </div>
      ))}
      {tiers.length > 0 && total !== 100 && <small className="fin-warn">Частки разом {total}% — краще, щоб було 100%.</small>}
      {tiers.length < 6 && <button type="button" className="ghost small" onClick={() => set([...tiers, { name: ["Старт", "Бізнес", "Про"][tiers.length] ?? "", price: 0, share: 0 }])}>+ Тариф</button>}
    </details>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "bad" | "warn" }) {
  return (
    <div className={`card fin-kpi ${tone ?? ""}`}>
      <span>{label}</span>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

// Стовпчики — прибуток місяця (зелені/червоні від нуля), лінія — накопичено з урахуванням вкладень
function FinChart({ months, fmt }: { months: { m: number; profit: number; cumulative: number }[]; fmt: (n: number) => string }) {
  const W = 720, H = 220, P = { l: 64, r: 10, t: 12, b: 24 };
  const vals = months.flatMap((m) => [m.profit, m.cumulative, 0]);
  let max = Math.max(...vals), min = Math.min(...vals);
  if (max === min) { max += 1; min -= 1; }
  const pad = (max - min) * 0.08; max += pad; min -= pad;
  const ih = H - P.t - P.b, iw = W - P.l - P.r, step = iw / months.length;
  const y = (v: number) => P.t + ((max - v) / (max - min)) * ih;
  const x = (i: number) => P.l + step * i + step / 2;
  const line = months.map((m, i) => `${i ? "L" : "M"}${x(i)},${y(m.cumulative)}`).join(" ");
  const ticks = [max - pad, (max + min) / 2, min + pad];
  return (
    <svg className="chart fin-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Прибуток і накопичено по місяцях">
      {ticks.map((t, i) => (
        <g key={i}><line className="grid" x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} /><text x={P.l - 8} y={y(t) + 4} textAnchor="end">{fmt(t)}</text></g>
      ))}
      <line className="fin-zero" x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} />
      {months.map((m, i) => {
        const top = y(Math.max(0, m.profit)), h = Math.abs(y(m.profit) - y(0));
        return (
          <g key={m.m}>
            <rect className={m.profit >= 0 ? "fin-bar pos" : "fin-bar neg"} x={x(i) - step * 0.3} y={top} width={step * 0.6} height={Math.max(1, h)} rx={2}>
              <title>{`Місяць ${m.m}: прибуток ${fmt(m.profit)}, накопичено ${fmt(m.cumulative)}`}</title>
            </rect>
            {(i % 3 === 0 || i === months.length - 1) && <text x={x(i)} y={H - 6} textAnchor="middle">{m.m}</text>}
          </g>
        );
      })}
      <path className="fin-cum" d={line} />
      {months.map((m, i) => <circle key={m.m} className="fin-dot" cx={x(i)} cy={y(m.cumulative)} r={3}><title>{`Місяць ${m.m}: накопичено ${fmt(m.cumulative)}`}</title></circle>)}
    </svg>
  );
}
