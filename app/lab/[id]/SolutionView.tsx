import AskAssistant from "@/components/AskAssistant";
import Markdown from "@/components/Markdown";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { money } from "@/lib/config";
import { labFinance, PRODUCT_TYPES, stageGaps, type LabFull, type LabProduct, type LabStage } from "@/lib/repo/lab";
import { deleteProductAction, deleteStageAction, saveProductAction, saveStageAction } from "../actions";

// Режим «робота над рішенням»: тільки обране рішення — з чого складається, як робимо покроково, скільки коштує
export default function SolutionView({ l }: { l: LabFull }) {
  const hidden = <input type="hidden" name="id" value={l.id} />;
  const f = labFinance(l.products);
  const gaps = l.stages.map((s) => ({ s, g: stageGaps(s) }));
  const ready = gaps.filter((x) => !x.g.length).length;
  const m = (n: number | null) => (n == null ? "—" : money(n));
  return (
    <>
      {/* 1. Продукти */}
      <section id="products" className="lab-section">
        <div className="lab-section-head">
          <div><h2>Продукти рішення</h2><div className="lab-muted">З чого складається рішення для клієнта: ціна для нього і наша собівартість.</div></div>
          <AskAssistant text={`Лабораторія lab_id ${l.id}: розклади обране рішення на продукти (lab_product): кожна складова окремо (наша розробка, сторонні сервіси, підрядники) — що дає клієнту одним реченням, тип, ціна для клієнта (разово / щомісяця) і наша собівартість. Ціни — тільки ті, що відомі або я вписав; невідоме лиши порожнім і скажи, що уточнити.`}>Джері, розклади на продукти</AskAssistant>
        </div>
        {l.products.length ? (
          <div className="table-wrap card lp-wrap">
            <table className="fin-table lp-table">
              <thead><tr><th>Продукт</th><th>Тип</th><th>Клієнту разово</th><th>Клієнту / міс</th><th>Нам разово</th><th>Нам / міс</th><th /></tr></thead>
              <tbody>
                {l.products.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b>{p.about && <small>{p.about}</small>}</td>
                    <td>{PRODUCT_TYPES[p.ptype] ?? p.ptype}</td>
                    <td>{m(p.price_setup)}</td><td>{m(p.price_month)}</td><td className="lp-cost">{m(p.cost_setup)}</td><td className="lp-cost">{m(p.cost_month)}</td>
                    <td><details className="lab-edit lp-edit"><summary>Змінити</summary><ProductForm l={l} p={p} /></details></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td>Разом</td><td /><td>{money(f.clientSetup)}</td><td>{money(f.clientMonth)}</td><td className="lp-cost">{money(f.costSetup)}</td><td className="lp-cost">{money(f.costMonth)}</td><td /></tr></tfoot>
            </table>
          </div>
        ) : <div className="empty card">Ще нема — натисни «Джері, розклади на продукти» або додай сам.</div>}
        <details className="card"><summary><b>+ Продукт</b></summary><ProductForm l={l} /></details>
      </section>

      {/* 2. Покрокова структура */}
      <section id="stages" className="lab-section">
        <div className="lab-section-head">
          <div>
            <h2>Покрокова структура</h2>
            <div className="lab-muted">{l.stages.length ? <>Прописано <b>{ready} з {l.stages.length}</b> етапів (є кроки, результат і термін).</> : "Етапи впровадження: що робимо, по кроках, скільки часу і що клієнт має на виході."}</div>
          </div>
          <div className="inline" style={{ flexWrap: "wrap" }}>
            <AskAssistant text={`Лабораторія lab_id ${l.id}: склади покрокову структуру впровадження обраного рішення через lab_stage — етапи по порядку, у кожному: кроки (1. 2. 3., конкретні дії), результат для клієнта, термін, до якого продукту відноситься. Візьми за основу обраний сценарій, нічого не загуби.`}>Джері, склади етапи</AskAssistant>
            {l.stages.length > 0 && <AskAssistant text={`Лабораторія lab_id ${l.id}: перевір покрокову структуру — чи всі етапи прописані (конкретні кроки, результат, термін), чи нічого не пропущено між етапами (доступи, тестування, навчання, передача клієнту, супровід), чи логічний порядок. Допиши, що бракує, через lab_stage, і коротко скажи, що змінив.`}>Перевір, чи все прописано</AskAssistant>}
          </div>
        </div>
        {l.stages.length > 0 && <div className="tm-progress"><i style={{ width: `${(ready / l.stages.length) * 100}%` }} /></div>}
        <ol className="ls-list">
          {gaps.map(({ s, g }, i) => (
            <li key={s.id} id={`st-${s.id}`} className={`card ls-stage ${g.length ? "gap" : "ok"}`}>
              <div className="ls-head">
                <span className="tm-dot">{g.length ? i + 1 : "✓"}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <b>{s.title}</b>
                  <div className="ls-meta">
                    {s.duration && <span>⏱ {s.duration}</span>}
                    {s.product_id && <span>{l.products.find((p) => p.id === s.product_id)?.name}</span>}
                    {g.length > 0 && <span className="ls-gap">бракує: {g.join(", ")}</span>}
                  </div>
                </div>
              </div>
              {s.steps_md && <div className="tm-details"><Markdown md={s.steps_md} /></div>}
              {s.result && <div className="md-note"><p><b>Результат:</b> {s.result}</p></div>}
              <details className="lab-edit"><summary>Змінити етап</summary><StageForm l={l} s={s} /></details>
            </li>
          ))}
        </ol>
        <details className="card"><summary><b>+ Етап</b></summary><StageForm l={l} /></details>
      </section>

      {/* 3. Фінанси */}
      <section id="finance" className="lab-section">
        <div className="lab-section-head"><div><h2>Фінанси</h2><div className="lab-muted">Скільки це коштує клієнту і скільки лишається нам. Рахується з продуктів.</div></div></div>
        {l.products.length ? (
          <>
            <div className="fin-kpis">
              <div className="card fin-kpi"><span>Клієнт платить разово</span><b>{money(f.clientSetup)}</b><small>впровадження</small></div>
              <div className="card fin-kpi"><span>Клієнт платить щомісяця</span><b>{money(f.clientMonth)}</b><small>підтримка і сервіси</small></div>
              <div className="card fin-kpi"><span>Клієнту за перший рік</span><b>{money(f.clientYear)}</b><small>разово + 12 місяців</small></div>
              <div className={`card fin-kpi ${f.marginYear >= 0 ? "ok" : "bad"}`}><span>Нам лишається за рік</span><b>{money(f.marginYear)}</b><small>разово {money(f.marginSetup)} · щомісяця {money(f.marginMonth)}</small></div>
            </div>
            {(f.missingPrice.length > 0 || f.missingCost.length > 0) && (
              <div className="md-note">
                {f.missingPrice.length > 0 && <p>Нема ціни для клієнта: {f.missingPrice.join(", ")}.</p>}
                {f.missingCost.length > 0 && <p>Нема собівартості: {f.missingCost.join(", ")} — маржа неточна.</p>}
              </div>
            )}
          </>
        ) : <div className="empty card">Додай продукти з цінами — тут зʼявиться розрахунок для клієнта і наша маржа.</div>}
      </section>
    </>
  );

  function ProductForm({ p }: { l: LabFull; p?: LabProduct }) {
    return (
      <form action={saveProductAction} className="mk-form" style={{ marginTop: "0.75rem" }}>
        {hidden}{p && <input type="hidden" name="product_id" value={p.id} />}
        <input name="name" required defaultValue={p?.name} placeholder="Продукт: напр. «Telegram-бот лідів»" />
        <select name="ptype" defaultValue={p?.ptype ?? "ours"}>{Object.entries(PRODUCT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input name="about" defaultValue={p?.about} placeholder="Що дає клієнту — одним реченням" className="wide" />
        <input name="price_setup" inputMode="decimal" defaultValue={p?.price_setup ?? ""} placeholder="Клієнту разово" />
        <input name="price_month" inputMode="decimal" defaultValue={p?.price_month ?? ""} placeholder="Клієнту / міс" />
        <input name="cost_setup" inputMode="decimal" defaultValue={p?.cost_setup ?? ""} placeholder="Нам разово (собівартість)" />
        <input name="cost_month" inputMode="decimal" defaultValue={p?.cost_month ?? ""} placeholder="Нам / міс" />
        <input name="notes" defaultValue={p?.notes} placeholder="Нотатка" className="wide" />
        <div className="inline wide"><SubmitButton className="small">{p ? "Зберегти" : "Додати"}</SubmitButton>{p && <><span className="grow" /><button formAction={deleteProductAction} className="ghost small danger-text">Прибрати</button></>}</div>
      </form>
    );
  }
  function StageForm({ s }: { l: LabFull; s?: LabStage }) {
    return (
      <form action={saveStageAction} className="mk-form" style={{ marginTop: "0.75rem" }}>
        {hidden}{s && <input type="hidden" name="stage_id" value={s.id} />}
        <input name="title" required defaultValue={s?.title} placeholder="Етап: напр. «Бот і база лідів»" className="wide" />
        <div className="wide"><VoiceTextarea name="steps_md" defaultValue={s?.steps_md} placeholder={"1. Вебхук лід-форм Meta → бот\n2. Кнопки «Беру» / «Не додзвонився»\n3. Тестова заявка"} style={{ minHeight: "6rem" }} /></div>
        <input name="result" defaultValue={s?.result} placeholder="Результат для клієнта" className="wide" />
        <input name="duration" defaultValue={s?.duration} placeholder="Термін: 3 дні" />
        <select name="product_id" defaultValue={s?.product_id ?? ""}><option value="">— продукт —</option>{l.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <div className="inline wide"><SubmitButton className="small">{s ? "Зберегти" : "Додати"}</SubmitButton>{s && <><span className="grow" /><button formAction={deleteStageAction} className="ghost small danger-text">Прибрати</button></>}</div>
      </form>
    );
  }
}
