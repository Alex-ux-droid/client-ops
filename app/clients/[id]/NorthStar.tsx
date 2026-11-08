// Головна метрика клієнта на Огляді: значення, ціль, тренд 60 днів; у попапі — усі метрики і налаштування
import Pop from "@/components/Pop";
import Icon from "@/components/Icon";
import SubmitButton from "@/components/SubmitButton";
import { metricAddAction, metricEditAction } from "@/app/metrics/actions";
import { fmtMetric, listMetrics, METRIC_SOURCES, metricHistory, metricName, metricValue, type Metric } from "@/lib/repo/metrics";

function Spark({ pts, up }: { pts: number[]; up: boolean }) {
  if (pts.length < 2) return null;
  const w = 120, h = 28, min = Math.min(...pts), max = Math.max(...pts), k = max - min || 1;
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - 2 - ((v - min) / k) * (h - 4)}`).join(" ");
  const good = up ? pts.at(-1)! >= pts[0] : pts.at(-1)! <= pts[0];
  return <svg className="ns-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden><polyline points={d} fill="none" stroke={good ? "var(--ok)" : "var(--bad)"} strokeWidth="2" /></svg>;
}

const state = (m: Metric, v: number | null) => v == null || m.target == null ? "" : (m.direction === "up" ? v >= m.target : v <= m.target) ? "ok" : "bad";

export default function NorthStar({ clientId }: { clientId: number }) {
  const ms = listMetrics(clientId);
  const main = ms.find((m) => m.is_main) ?? null;
  const v = main ? metricValue(main) : null;
  const hist = main ? [...metricHistory(main.id).map((x) => x.value), ...(v != null ? [v] : [])] : [];
  const hid = <input type="hidden" name="client_id" value={clientId} />;
  return (
    <Pop className="pop-card ns-bar" wide title="Головна метрика клієнта" trigger={
      <>
        <span className="ns-ico"><Icon name="flag" size={15} /></span>
        {main ? <>
          <span className="ns-name">{metricName(main)}</span>
          <b className={`ns-val ${state(main, v)}`}>{fmtMetric(main, v)}</b>
          {main.target != null && <span className="ns-target">ціль {fmtMetric(main, main.target)}</span>}
          <Spark pts={hist} up={main.direction === "up"} />
        </> : <span className="ns-name">Головна метрика не обрана — що для цього клієнта означає успіх?</span>}
        <span className="qt-more">{ms.length > 1 ? `ще ${ms.length - 1} →` : "налаштувати →"}</span>
      </>
    }>
      <div className="stack" style={{ gap: "0.75rem" }}>
        {ms.map((m) => {
          const val = metricValue(m);
          return (
            <div key={m.id} className="card stack ns-item" style={{ gap: "0.5rem" }}>
              <div className="inline" style={{ flexWrap: "wrap" }}>
                <b>{metricName(m)}</b>{m.is_main ? <span className="tag accent">головна</span> : null}
                <span className="grow" />
                <b className={`ns-val ${state(m, val)}`}>{fmtMetric(m, val)}</b>
              </div>
              <form action={metricEditAction} className="inline" style={{ flexWrap: "wrap" }}>
                <input type="hidden" name="id" value={m.id} />
                <input name="name" defaultValue={m.name} placeholder={METRIC_SOURCES[m.source]?.label} aria-label="Назва" style={{ flex: "1 1 12rem" }} />
                <input name="target" defaultValue={m.target ?? ""} placeholder={m.direction === "up" ? "ціль: не менше" : "ціль: не більше"} inputMode="decimal" aria-label="Ціль" style={{ width: "9rem" }} />
                <SubmitButton className="ghost small">Зберегти</SubmitButton>
              </form>
              <div className="inline" style={{ flexWrap: "wrap" }}>
                {m.source === "manual" && (
                  <form action={metricEditAction} className="inline"><input type="hidden" name="id" value={m.id} /><input type="hidden" name="op" value="value" /><input name="value" placeholder="значення сьогодні" inputMode="decimal" aria-label="Значення" style={{ width: "10rem" }} /><button className="ghost small">Записати</button></form>
                )}
                {!m.is_main && <form action={metricEditAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="op" value="main" /><button className="ghost small">Зробити головною</button></form>}
                <form action={metricEditAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="op" value="delete" /><button className="ghost small danger-text">Прибрати</button></form>
              </div>
            </div>
          );
        })}
        <form action={metricAddAction} className="card stack" style={{ gap: "0.5rem" }}>
          {hid}
          <b>Додати метрику</b>
          <select name="source" aria-label="Звідки">{Object.entries(METRIC_SOURCES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select>
          <div className="inline" style={{ flexWrap: "wrap" }}>
            <input name="name" placeholder="своя назва (необовʼязково)" aria-label="Назва" style={{ flex: "1 1 12rem" }} />
            <input name="target" placeholder="ціль" inputMode="decimal" aria-label="Ціль" style={{ width: "7rem" }} />
            <select name="direction" aria-label="Що краще" defaultValue=""><option value="">як у джерела</option><option value="up">більше — краще</option><option value="down">менше — краще</option></select>
          </div>
          <label className="inline"><input type="checkbox" name="main" /> головна</label>
          <div><SubmitButton className="small">Додати</SubmitButton></div>
          <span className="mono">Значення з CRM і Meta система рахує сама і записує раз на день. Гірше за ціль або впала на третину за 2 тижні — бейдж у «Потребують уваги».</span>
        </form>
      </div>
    </Pop>
  );
}
