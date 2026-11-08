// Стратегія → Гіпотези: «Якщо …, то …», дія, метрика, очікування, дедлайн, статус, результат (+ у Висновки)
import SubmitButton from "@/components/SubmitButton";
import { fmtDate } from "@/lib/dates";
import { HYP_STATUS, listHypotheses, type Hypothesis } from "@/lib/repo/hypotheses";
import { listMetrics, metricName } from "@/lib/repo/metrics";
import { hypothesisAction } from "./actions";

export default function Hypotheses({ clientId }: { clientId: number }) {
  const hs = listHypotheses(clientId);
  const metrics = listMetrics(clientId);
  const today = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
  const hid = <input type="hidden" name="client_id" value={clientId} />;
  const card = (h: Hypothesis) => {
    const m = metrics.find((x) => x.id === h.metric_id);
    const open = h.status === "idea" || h.status === "running";
    const late = open && h.deadline && h.deadline < today;
    return (
      <div key={h.id} className={`card stack hy-card hy-${h.status}`} style={{ gap: "0.5rem" }}>
        <div className="inline" style={{ flexWrap: "wrap" }}>
          <span className={`tag ${h.status === "confirmed" ? "ok" : h.status === "rejected" ? "bad" : h.status === "running" ? "warn" : ""}`}>{HYP_STATUS[h.status]}</span>
          {h.deadline && <span className={`tag ${late ? "bad" : ""}`}>до {fmtDate(h.deadline)}</span>}
          {m && <span className="tag">★ {metricName(m)}</span>}
        </div>
        <b>{h.statement}</b>
        {h.action && <div><span className="mono">Робимо:</span> {h.action}</div>}
        {h.expected && <div><span className="mono">Очікуємо:</span> {h.expected}</div>}
        {h.result && <div><span className="mono">Результат:</span> {h.result}</div>}
        {open && (
          <div className="inline" style={{ flexWrap: "wrap" }}>
            {h.status === "idea" && <form action={hypothesisAction}>{hid}<input type="hidden" name="id" value={h.id} /><input type="hidden" name="op" value="status" /><input type="hidden" name="status" value="running" /><button className="ghost small">▶ Перевіряємо</button></form>}
            <details className="hy-close">
              <summary className="ghost small btn">Закрити з результатом</summary>
              <form action={hypothesisAction} className="stack" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>
                {hid}<input type="hidden" name="id" value={h.id} /><input type="hidden" name="op" value="status" />
                <textarea name="result" rows={2} placeholder="Що вийшло (цифри)" />
                <label className="inline mono rv-task"><input type="checkbox" name="to_insights" defaultChecked /> записати у «Висновки»</label>
                <div className="inline"><button name="status" value="confirmed" className="small">✅ Підтвердилась</button><button name="status" value="rejected" className="ghost small">❌ Не підтвердилась</button></div>
              </form>
            </details>
            <form action={hypothesisAction}>{hid}<input type="hidden" name="id" value={h.id} /><input type="hidden" name="op" value="delete" /><button className="ghost small danger-text">×</button></form>
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <form action={hypothesisAction} className="card stack" style={{ gap: "0.5rem" }}>
        {hid}
        <b>Нова гіпотеза</b>
        <input name="statement" required placeholder="Якщо … (що змінимо), то … (що станеться)" />
        <input name="action" placeholder="Що робимо, щоб перевірити" />
        <div className="hy-row">
          <select name="metric_id" defaultValue="" aria-label="Метрика"><option value="">— метрика —</option>{metrics.map((m) => <option key={m.id} value={m.id}>{metricName(m)}</option>)}</select>
          <input name="expected" placeholder="Очікуємо: напр. 40% → 70%" />
          <input name="deadline" type="date" aria-label="Дедлайн" />
        </div>
        <div><SubmitButton className="small">Додати</SubmitButton></div>
      </form>
      {hs.length ? <div className="hy-grid">{hs.map(card)}</div> : <p className="mono">Гіпотез ще нема. Одна гіпотеза = одна зміна + метрика + дата, коли дивимось результат.</p>}
    </div>
  );
}
