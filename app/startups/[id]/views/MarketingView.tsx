import AskAssistant from "@/components/AskAssistant";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { currency, money } from "@/lib/config";
import type { Startup, StartupItem } from "@/lib/repo/startups";
import { addItemAction, deleteItemAction, updateItemAction } from "../../actions";
import FunnelCalc from "./FunnelCalc";
import { OldNotes, StepsBar } from "./shared";

// Маркетинг як двигун: кому продаємо (сегменти з оффером) → що кажемо (кути, тестуємо) → де (канали з бюджетом і ціною ліда)
// → скільки треба (воронка рахує ліди, бюджет, ціну клієнта) → факт тестів замінює прогноз.
const ANGLE_ST = [
  { k: "idea", label: "Ідеї" }, { k: "testing", label: "Тестуємо" }, { k: "win", label: "Працює" }, { k: "lose", label: "Не зайшло" },
] as const;
const CH_ST = { plan: "план", active: "активний", stopped: "зупинено" } as Record<string, string>;
const FORMATS = ["Відео", "Картинка", "Карусель", "Текст", "Лендинг", "Холодний дзвінок", "Лист"];

export default function MarketingView({ s, items }: { s: Startup; items: StartupItem[] }) {
  const seg = items.filter((i) => i.kind === "segment");
  const angles = items.filter((i) => i.kind === "angle");
  const ch = items.filter((i) => i.kind === "channel");
  const H = ({ v }: { v?: string }) => <><input type="hidden" name="id" value={s.id} /><input type="hidden" name="v" value={v ?? "marketing"} /></>;
  const segName = (id: string) => seg.find((x) => String(x.id) === id)?.title;
  const channels = ch.map((c) => ({ budget: Number(c.data.budget) || 0, cpl: Number(c.data.cpl) || 0, active: c.status !== "stopped" }));
  const totalBudget = ch.filter((c) => c.status !== "stopped").reduce((a, c) => a + (Number(c.data.budget) || 0), 0);

  return (
    <div className="stack" style={{ gap: "1.75rem" }}>
      <StepsBar s={s} items={items} p="marketing" ask="Збудуй маркетинг цього стартапу як систему: 1–3 сегменти з болем їхніми словами і оффером (результат, термін, гарантія, ціна), 5–8 кутів для реклами під сегменти, канали з бюджетом і реалістичною ціною ліда, воронку з конверсіями і ціль клієнтів на місяць. Під мої навички (Meta-реклама, відділи продажу). Пиши через startup_item і startup_update (mkt)." />

      {/* 1. Сегменти + оффер */}
      <section className="stack" style={{ gap: "0.75rem" }}>
        <div className="su-sec-head"><h2>1. Кому продаємо і що пропонуємо</h2><span>сегмент = окремий оффер</span></div>
        <div className="mk-segs">
          {seg.map((x) => (
            <article key={x.id} id={`i-${x.id}`} className="card mk-seg">
              <div className="mk-seg-head"><b>{x.title}</b>{x.status === "main" && <span className="tag accent">головний</span>}</div>
              <div className="mk-seg-cols">
                <dl className="mk-dl">
                  <dt>Біль їхніми словами</dt><dd>{x.data.pain || <em>—</em>}</dd>
                  <dt>Де їх знайти</dt><dd>{x.data.where || <em>—</em>}</dd>
                  <dt>Що зупиняє купити</dt><dd>{x.data.objections || <em>—</em>}</dd>
                  <dt>Коли шукають рішення</dt><dd>{x.data.trigger || <em>—</em>}</dd>
                </dl>
                <div className="mk-offer">
                  <span className="lab-kicker">Оффер</span>
                  {x.data.offer_result ? (
                    <p className="mk-offer-text">
                      <b>{x.data.offer_result}</b>{x.data.offer_time && <> за {x.data.offer_time}</>}.
                      {x.data.offer_guarantee && <> {x.data.offer_guarantee}.</>}
                      {x.data.offer_price && <> <span className="mk-price">{x.data.offer_price}</span></>}
                    </p>
                  ) : <p className="lab-muted">Ще нема — що саме людина отримає, за скільки часу, яка гарантія, ціна.</p>}
                </div>
              </div>
              <details className="lab-edit">
                <summary>Змінити</summary>
                <form action={updateItemAction} className="mk-form" style={{ marginTop: "0.625rem" }}>
                  <input type="hidden" name="item_id" value={x.id} /><input type="hidden" name="v" value="marketing" />
                  <SegFields x={x} />
                  <div className="inline wide"><SubmitButton className="small" /><span className="grow" /><button formAction={deleteItemAction} className="ghost small danger-text">Прибрати сегмент</button></div>
                </form>
              </details>
            </article>
          ))}
        </div>
        <details className="card" open={!seg.length}>
          <summary><b>+ Сегмент</b></summary>
          <form action={addItemAction} className="mk-form" style={{ marginTop: "0.75rem" }}>
            <H /><input type="hidden" name="kind" value="segment" />
            <SegFields />
            <div className="wide"><button>Додати сегмент</button></div>
          </form>
        </details>
      </section>

      {/* 2. Кути */}
      <section className="stack" style={{ gap: "0.75rem" }}>
        <div className="su-sec-head"><h2>2. Що кажемо: кути і гачки</h2><span>кожен кут — тест; переможці йдуть у масштаб</span></div>
        <div className="su-board">
          {ANGLE_ST.map((g) => {
            const list = angles.filter((a) => (a.status || "idea") === g.k);
            return (
              <section key={g.k} className={`su-col s-${g.k}`}>
                <div className="su-col-head"><b>{g.label}</b><span>{list.length}</span></div>
                {list.map((a) => (
                  <article key={a.id} id={`i-${a.id}`} className="card mk-angle">
                    <b>«{a.title}»</b>
                    <div className="mk-angle-meta">{a.data.segment && segName(a.data.segment) && <span className="tag">{segName(a.data.segment)}</span>}{a.data.format && <span className="tag">{a.data.format}</span>}</div>
                    {a.data.result && <p className="su-exp-res"><span>Факт:</span> {a.data.result}</p>}
                    <details className="lab-edit">
                      <summary>Змінити</summary>
                      <form action={updateItemAction} className="stack" style={{ marginTop: "0.5rem" }}>
                        <input type="hidden" name="item_id" value={a.id} /><input type="hidden" name="v" value="marketing" />
                        <input name="title" defaultValue={a.title} />
                        <select name="status" defaultValue={a.status || "idea"}>{ANGLE_ST.map((x) => <option key={x.k} value={x.k}>{x.label}</option>)}</select>
                        <input name="d_result" defaultValue={a.data.result ?? ""} placeholder="Факт: CTR 2.1%, ліди по $6, 14 заявок" />
                        <div className="inline"><SubmitButton className="small" /><span className="grow" /><button formAction={deleteItemAction} className="ghost small danger-text">✕</button></div>
                      </form>
                    </details>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
        <form action={addItemAction} className="card mk-form">
          <H /><input type="hidden" name="kind" value="angle" /><input type="hidden" name="status" value="idea" />
          <input name="title" required placeholder="Гачок: «Шахматка в Excel коштує вам 2 продажі на місяць»" className="wide" />
          <select name="d_segment" defaultValue=""><option value="">— сегмент —</option>{seg.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
          <select name="d_format" defaultValue=""><option value="">— формат —</option>{FORMATS.map((f) => <option key={f}>{f}</option>)}</select>
          <div className="inline wide"><button className="ghost">Додати кут</button><span className="grow" /><AskAssistant text="Придумай 6 сильних кутів/гачків для реклами цього стартапу під його сегменти (біль, вигода, страх втрати, соцдоказ, провокація), з форматом. Запиши як angle.">Джері, накидай кутів</AskAssistant></div>
        </form>
      </section>

      {/* 3. Канали */}
      <section className="stack" style={{ gap: "0.75rem" }}>
        <div className="su-sec-head"><h2>3. Де: канали з бюджетом</h2><span>{totalBudget ? `разом ${money(totalBudget)}/міс` : "бюджет і очікувана ціна ліда"}</span></div>
        {ch.length > 0 && (
          <div className="card mk-ch-wrap">
            <table className="fin-table mk-ch">
              <thead><tr><th>Канал</th><th>Статус</th><th>Бюджет/міс</th><th>Ціна ліда (план)</th><th>Лідів (план)</th><th>Факт</th><th /></tr></thead>
              <tbody>
                {ch.map((c) => {
                  const b = Number(c.data.budget) || 0, cpl = Number(c.data.cpl) || 0;
                  return (
                    <tr key={c.id} id={`i-${c.id}`} className={c.status === "stopped" ? "off" : ""}>
                      <td>{c.title}</td><td>{CH_ST[c.status || "plan"]}</td><td>{b ? money(b) : "—"}</td><td>{cpl ? money(cpl) : "—"}</td>
                      <td>{b && cpl ? Math.round(b / cpl) : "—"}</td>
                      <td>{c.data.fact_cpl ? `${money(Number(c.data.fact_cpl))}/лід` : ""}{c.data.fact_leads ? ` · ${c.data.fact_leads} лідів` : ""}</td>
                      <td>
                        <details className="lab-edit mk-ch-edit">
                          <summary>Змінити</summary>
                          <form action={updateItemAction} className="mk-form">
                            <input type="hidden" name="item_id" value={c.id} /><input type="hidden" name="v" value="marketing" />
                            <ChFields c={c} />
                            <div className="inline wide"><SubmitButton className="small" /><span className="grow" /><button formAction={deleteItemAction} className="ghost small danger-text">Прибрати</button></div>
                          </form>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <details className="card" open={!ch.length}>
          <summary><b>+ Канал</b></summary>
          <form action={addItemAction} className="mk-form" style={{ marginTop: "0.75rem" }}>
            <H /><input type="hidden" name="kind" value="channel" />
            <ChFields />
            <div className="wide"><button>Додати канал</button></div>
          </form>
        </details>
      </section>

      {/* 4. Воронка */}
      <section className="stack" style={{ gap: "0.75rem" }}>
        <div className="su-sec-head"><h2>4. Скільки треба: воронка</h2><span>рахує назад від цілі</span></div>
        <FunnelCalc id={s.id} initial={s.mkt} channels={channels} cur={currency()} />
      </section>

      <OldNotes s={s} p="marketing" />
    </div>
  );
}

function SegFields({ x }: { x?: StartupItem }) {
  const d = x?.data ?? {};
  return (
    <>
      <input name="title" required defaultValue={x?.title} placeholder="Сегмент: «Відділ продажу забудовника, 50–300 квартир»" className="wide" />
      <div className="wide"><VoiceTextarea name="d_pain" defaultValue={d.pain} placeholder="Біль їхніми словами: «менеджери губляться в Excel, клієнт дзвонить — а квартира вже продана»" style={{ minHeight: "4rem" }} /></div>
      <input name="d_where" defaultValue={d.where} placeholder="Де їх знайти: Facebook, LinkedIn, виставки, чати забудовників" />
      <input name="d_trigger" defaultValue={d.trigger} placeholder="Коли шукають: старт продажів нового ЖК" />
      <input name="d_objections" defaultValue={d.objections} placeholder="Що зупиняє: «вже є Bitrix», «менеджери не будуть користуватись»" className="wide" />
      <span className="lab-kicker wide">Оффер</span>
      <input name="d_offer_result" defaultValue={d.offer_result} placeholder="Результат: «Усі квартири і ліди в одному місці»" />
      <input name="d_offer_time" defaultValue={d.offer_time} placeholder="Термін: «за 1 день»" />
      <input name="d_offer_guarantee" defaultValue={d.offer_guarantee} placeholder="Гарантія: «перший місяць безкоштовно»" />
      <input name="d_offer_price" defaultValue={d.offer_price} placeholder="Ціна: «$200/міс за обʼєкт»" />
      <select name="status" defaultValue={x?.status || ""}><option value="">звичайний</option><option value="main">головний сегмент</option></select>
    </>
  );
}

function ChFields({ c }: { c?: StartupItem }) {
  const d = c?.data ?? {};
  return (
    <>
      <input name="title" required defaultValue={c?.title} placeholder="Канал: Meta-реклама на власників бізнесу" className="wide" />
      <select name="status" defaultValue={c?.status || "plan"}>{Object.entries(CH_ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <input name="d_budget" inputMode="decimal" defaultValue={d.budget} placeholder="Бюджет на місяць" />
      <input name="d_cpl" inputMode="decimal" defaultValue={d.cpl} placeholder="Очікувана ціна ліда" />
      <input name="d_fact_cpl" inputMode="decimal" defaultValue={d.fact_cpl} placeholder="Факт: ціна ліда" />
      <input name="d_fact_leads" inputMode="decimal" defaultValue={d.fact_leads} placeholder="Факт: лідів" />
    </>
  );
}
