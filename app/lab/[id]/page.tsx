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
        {done && <form action={reopenLabAction}>{hidden}<button className="ghost">Відкрити знову</button></form>}
      </div>

      <Suspense><LabAssistant id={id} /></Suspense>

      <div className="grid2 lab-top">
        <div className="card stack">
          <h2>Клієнт</h2>
          {client ? (
            <div className="facts">
              {[
                ["Ніша", client.niche],
                ["Бюджет / умови", client.budget],
                ["Платить Саші", client.fee_monthly ? `${money(client.fee_monthly)}/міс` : ""],
                ["Вже є", services.map((s) => `${SERVICES[s.type].short}${s.tool_name ? `: ${s.tool_name}` : ""}`).join(", ")],
                ["Що хоче", client.needs],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="fact"><div className="fact-label">{k}</div><div className="fact-value">{v}</div></div>
              ))}
            </div>
          ) : null}
          <form action={saveLabTextAction} className="inline">
            {hidden}
            <select name="client_id" defaultValue={l.client_id ?? ""} aria-label="Клієнт">
              <option value="">— без клієнта —</option>
              {listClients().filter((c) => c.status !== "archived" || c.id === l.client_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="ghost">Змінити</button>
          </form>
        </div>
        <form action={saveLabTextAction} className="card stack">
          {hidden}
          <h2>Проблема</h2>
          <VoiceTextarea name="brief" defaultValue={l.brief} placeholder="Задачі, скільки людей, звідки ліди, бюджет, обмеження, що вже пробували" style={{ minHeight: "8rem" }} />
          <div><SubmitButton className="ghost">Зберегти</SubmitButton></div>
        </form>
      </div>

      <section id="options" className="lab-section">
        <div className="lab-section-head">
          <h2>Варіанти</h2>
          <form action={addOptionAction} className="inline lab-add">
            {hidden}
            {tools.length > 0 && (
              <select name="tool_id" defaultValue="" aria-label="З довідника">
                <option value="">з довідника…</option>
                {tools.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <input name="name" placeholder={l.category === "crm" ? "або: Своя CRM на вайбкоді" : "або впиши свій варіант"} />
            <button>Додати</button>
          </form>
        </div>
        {l.options.length === 0 && <div className="empty card">Додай 2–4 варіанти: готові сервіси і своє рішення — потім оцінимо їх нижче.</div>}
        <div className="lab-options">
          {l.options.map((o) => (
            <form key={o.id} id={`opt-${o.id}`} action={saveOptionAction} className={`card stack lab-option ${leader?.id === o.id ? "lead" : ""}`}>
              {hidden}
              <input type="hidden" name="option_id" value={o.id} />
              <div className="lab-option-head">
                <input name="name" defaultValue={o.name} className="lab-option-name" aria-label="Назва" />
                {o.total != null && <span className={`tag ${leader?.id === o.id ? "ok" : ""}`}>{o.total}%{leader?.id === o.id ? " · лідер" : ""}</span>}
              </div>
              <div className="form-grid">
                <div className="field"><label>Ціна / міс</label><input name="price_month" inputMode="decimal" defaultValue={o.price_month ?? ""} placeholder="0" /></div>
                <div className="field"><label>Впровадження (разово)</label><input name="price_setup" inputMode="decimal" defaultValue={o.price_setup ?? ""} placeholder="0" /></div>
                <div className="field wide"><label>Посилання</label><input name="link" inputMode="url" autoCapitalize="off" defaultValue={o.link} placeholder="сайт сервісу або демо" /></div>
                <div className="field"><label>Плюси</label><VoiceTextarea name="pros" defaultValue={o.pros} /></div>
                <div className="field"><label>Мінуси</label><VoiceTextarea name="cons" defaultValue={o.cons} /></div>
                <div className="field wide"><label>Що побачили на тесті</label><VoiceTextarea name="notes" defaultValue={o.notes} /></div>
              </div>
              <div className="inline">
                <SubmitButton className="ghost small" />
                {o.link && <a href={o.link} target="_blank" rel="noreferrer" className="btn ghost small">Відкрити ↗</a>}
                <span className="grow" />
                <button formAction={deleteOptionAction} className="ghost small danger-text">Прибрати</button>
              </div>
            </form>
          ))}
        </div>
      </section>

      <section id="matrix" className="lab-section">
        <h2>Порівняння</h2>
        <form action={saveMatrixAction} className="stack">
          {hidden}
          <div className="table-wrap">
            <table className="lab-matrix">
              <thead>
                <tr>
                  <th>Критерій</th>
                  <th>Вага</th>
                  {l.options.map((o) => <th key={o.id} className={leader?.id === o.id ? "lead" : ""}>{o.name}</th>)}
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
                <tr className="sum">
                  <td>Ціна / міс · впровадження</td><td />
                  {l.options.map((o) => <td key={o.id}>{o.price_month != null ? money(o.price_month) : "—"} · {o.price_setup != null ? money(o.price_setup) : "—"}</td>)}
                  <td />
                </tr>
                <tr className="sum total">
                  <td>Разом</td><td />
                  {l.options.map((o) => <td key={o.id} className={leader?.id === o.id ? "lead" : ""}>{o.total != null ? `${o.total}%` : "—"}</td>)}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mono" style={{ color: "var(--dim)" }}>Оцінка 1–5 за кожен критерій. «Разом» — зважена сума: критичне важить утричі більше за неважливе.</div>
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
