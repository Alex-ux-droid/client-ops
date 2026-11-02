import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import SubmitButton from "@/components/SubmitButton";
import LabAssistant from "./LabAssistant";
import { money } from "@/lib/config";
import { fmtDate } from "@/lib/dates";
import { getClientRow, listClients } from "@/lib/repo/clients";
import { getLab, LAB_CATEGORIES } from "@/lib/repo/lab";
import { listServices, listTools } from "@/lib/repo/services";
import { SERVICES, type ToolCategory } from "@/lib/services";
import {
  addCriterionAction, addOptionAction, deleteCriterionAction, deleteLabAction, deleteOptionAction, finishLabAction,
  reopenLabAction, saveLabTextAction, saveMatrixAction, saveOptionAction,
} from "../actions";
import VoiceTextarea from "@/components/VoiceTextarea";
import { labToStartupAction } from "@/app/startups/actions";
import { startupForLab } from "@/lib/repo/startups";
import Markdown from "@/components/Markdown";
import AskAssistant from "@/components/AskAssistant";
import { getSetting } from "@/lib/repo/settings";
import { PROPOSAL } from "@/lib/repo/lab";
import PromptButton from "./PromptButton";
import SolutionView from "./SolutionView";
import { addScenarioAction, chooseScenarioAction, deleteScenarioAction, saveProposalAction, saveScenarioAction, setModeAction } from "../actions";

export const dynamic = "force-dynamic";

const WEIGHTS = [{ v: 1, l: "×1 неважливо" }, { v: 2, l: "×2 важливо" }, { v: 3, l: "×3 критично" }];
const HAS_SERVICE = ["crm", "telephony", "site"];

