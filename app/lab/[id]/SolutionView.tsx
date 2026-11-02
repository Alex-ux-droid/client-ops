import AskAssistant from "@/components/AskAssistant";
import Markdown from "@/components/Markdown";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { money } from "@/lib/config";
import { includesList, labFinance, listTemplates, packageCalc, PRODUCT_TYPES, stageGaps, type LabFull, type LabPackage, type LabProduct, type LabStage } from "@/lib/repo/lab";
import { addFromTemplateAction, choosePackageAction, deletePackageAction, deleteProductAction, deleteStageAction, deleteTemplateAction, productToTemplateAction, savePackageAction, saveProductAction, saveStageAction } from "../actions";

// Режим «робота над рішенням»: тільки обране рішення — з чого складається, як робимо покроково, скільки коштує
export default function SolutionView({ l }: { l: LabFull }) {
  const hidden = <input type="hidden" name="id" value={l.id} />;
  const f = labFinance(l.products);
  const gaps = l.stages.map((s) => ({ s, g: stageGaps(s) }));
  const ready = gaps.filter((x) => !x.g.length).length;
  const m = (n: number | null) => (n == null ? "—" : money(n));
  const tpls = listTemplates();
  const chosen = l.packages.find((pk) => pk.id === l.chosen_package_id) ?? null;
  const cc = chosen ? packageCalc(chosen, l.products) : null;
  // Рахунок: обраний пакет, а якщо пакетів нема — усі послуги
  const billItems = chosen ? cc!.items : l.products;
  const billSetup = chosen ? cc!.setup : f.clientSetup, billMonth = chosen ? cc!.month : f.clientMonth;
  return (
    <>
      {/* 1. Продукти */}
      <section id="products" className="lab-section">
        <div className="lab-section-head">
          <div><h2>Послуги і продукти</h2><div className="lab-muted">Що ми надаємо клієнту: кожна послуга — що в неї входить, ціна для клієнта, скільки це коштує на ринку і наша собівартість.</div></div>
          <AskAssistant text={`Лабораторія lab_id ${l.id}: розклади обране рішення на послуги (lab_product): кожна окремо (наша робота, сторонні сервіси, підрядники) — що дає клієнту одним реченням, includes (що конкретно входить, по рядку: напр. для ведення реклами — аналіз щотижня, заміна креативів, масштабування, звіт), тип, ціна для клієнта (разово / щомісяця), ринкова ціна (скільки таке коштує в агенції чи у фрилансерів — тільки якщо знаєш або я сказав) і наша собівартість. Невідомі ціни лиши порожніми і скажи, що уточнити.`}>Джері, розклади на послуги</AskAssistant>
        </div>
        {l.products.length ? (
          <div className="table-wrap card lp-wrap">
            <table className="fin-table lp-table">
              <thead><tr><th>Послуга</th><th>Тип</th><th>Клієнту разово</th><th>Клієнту / міс</th><th>На ринку / міс</th><th>Нам разово</th><th>Нам / міс</th><th /></tr></thead>
              <tbody>
                {l.products.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b>{p.about && <small>{p.about}</small>}{includesList(p.includes).length > 0 && <small className="lp-inc">✓ {includesList(p.includes).join(" · ")}</small>}</td>
                    <td>{PRODUCT_TYPES[p.ptype] ?? p.ptype}</td>
                    <td>{m(p.price_setup)}</td><td>{m(p.price_month)}</td><td className="lp-market">{m(p.market_month)}</td><td className="lp-cost">{m(p.cost_setup)}</td><td className="lp-cost">{m(p.cost_month)}</td>
                    <td><details className="lab-edit lp-edit"><summary>Змінити</summary><ProductForm l={l} p={p} /></details></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td>Разом</td><td /><td>{money(f.clientSetup)}</td><td>{money(f.clientMonth)}</td><td className="lp-market">{money(l.products.reduce((a, p) => a + (p.market_month ?? p.price_month ?? 0), 0))}</td><td className="lp-cost">{money(f.costSetup)}</td><td className="lp-cost">{money(f.costMonth)}</td><td /></tr></tfoot>
            </table>
          </div>
        ) : <div className="empty card">Ще нема — натисни «Джері, розклади на продукти» або додай сам.</div>}
        <div className="lp-add">
          <details className="card"><summary><b>+ Послуга</b></summary><ProductForm l={l} /></details>
          <details className="card">
            <summary><b>+ З моїх послуг</b> <span className="lab-muted">({tpls.length})</span></summary>
            {tpls.length ? (
              <form action={addFromTemplateAction} className="stack" style={{ gap: "0.5rem", marginTop: "0.75rem" }}>
                {hidden}
                {tpls.map((t) => (
                  <label key={t.id} className="lp-check lp-tpl">
                    <input type="checkbox" name="template_id" value={t.id} />
                    <span><b>{t.name}</b>{t.price_month != null && <> · {money(t.price_month)}/міс</>}{t.price_setup != null && <> · разово {money(t.price_setup)}</>}{t.about && <small>{t.about}</small>}</span>
                    <button formAction={deleteTemplateAction} name="del_template" value={t.id} className="tool-x" title="Видалити з моїх послуг" aria-label={`Видалити ${t.name}`}>×</button>
                  </label>
                ))}
                <div><SubmitButton className="small">Додати обрані</SubmitButton></div>
              </form>
            ) : <p className="lab-muted" style={{ marginTop: "0.5rem" }}>Поки порожньо. Відкрий будь-яку послугу → «Змінити» → «У мої послуги» — і вона буде тут для всіх наступних лабораторій (напр. «Ведення Meta-реклами» з усім, що входить).</p>}
          </details>
        </div>
      </section>

      {/* 1b. Пакети */}
      <section id="packages" className="lab-section">
        <div className="lab-section-head">
          <div><h2>Пакети</h2><div className="lab-muted">Збери послуги в 2–3 пакети (Базовий / Оптимальний / Преміум). Клієнт бачить, що входить, ціну і скільки це коштувало б окремо.</div></div>
          <AskAssistant text={`Лабораторія lab_id ${l.id}: збери з послуг 2–3 пакети через lab_package: Базовий (мінімум, щоб вирішити задачу), Оптимальний (рекомендуємо, highlight) і Преміум (максимум: супровід, пріоритет, розширена аналітика). Для кожного — коротка фраза «для кого» (tagline) і які послуги входять. Ціну пакета не вигадуй: або сума послуг, або знижка, яку я скажу. Потім коротко поясни логіку пакетів і чим продавати Оптимальний.`}>Джері, збери пакети</AskAssistant>
        </div>
        {l.packages.length ? (
          <div className="pk-grid">
            {l.packages.map((pk) => {
              const c = packageCalc(pk, l.products);
              const on = pk.id === l.chosen_package_id;
              return (
                <div key={pk.id} className={`card pk-card ${pk.highlight ? "hl" : ""} ${on ? "on" : ""}`}>
                  {pk.highlight ? <span className="pk-badge">Рекомендуємо</span> : null}
                  <h3>{pk.name}</h3>
                  {pk.tagline && <div className="lab-muted">{pk.tagline}</div>}
                  <div className="pk-price"><b>{money(c.month)}</b><span>/міс</span></div>
                  {c.setup > 0 && <div className="lab-muted">+ запуск {money(c.setup)} разово</div>}
                  <ul className="pk-list">
                    {c.items.map((p) => <li key={p.id}><b>{p.name}</b>{includesList(p.includes).length > 0 && <small>{includesList(p.includes).join(" · ")}</small>}</li>)}
                    {!c.items.length && <li className="lab-muted">послуги не обрані</li>}
                  </ul>
                  {c.hasMarket && c.saveYear > 0 && <div className="pk-save">Окремо на ринку ≈ {money(c.marketMonth)}/міс{c.marketSetup ? ` + ${money(c.marketSetup)}` : ""} — <b>економія {money(c.saveYear)} за рік</b></div>}
                  <div className="lp-cost pk-margin">нам лишається {money(c.marginMonth)}/міс · {money(c.marginYear)} за рік</div>
                  <form action={choosePackageAction}>{hidden}<input type="hidden" name="package_id" value={on ? "" : pk.id} /><button className={on ? "small" : "ghost small"}>{on ? "✓ У рахунку" : "Обрати для рахунку"}</button></form>
                  <details className="lab-edit"><summary>Змінити пакет</summary><PackageForm pk={pk} /></details>
                </div>
              );
            })}
          </div>
        ) : <div className="empty card">{l.products.length ? "Пакетів ще нема — «Джері, збери пакети» або зроби сам." : "Спершу додай послуги вище."}</div>}
        {l.products.length > 0 && <details className="card"><summary><b>+ Пакет</b></summary><PackageForm /></details>}
      </section>

      {/* 1c. Рахунок */}
      <section id="bill" className="lab-section">
        <div className="lab-section-head">
          <div><h2>Рахунок клієнту</h2><div className="lab-muted">{chosen ? <>Пакет <b>{chosen.name}</b>. Це піде в PDF пропозиції.</> : l.packages.length ? "Обери пакет кнопкою «Обрати для рахунку» — поки рахунок по всіх послугах." : "По всіх послугах. Зібрав пакети — обери один для рахунку."}</div></div>
          <a className="btn ghost small" href={`/api/lab/${l.id}/proposal`} target="_blank" rel="noreferrer">PDF пропозиції</a>
        </div>
        {billItems.length ? (
          <div className="table-wrap card lp-wrap">
            <table className="fin-table lp-table">
              <thead><tr><th>Послуга</th><th>Разово</th><th>Щомісяця</th></tr></thead>
              <tbody>{billItems.map((p) => <tr key={p.id}><td><b>{p.name}</b>{includesList(p.includes).length > 0 && <small className="lp-inc">{includesList(p.includes).join(" · ")}</small>}</td><td>{m(p.price_setup)}</td><td>{m(p.price_month)}</td></tr>)}</tbody>
              <tfoot>
                {chosen && (chosen.price_month != null || chosen.price_setup != null) && <tr><td>Ціна пакета</td><td>{money(billSetup)}</td><td>{money(billMonth)}</td></tr>}
                <tr><td>Перший платіж (запуск + перший місяць)</td><td colSpan={2}><b>{money(billSetup + billMonth)}</b></td></tr>
                <tr><td>Далі щомісяця</td><td colSpan={2}><b>{money(billMonth)}</b></td></tr>
              </tfoot>
            </table>
          </div>
        ) : <div className="empty card">Додай послуги з цінами.</div>}
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
        <div className="lab-section-head"><div><h2>Фінанси</h2><div className="lab-muted">Скільки це коштує клієнту і скільки лишається нам. {chosen ? <>Рахується з пакета <b>{chosen.name}</b>.</> : "Рахується з усіх послуг."}</div></div></div>
        {l.products.length ? (
          <>
            <div className="fin-kpis">
              <div className="card fin-kpi"><span>Клієнт платить разово</span><b>{money(billSetup)}</b><small>впровадження</small></div>
              <div className="card fin-kpi"><span>Клієнт платить щомісяця</span><b>{money(billMonth)}</b><small>підтримка і сервіси</small></div>
              <div className="card fin-kpi"><span>Клієнту за перший рік</span><b>{money(billSetup + billMonth * 12)}</b><small>разово + 12 місяців</small></div>
              <div className={`card fin-kpi ${(cc ? cc.marginYear : f.marginYear) >= 0 ? "ok" : "bad"}`}><span>Нам лишається за рік</span><b>{money(cc ? cc.marginYear : f.marginYear)}</b><small>щомісяця {money(cc ? cc.marginMonth : f.marginMonth)}</small></div>
              {cc?.hasMarket && cc.saveYear > 0 && <div className="card fin-kpi ok"><span>Клієнт економить за рік</span><b>{money(cc.saveYear)}</b><small>проти ринку ≈ {money(cc.marketYear)}</small></div>}
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
        <div className="wide"><VoiceTextarea name="includes" defaultValue={p?.includes} placeholder={"Що входить, по рядку:\nАналіз реклами щотижня\nЗаміна креативів\nМасштабування\nЗвіт раз на місяць"} style={{ minHeight: "5rem" }} /></div>
        <input name="market_setup" inputMode="decimal" defaultValue={p?.market_setup ?? ""} placeholder="На ринку разово (агенція)" />
        <input name="market_month" inputMode="decimal" defaultValue={p?.market_month ?? ""} placeholder="На ринку / міс" />
        <input name="notes" defaultValue={p?.notes} placeholder="Нотатка (тільки для тебе)" className="wide" />
        <div className="inline wide"><SubmitButton className="small">{p ? "Зберегти" : "Додати"}</SubmitButton>{p && <><button formAction={productToTemplateAction} className="ghost small" title="Зберегти в бібліотеку, щоб додавати в інші лабораторії">У мої послуги</button><span className="grow" /><button formAction={deleteProductAction} className="ghost small danger-text">Прибрати</button></>}</div>
      </form>
    );
  }
  function PackageForm({ pk }: { pk?: LabPackage }) {
    return (
      <form action={savePackageAction} className="mk-form" style={{ marginTop: "0.75rem" }}>
        {hidden}{pk && <input type="hidden" name="package_id" value={pk.id} />}
        <input name="name" required defaultValue={pk?.name} placeholder="Назва: Базовий / Оптимальний / Преміум" />
        <input name="tagline" defaultValue={pk?.tagline} placeholder="Для кого — одним реченням" />
        <div className="wide stack" style={{ gap: "0.375rem" }}>
          {l.products.map((p) => <label key={p.id} className="lp-check"><input type="checkbox" name="product_ids" value={p.id} defaultChecked={pk?.product_ids.includes(p.id)} /> {p.name}{p.price_month != null && <span className="lab-muted"> · {money(p.price_month)}/міс</span>}</label>)}
        </div>
        <input name="price_month" inputMode="decimal" defaultValue={pk?.price_month ?? ""} placeholder="Ціна / міс (порожньо — сума послуг)" />
        <input name="price_setup" inputMode="decimal" defaultValue={pk?.price_setup ?? ""} placeholder="Запуск разово (порожньо — сума)" />
        <label className="lp-check wide"><input type="checkbox" name="highlight" defaultChecked={!!pk?.highlight} /> Рекомендуємо (виділити)</label>
        <div className="inline wide"><SubmitButton className="small">{pk ? "Зберегти" : "Додати"}</SubmitButton>{pk && <><span className="grow" /><button formAction={deletePackageAction} className="ghost small danger-text">Прибрати</button></>}</div>
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
