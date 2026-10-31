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

export const dynamic = "force-dynamic";

const WEIGHTS = [{ v: 1, l: "×1 неважливо" }, { v: 2, l: "×2 важливо" }, { v: 3, l: "×3 критично" }];
const HAS_SERVICE = ["crm", "telephony", "site"];

export default async function LabSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
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