export default async function LabSessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sc?: string }> }) {
  const id = Number((await params).id);
  const scParam = Number((await searchParams).sc);
  const l = getLab(id);
  if (!l) notFound();
  const client = l.client_id ? getClientRow(l.client_id) : undefined;
  const services = client ? listServices(client.id) : [];
  const cat = LAB_CATEGORIES[l.category] ?? LAB_CATEGORIES.other;
  const tools = cat.tool ? listTools(cat.tool as ToolCategory) : [];
  const ranked = l.options.filter((o) => o.total != null).sort((a, b) => b.total! - a.total!);
  const leader = ranked[0];
  const done = l.status === "done";
  const hidden = <input type="hidden" name="id" value={id} />;
  const startup = startupForLab(id);

  const chosenSc = l.scenarios.find((x) => x.id === l.chosen_scenario_id);
  const chooseBlocks = (
    <>
      <section id="options" className="lab-section">
        <div className="lab-section-head">
          <div>
            <h2>Варіанти</h2>
            <div className="lab-muted">Що порівнюємо. {leader ? <>Зараз попереду <b>{leader.name}</b> — {leader.total}%.</> : "Оціни їх у «Порівнянні» нижче — система порахує, хто попереду."}</div>
          </div>
        </div>
        {l.options.length === 0 && <div className="empty card">Попроси Джері підібрати 2–4 варіанти (готові сервіси і своє рішення) або додай сам нижче.</div>}
        <div className="lab-options">
          {l.options.map((o) => {
            const lines = (t: string) => t.split(/\n|;\s*/).map((x) => x.replace(/^[-•+–]\s*/, "").trim()).filter(Boolean);
            const lead = leader?.id === o.id;
            return (
              <article key={o.id} id={`opt-${o.id}`} className={`card lab-opt ${lead ? "lead" : ""}`}>
                <div className="lab-opt-head">
                  <h3>{o.name}</h3>
                  {o.total != null && <span className={`lab-score ${lead ? "lead" : ""}`}>{o.total}%{lead ? " · лідер" : ""}</span>}
                </div>
                {o.about ? <p className="lab-about">{o.about}</p> : <p className="lab-about lab-muted">Що це — ще не описано. Попроси Джері: «опиши варіанти простими словами».</p>}
                <div className="lab-price">
                  <span><b>{o.price_month != null ? money(o.price_month) : "—"}</b> на місяць</span>
                  <span><b>{o.price_setup != null ? money(o.price_setup) : "—"}</b> впровадження</span>
                </div>
                {(o.pros || o.cons) && (
                  <div className="lab-pc">
                    {o.pros && <ul className="pros">{lines(o.pros).map((x) => <li key={x}>{x}</li>)}</ul>}
                    {o.cons && <ul className="cons">{lines(o.cons).map((x) => <li key={x}>{x}</li>)}</ul>}
                  </div>
                )}
                {o.notes && <p className="lab-note"><b>На тесті:</b> {o.notes}</p>}
                <div className="lab-opt-foot">
                  {o.link && <a href={o.link} target="_blank" rel="noreferrer" className="btn ghost small">Сайт ↗</a>}
                  <details className="lab-edit">
                    <summary>Редагувати</summary>
                    <form action={saveOptionAction} className="stack" style={{ marginTop: "0.75rem" }}>
                      {hidden}
                      <input type="hidden" name="option_id" value={o.id} />
                      <div className="field"><label>Назва</label><input name="name" defaultValue={o.name} /></div>
                      <div className="field"><label>Що це (простими словами)</label><input name="about" defaultValue={o.about} placeholder="Напр.: готова CRM з телефонією, популярна в Україні" /></div>
                      <div className="form-grid">
                        <div className="field"><label>Ціна / міс</label><input name="price_month" inputMode="decimal" defaultValue={o.price_month ?? ""} placeholder="0" /></div>
                        <div className="field"><label>Впровадження</label><input name="price_setup" inputMode="decimal" defaultValue={o.price_setup ?? ""} placeholder="0" /></div>
                      </div>
                      <div className="field"><label>Посилання</label><input name="link" inputMode="url" autoCapitalize="off" defaultValue={o.link} placeholder="сайт сервісу або демо" /></div>
                      <div className="field"><label>Плюси (кожен з нового рядка)</label><VoiceTextarea name="pros" defaultValue={o.pros} /></div>
                      <div className="field"><label>Мінуси (кожен з нового рядка)</label><VoiceTextarea name="cons" defaultValue={o.cons} /></div>
                      <div className="field"><label>Що побачили на тесті</label><VoiceTextarea name="notes" defaultValue={o.notes} /></div>
                      <div className="inline">
                        <SubmitButton className="small" />
                        <span className="grow" />
                        <button formAction={deleteOptionAction} className="ghost small danger-text">Прибрати варіант</button>
                      </div>
                    </form>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
        <form action={addOptionAction} className="inline lab-add" style={{ marginTop: "0.75rem" }}>
          {hidden}
          {tools.length > 0 && (
            <select name="tool_id" defaultValue="" aria-label="З довідника">
              <option value="">з довідника…</option>
              {tools.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <input name="name" placeholder={l.category === "crm" ? "Додати варіант: напр. «Своя CRM на вайбкоді»" : "Додати свій варіант"} />
          <button className="ghost">Додати</button>
        </form>
      </section>

      <section id="matrix" className="lab-section">
        <div className="lab-section-head">
          <div>
            <h2>Порівняння</h2>
            <div className="lab-muted">Кожен варіант оцінений від 1 до 5 за важливими для тебе речами. «Разом» — підсумок з урахуванням ваги: що критичне, рахується втричі сильніше.</div>
          </div>
        </div>
        {l.criteria.length === 0 || l.options.length === 0 ? (
          <div className="empty card">Ще нема з чим порівнювати — попроси Джері запропонувати критерії і оцінки.</div>
        ) : (
          <div className="table-wrap">
            <table className="lab-cmp">
              <thead>
                <tr>
                  <th>Що важливо</th>
                  {l.options.map((o) => <th key={o.id} className={leader?.id === o.id ? "lead" : ""}>{o.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {l.criteria.map((c) => (
                  <tr key={c.id}>
                    <td><div className="lab-crit">{c.name}</div><span className={`lab-w w${c.weight}`}>{["", "неважливо", "важливо", "критично"][c.weight] ?? ""}</span></td>
                    {l.options.map((o) => {
                      const v = o.scores[c.id];
                      return (
                        <td key={o.id}>
                          {v ? <span className={`lab-dots s${v}`} title={`${v} з 5`}>{[1, 2, 3, 4, 5].map((d) => <i key={d} className={d <= v ? "on" : ""} />)}<em>{v}</em></span> : <span className="lab-muted">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="lab-total">
                  <td>Разом</td>
                  {l.options.map((o) => (
                    <td key={o.id} className={leader?.id === o.id ? "lead" : ""}>
                      {o.total != null ? <><b>{o.total}%</b><span className="lab-bar"><i style={{ width: `${o.total}%` }} /></span></> : "—"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <details className="lab-edit" style={{ marginTop: "0.75rem" }}>
          <summary>Змінити оцінки і критерії</summary>
          <form action={saveMatrixAction} className="stack" style={{ marginTop: "0.75rem" }}>
            {hidden}
            <div className="table-wrap">
              <table className="lab-matrix">
                <thead>
                  <tr>
                    <th>Критерій</th>
                    <th>Вага</th>
                    {l.options.map((o) => <th key={o.id}>{o.name}</th>)}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {l.criteria.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>
                        <select name={`w_${c.id}`} defaultValue={c.weight} className="score" aria-label="Вага">
                          {WEIGHTS.map((w) => <option key={w.v} value={w.v}>{w.l}</option>)}
                        </select>
                      </td>
                      {l.options.map((o) => (
                        <td key={o.id}>
                          <select name={`s_${o.id}_${c.id}`} defaultValue={o.scores[c.id] ?? ""} className="score" aria-label={`${o.name}: ${c.name}`}>
                            <option value="">—</option>
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                      ))}
                      <td><button form={`del-crit-${c.id}`} className="ghost small" title="Прибрати критерій">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div><SubmitButton>Зберегти оцінки</SubmitButton></div>
          </form>
          {/* Окремі форми для «✕» (вкладені форми в HTML не можна) */}
          {l.criteria.map((c) => (
            <form key={c.id} id={`del-crit-${c.id}`} action={deleteCriterionAction} hidden>
              {hidden}
              <input type="hidden" name="criterion_id" value={c.id} />
            </form>
          ))}
          <form action={addCriterionAction} className="inline lab-add" style={{ marginTop: "0.75rem" }}>
            {hidden}
            <input name="name" placeholder="Новий критерій: напр. «Інтеграція з Monobank»" />
            <select name="weight" defaultValue="2" aria-label="Вага">
              {WEIGHTS.map((w) => <option key={w.v} value={w.v}>{w.l}</option>)}
            </select>
            <button className="ghost">Додати</button>
          </form>
        </details>
      </section>

      {/* Сценарії: покрокові варіанти рішення, вкладками */}
      <section id="scenarios" className="lab-section">
        <div className="lab-section-head">
          <div>
            <h2>Сценарії</h2>
            <div className="lab-muted">Покрокові варіанти рішення з термінами і ціною. Обраний іде в пропозицію клієнту.</div>
          </div>
          <div className="inline" style={{ flexWrap: "wrap" }}>
            <AskAssistant text={`Лабораторія lab_id ${id}: склади 3 повні сценарії рішення (швидкий старт / оптимальний / максимальний) через lab_scenario — для кожного: назва, суть 1–2 речення, кроки по порядку (markdown, 1. 2. 3.), терміни, ціна впровадження і на місяць (якщо не знаєш — лиши порожнім, не вигадуй), плюси і мінуси. Якщо в «Штурмі» вже є сценарії — перенеси їх звідти, нічого не загубивши.`}>Джері, склади сценарії</AskAssistant>
            {l.scenarios.length > 0 && <PromptButton labId={id} kind="scenarios" label="Промпт сценаріїв" />}
          </div>
        </div>
        {(() => {
          const cur = l.scenarios.find((x) => x.id === scParam) ?? l.scenarios.find((x) => x.id === l.chosen_scenario_id) ?? l.scenarios[0];
          return (
            <>
              {l.scenarios.length > 0 && (
                <nav className="sc-tabs">
                  {l.scenarios.map((x, i) => (
                    <Link key={x.id} href={`/lab/${id}?sc=${x.id}#scenarios`} scroll={false} className={cur?.id === x.id ? "on" : ""}>
                      {i + 1}. {x.title}{l.chosen_scenario_id === x.id && <span className="tag ok">обрано</span>}
                    </Link>
                  ))}
                </nav>
              )}
              {cur ? (
                <article className={`card sc-card ${l.chosen_scenario_id === cur.id ? "chosen" : ""}`}>
                  <div className="sc-top">
                    <div style={{ minWidth: 0 }}><h3>{cur.title}</h3>{cur.summary && <p className="sc-sum">{cur.summary}</p>}</div>
                    <form action={chooseScenarioAction}>{hidden}<input type="hidden" name="scenario_id" value={l.chosen_scenario_id === cur.id ? "" : cur.id} />
                      <button className={l.chosen_scenario_id === cur.id ? "ghost small" : "small"}>{l.chosen_scenario_id === cur.id ? "Скасувати вибір" : "Обрати для пропозиції"}</button>
                    </form>
                  </div>
                  <div className="sc-facts">
                    {cur.timeline && <span>Терміни: <b>{cur.timeline}</b></span>}
                    <span>Впровадження: <b>{cur.price_setup != null ? money(cur.price_setup) : "—"}</b></span>
                    <span>На місяць: <b>{cur.price_month != null ? money(cur.price_month) : "—"}</b></span>
                  </div>
                  {cur.steps_md && <div className="tm-details"><Markdown md={cur.steps_md} /></div>}
                  {(cur.pros || cur.cons) && (
                    <div className="lab-pc">
                      {cur.pros && <ul className="pros">{cur.pros.split(/\n+/).filter(Boolean).map((x) => <li key={x}>{x.replace(/^[-•+]\s*/, "")}</li>)}</ul>}
                      {cur.cons && <ul className="cons">{cur.cons.split(/\n+/).filter(Boolean).map((x) => <li key={x}>{x.replace(/^[-•+]\s*/, "")}</li>)}</ul>}
                    </div>
                  )}
                  <details className="lab-edit">
                    <summary>Редагувати сценарій</summary>
                    <form action={saveScenarioAction} className="stack" style={{ marginTop: "0.75rem" }}>
                      {hidden}<input type="hidden" name="scenario_id" value={cur.id} />
                      <ScenarioFields s={cur} />
                      <div className="inline"><SubmitButton className="small" /><span className="grow" /><button formAction={deleteScenarioAction} className="ghost small danger-text">Прибрати сценарій</button></div>
                    </form>
                  </details>
                </article>
              ) : <div className="empty card">Сценаріїв ще нема. Натисни «Джері, склади сценарії» — або додай свій нижче.</div>}
              <details className="card">
                <summary><b>+ Сценарій</b></summary>
                <form action={addScenarioAction} className="stack" style={{ marginTop: "0.75rem" }}>
                  {hidden}
                  <ScenarioFields />
                  <div><SubmitButton className="small">Додати</SubmitButton></div>
                </form>
              </details>
            </>
          );
        })()}
      </section>

    </>
  );

  return (
    <div className="lab">
      <div className="head">
        <div style={{ minWidth: 0 }}>
          <Link href="/lab" className="h-link">Лабораторія</Link>
          <h1>{l.title}</h1>
          <div className="meta">
            {l.category !== "other" && <span className="tag accent">{cat.label}</span>}
            {client && <Link href={`/clients/${client.id}`} className="tag">{client.name}</Link>}
            <span className={`tag ${done ? "ok" : "warn"}`}>{done ? `Завершено ${fmtDate(l.done_at)}` : "В роботі"}</span>
          </div>
        </div>
        <div className="inline" style={{ flexWrap: "wrap" }}>
          <PromptButton labId={id} />
          {startup
            ? <Link href={`/startups/${startup.id}`} className="btn ghost">Стартап: {startup.name} →</Link>
            : <form action={labToStartupAction}><input type="hidden" name="lab_id" value={id} /><SubmitButton className="ghost" pendingText="Переношу…">Будуємо самі → у Стартапи</SubmitButton></form>}
          {done && <form action={reopenLabAction}>{hidden}<button className="ghost">Відкрити знову</button></form>}
        </div>
      </div>

      <Suspense><LabAssistant id={id} /></Suspense>

      {/* Що вирішуємо — текст як є; клієнт — одним рядком */}
      <section className="card lab-brief">
        <div className="lab-brief-head">
          <span className="lab-kicker">Що вирішуємо</span>
          {client
            ? <span className="lab-client">для <Link href={`/clients/${client.id}`}>{client.name}</Link>{services.length ? ` · вже є: ${services.map((s) => `${SERVICES[s.type].short}${s.tool_name ? ` ${s.tool_name}` : ""}`).join(", ")}` : ""}</span>
            : <span className="lab-client">без клієнта</span>}
        </div>
        {l.brief ? <div className="lab-brief-text"><Markdown md={l.brief} /></div> : <p className="lab-muted">Опиши задачу — Джері підбере варіанти.</p>}
        <details className="lab-edit">
          <summary>Змінити задачу або клієнта</summary>
          <form action={saveLabTextAction} className="stack" style={{ marginTop: "0.75rem" }}>
            {hidden}
            <VoiceTextarea name="brief" defaultValue={l.brief} placeholder="Задачі, скільки людей, звідки ліди, бюджет, обмеження, що вже пробували" style={{ minHeight: "8rem" }} />
            <div className="inline" style={{ flexWrap: "wrap" }}>
              <select name="client_id" defaultValue={l.client_id ?? ""} aria-label="Клієнт" style={{ maxWidth: "18rem" }}>
                <option value="">— без клієнта —</option>
                {listClients().filter((c) => c.status !== "archived" || c.id === l.client_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <SubmitButton className="ghost">Зберегти</SubmitButton>
            </div>
          </form>
        </details>
      </section>

      {/* Режим: вибір рішення → робота над обраним */}
      {l.mode === "solution" ? (
        <div className="lab-mode">
          <div><b>Працюємо над рішенням: {chosenSc?.title ?? "обране рішення"}</b><br /><span>Уся сесія — про нього: продукти, етапи, фінанси, пропозиція. Як обирали — згорнуто нижче.</span></div>
          <form action={setModeAction}>{hidden}<input type="hidden" name="mode" value="choose" /><button className="ghost small">← Повернутись до вибору</button></form>
        </div>
      ) : chosenSc ? (
        <div className="lab-mode choose">
          <div><b>Обрано: {chosenSc.title}</b><br /><span>Перейди в роботу над рішенням — сесія перебудується під нього: продукти, покрокова структура, фінанси.</span></div>
          <form action={setModeAction}>{hidden}<input type="hidden" name="mode" value="solution" /><SubmitButton>Працюємо над рішенням →</SubmitButton></form>
        </div>
      ) : null}

      {l.mode === "solution" ? (
        <>
          <SolutionView l={l} />
          <details className="card lab-how"><summary><b>Як обирали</b> <span className="lab-muted">— варіанти, порівняння, сценарії</span></summary>{chooseBlocks}</details>
        </>
      ) : chooseBlocks}

      {/* Пропозиція клієнту: 5 розділів → PDF A4 */}
      <section id="proposal" className="lab-section">
        <div className="lab-section-head">
          <div>
            <h2>Пропозиція клієнту</h2>
            <div className="lab-muted">Документ A4 для клієнта: проблема → чому це болить саме їм → що дамо → ціна і підтримка → бонуси на підтримці.</div>
          </div>
          <div className="inline" style={{ flexWrap: "wrap" }}>
            <AskAssistant text={`Лабораторія lab_id ${id}: склади пропозицію клієнту через lab_proposal (title, subtitle, problem, why, offer, price, bonuses). Основа — ${l.chosen_scenario_id ? "обраний сценарій" : "найкращий сценарій (або варіант-лідер)"}, задача клієнта і порівняння. Пиши для власника бізнесу: просто, вигоди замість техніки, конкретно про його бізнес. «Що ми дамо» і «Бонуси» — списками. Ціни — тільки ті, що є в даних або які я вписав; інакше [уточнити]. Не вигадуй цифр.`}>Джері, склади пропозицію</AskAssistant>
            <a href={`/api/lab/${id}/proposal`} target="_blank" rel="noreferrer" className="btn ghost small">PDF A4</a>
            <a href={`/api/lab/${id}/proposal?format=md`} className="btn ghost small">.md</a>
            <PromptButton labId={id} kind="proposal" label="Промпт презентації" />
          </div>
        </div>
        <form action={saveProposalAction} className="card pp-grid">
          {hidden}
          <div className="form-grid">
            <div className="field"><label>Заголовок</label><input name="p_title" defaultValue={l.proposal.title ?? ""} placeholder={`Пропозиція для ${l.client_name ?? "клієнта"}`} /></div>
            <div className="field"><label>Підзаголовок</label><input name="p_subtitle" defaultValue={l.proposal.subtitle ?? ""} placeholder="Напр.: CRM і телефонія для відділу продажу за 2 тижні" /></div>
            <div className="field"><label>Від кого (над заголовком у PDF)</label><input name="from" defaultValue={getSetting("proposal.from") ?? ""} placeholder="Олександр Бенца · alexbentsa.com" /></div>
          </div>
          {PROPOSAL.map((x, i) => (
            <div key={x.k} className="pp-sec">
              <span className="pp-n">{i + 1}</span>
              <div>
                <label htmlFor={`p_${x.k}`}>{x.label}</label>
                <small>{x.q}</small>
                <VoiceTextarea id={`p_${x.k}`} name={`p_${x.k}`} defaultValue={l.proposal[x.k] ?? ""} style={{ minHeight: x.k === "offer" || x.k === "bonuses" ? "8rem" : "5rem" }} placeholder={x.k === "offer" || x.k === "bonuses" ? "- пункт\n- пункт" : ""} />
              </div>
            </div>
          ))}
          <div><SubmitButton>Зберегти пропозицію</SubmitButton></div>
        </form>
      </section>

      <section className="lab-section">
        <form action={saveLabTextAction} className="card stack">
          {hidden}
          <h2>Штурм</h2>
          <VoiceTextarea name="notes" defaultValue={l.notes} placeholder="Думки, ідеї, питання до клієнта, що ще перевірити" style={{ minHeight: "8rem" }} />
          <div><SubmitButton className="ghost">Зберегти</SubmitButton></div>
        </form>
      </section>

      <section className="lab-section">
        <form action={finishLabAction} className="card stack lab-finish">
          {hidden}
          <h2>Висновок</h2>
                    <div className="field">
            <label htmlFor="chosen">Що обираємо</label>
            <select id="chosen" name="chosen_option_id" defaultValue={l.chosen_option_id ?? leader?.id ?? ""}>
              <option value="">— ще не вирішили —</option>
              {l.options.map((o) => <option key={o.id} value={o.id}>{o.name}{o.total != null ? ` (${o.total}%)` : ""}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="conclusion">Чому і що далі</label>
            <VoiceTextarea id="conclusion" name="conclusion" defaultValue={l.conclusion} style={{ minHeight: "8rem" }} placeholder="Чому цей варіант, ризики, наступні кроки" />
          </div>
          {client && HAS_SERVICE.includes(l.category) && (
            <label className="check-line">
              <input type="checkbox" name="enable_service" defaultChecked />
              <span>Поставити обраний варіант у вкладку «{l.category === "site" ? "Сайт" : cat.label}» клієнта</span>
            </label>
          )}
          <div>
            <SubmitButton>{client ? "Завершити і закинути в картку клієнта" : "Завершити"}</SubmitButton>
          </div>
          {client && <div className="mono" style={{ color: "var(--dim)" }}>У картку піде: повний звіт у «Матеріали», запис в «Історію».</div>}
        </form>
      </section>

      <details className="danger-zone">
        <summary>Видалити сесію</summary>
        <form action={deleteLabAction} style={{ marginTop: "0.75rem" }}>{hidden}<button className="ghost small">Так, видалити</button></form>
      </details>
    </div>
  );
}

function ScenarioFields({ s }: { s?: { title: string; summary: string; steps_md: string; timeline: string; price_setup: number | null; price_month: number | null; pros: string; cons: string } }) {
  return (
    <>
      <div className="field"><label>Назва</label><input name="title" required defaultValue={s?.title} placeholder="Напр.: Своя CRM поетапно" /></div>
      <div className="field"><label>Суть</label><input name="summary" defaultValue={s?.summary} placeholder="1–2 речення: що це і що отримає клієнт" /></div>
      <div className="field"><label>Кроки</label><VoiceTextarea name="steps_md" defaultValue={s?.steps_md} style={{ minHeight: "8rem" }} placeholder={"1. Бот для лідів — 3 дні\n2. Ядро CRM — 2 тижні\n3. Телефонія"} /></div>
      <div className="form-grid">
        <div className="field"><label>Терміни</label><input name="timeline" defaultValue={s?.timeline} placeholder="2–3 тижні" /></div>
        <div className="field"><label>Впровадження</label><input name="price_setup" inputMode="decimal" defaultValue={s?.price_setup ?? ""} /></div>
        <div className="field"><label>На місяць</label><input name="price_month" inputMode="decimal" defaultValue={s?.price_month ?? ""} /></div>
      </div>
      <div className="form-grid">
        <div className="field"><label>Плюси (з нового рядка)</label><VoiceTextarea name="pros" defaultValue={s?.pros} /></div>
        <div className="field"><label>Мінуси (з нового рядка)</label><VoiceTextarea name="cons" defaultValue={s?.cons} /></div>
      </div>
    </>
  );
}
