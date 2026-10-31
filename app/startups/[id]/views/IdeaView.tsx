import AskAssistant from "@/components/AskAssistant";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { fmtDate } from "@/lib/dates";
import type { Startup, StartupItem } from "@/lib/repo/startups";
import { STRESS, stressScore } from "@/lib/startupSystem";
import { addItemAction, deleteItemAction, saveStressAction, updateItemAction } from "../../actions";
import FormulaEditor from "./FormulaEditor";
import { OldNotes, StepsBar } from "./shared";

// Ідея як шліфування: формула (версії) → альтернативи → стрес-тест (скептик ставить оцінки) → докази з розмов з клієнтами.
const YES = { yes: "так", partly: "частково", no: "ні" } as Record<string, string>;
const PAY = { yes: "так", maybe: "можливо", no: "ні" } as Record<string, string>;

export default function IdeaView({ s, items }: { s: Startup; items: StartupItem[] }) {
  const versions = items.filter((i) => i.kind === "version");
  const comp = items.filter((i) => i.kind === "competitor");
  const intv = items.filter((i) => i.kind === "interview");
  const st = stressScore(s.idea);
  const painYes = intv.filter((i) => i.data.pain === "yes").length;
  const payYes = intv.filter((i) => i.data.pay === "yes").length;
  const prices = intv.map((i) => i.data.price).filter(Boolean);

  return (
    <div className="stack" style={{ gap: "1.75rem" }}>
      <StepsBar s={s} items={items} p="idea" ask="Відшліфуй ідею цього стартапу: заповни формулу (startup_update idea.formula: who, pain, product, category, result, alternative, difference), додай 2–4 альтернативи (competitor: ціна, сильне, слабке), проведи чесний стрес-тест як скептичний інвестор (idea.stress: оцінка 1–5 і чому по кожному критерію + verdict), і склади 5 питань для розмов з клієнтами, щоб перевірити найслабше місце." />

      {/* 1. Формула */}
      <section className="stack" style={{ gap: "0.75rem" }}>
        <div className="su-sec-head"><h2>1. Ідея одним реченням</h2><span>{versions.length ? `версій: ${versions.length}` : "кожне збереження — нова версія"}</span></div>
        <FormulaEditor id={s.id} initial={s.idea.formula} />
        {versions.length > 1 && (
          <details className="card">
            <summary><b>Як ідея змінювалась</b> <span className="lab-muted">({versions.length})</span></summary>
            <ol className="id-versions">
              {versions.map((v, i) => (
                <li key={v.id}><span className="su-dec-date">v{versions.length - i} · {fmtDate(v.created_at)}</span><p>{v.title}</p>{v.body && <small>{v.body}</small>}</li>
              ))}
            </ol>
          </details>
        )}
      </section>

      {/* 2. Альтернативи */}
      <section className="stack" style={{ gap: "0.75rem" }}>
        <div className="su-sec-head"><h2>2. Чим користуються зараз</h2><span>конкуренти і «Excel + менеджер»</span></div>
        {comp.length > 0 && (
          <div className="id-comp">
            {comp.map((c) => (
              <article key={c.id} id={`i-${c.id}`} className="card id-comp-card">
                <div className="tx-mod-head"><b>{c.title}</b>{c.data.price && <span className="tag">{c.data.price}</span>}</div>
                {c.data.strong && <p className="id-plus">+ {c.data.strong}</p>}
                {c.data.weak && <p className="id-minus">− {c.data.weak}</p>}
                <details className="lab-edit">
                  <summary>Змінити</summary>
                  <form action={updateItemAction} className="stack" style={{ marginTop: "0.5rem" }}>
                    <input type="hidden" name="item_id" value={c.id} /><input type="hidden" name="v" value="idea" />
                    <CompFields c={c} />
                    <div className="inline"><SubmitButton className="small" /><span className="grow" /><button formAction={deleteItemAction} className="ghost small danger-text">✕</button></div>
                  </form>
                </details>
              </article>
            ))}
          </div>
        )}
        <form action={addItemAction} className="card mk-form">
          <input type="hidden" name="id" value={s.id} /><input type="hidden" name="v" value="idea" /><input type="hidden" name="kind" value="competitor" />
          <CompFields />
          <div className="inline wide"><button className="ghost">Додати альтернативу</button><span className="grow" /><AskAssistant text="Знайди 3–5 реальних альтернатив для цього стартапу (конкуренти + як справляються без нас), з цінами, сильним і слабким — пошукай в інтернеті, якщо можна. Запиши як competitor.">Джері, знайди</AskAssistant></div>
        </form>
      </section>

      {/* 3. Стрес-тест */}
      <section className="stack" style={{ gap: "0.75rem" }} id="stress">
        <div className="su-sec-head"><h2>3. Стрес-тест</h2><span>{st.pct == null ? "оцінки 1–5 по 7 питаннях" : `міцність ${st.pct}% · оцінено ${st.scored}/${STRESS.length}`}</span></div>
        <div className="card stack">
          {st.pct != null && (
            <div className="id-meter">
              <div><i style={{ width: `${st.pct}%` }} className={st.pct >= 70 ? "ok" : st.pct >= 50 ? "warn" : "bad"} /></div>
              <span>{st.pct >= 70 ? "Ідея міцна — час перевіряти на клієнтах і будувати" : st.pct >= 50 ? "Є слабкі місця — закрий їх до розробки" : "Поки слабко — шліфуй або міняй ідею"}</span>
            </div>
          )}
          <div className="inline" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
            <AskAssistant text="Проведи стрес-тест цього стартапу як жорсткий скептичний інвестор: по кожному критерію (pain, pay, market, why_us, competition, build, money) оцінка 1–5 і чесне «чому» з посиланням на факти з проєкту (розмови, альтернативи, цифри). Без підлизування. Потім verdict: головний ризик і що перевірити першим. Збережи через startup_update idea.stress і idea.verdict; найслабші місця — додай як гіпотези (experiment).">Джері, атакуй ідею</AskAssistant>
          </div>
          <form action={saveStressAction} className="id-stress">
            <input type="hidden" name="id" value={s.id} />
            {STRESS.map((x) => {
              const v = s.idea.stress[x.k];
              return (
                <div key={x.k} className={`id-crit ${v ? `sc-${v.score}` : ""}`}>
                  <div className="id-crit-head">
                    <b>{x.label}</b>
                    <div className="id-score" role="radiogroup" aria-label={x.label}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <label key={n}><input type="radio" name={`s_${x.k}`} value={n} defaultChecked={v?.score === n} /><span>{n}</span></label>
                      ))}
                    </div>
                  </div>
                  <small className="lab-muted">{x.q}</small>
                  <input name={`w_${x.k}`} defaultValue={v?.why ?? ""} placeholder="Чому така оцінка — факти, не відчуття" />
                </div>
              );
            })}
            <div className="wide"><VoiceTextarea name="verdict" defaultValue={s.idea.verdict} placeholder="Вердикт: головний ризик і що перевірити першим" style={{ minHeight: "4rem" }} /></div>
            <div className="wide"><SubmitButton className="small">Зберегти оцінки</SubmitButton></div>
          </form>
        </div>
      </section>

      {/* 4. Докази */}
      <section className="stack" style={{ gap: "0.75rem" }}>
        <div className="su-sec-head"><h2>4. Докази: розмови з клієнтами</h2><span>без них ідея — віра</span></div>
        <div className="fin-kpis">
          <div className="card fin-kpi"><span>Розмов</span><b>{intv.length}</b><small>мета — 5+ до розробки</small></div>
          <div className={`card fin-kpi ${intv.length && painYes / intv.length >= 0.5 ? "ok" : intv.length ? "warn" : ""}`}><span>Підтвердили біль</span><b>{painYes} з {intv.length}</b><small>{intv.length ? `${Math.round((painYes / intv.length) * 100)}%` : "—"}</small></div>
          <div className={`card fin-kpi ${payYes ? "ok" : ""}`}><span>Готові платити</span><b>{payYes}</b><small>{prices.length ? `називали: ${prices.slice(0, 3).join(", ")}` : "питай про ціну прямо"}</small></div>
        </div>
        {intv.map((i) => (
          <article key={i.id} id={`i-${i.id}`} className="card id-intv">
            <div className="tx-mod-head">
              <b>{i.title}</b>
              <span className="inline" style={{ gap: "0.375rem" }}>
                {i.data.pain && <span className={`tag ${i.data.pain === "yes" ? "ok" : i.data.pain === "no" ? "bad" : "warn"}`}>біль: {YES[i.data.pain]}</span>}
                {i.data.pay && <span className={`tag ${i.data.pay === "yes" ? "ok" : i.data.pay === "no" ? "bad" : "warn"}`}>платити: {PAY[i.data.pay]}</span>}
                <span className="su-dec-date">{fmtDate(i.created_at)}</span>
              </span>
            </div>
            {i.body && <p className="su-muted-p">«{i.body}»</p>}
            {i.data.price && <p className="su-muted-p"><span className="lab-kicker">Ціна, яку назвали:</span> {i.data.price}</p>}
            <form action={deleteItemAction}><input type="hidden" name="item_id" value={i.id} /><input type="hidden" name="v" value="idea" /><button className="ghost small">Прибрати</button></form>
          </article>
        ))}
        <form action={addItemAction} className="card mk-form">
          <input type="hidden" name="id" value={s.id} /><input type="hidden" name="v" value="idea" /><input type="hidden" name="kind" value="interview" />
          <input name="title" required placeholder="Хто: «Олег, комерційний директор ЖК Акварель»" className="wide" />
          <div className="wide"><VoiceTextarea name="body" placeholder="Що сказав своїми словами — надиктуй одразу після дзвінка" style={{ minHeight: "4rem" }} /></div>
          <select name="d_pain" defaultValue=""><option value="">Біль підтвердив?</option>{Object.entries(YES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select name="d_pay" defaultValue=""><option value="">Готовий платити?</option>{Object.entries(PAY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input name="d_price" placeholder="Яку ціну назвав (якщо)" />
          <div className="inline wide"><button className="ghost">Записати розмову</button><span className="grow" /><AskAssistant text="Склади мені сценарій розмови з потенційним клієнтом для цього стартапу: 7–10 питань за методом «The Mom Test» (про їхнє минуле і поточну поведінку, не про нашу ідею), як спитати про гроші, і на що звернути увагу.">Джері, сценарій розмови</AskAssistant></div>
        </form>
      </section>

      <OldNotes s={s} p="idea" />
    </div>
  );
}

function CompFields({ c }: { c?: StartupItem }) {
  return (
    <>
      <input name="title" required defaultValue={c?.title} placeholder="Альтернатива: Bitrix24 / Excel + менеджер" />
      <input name="d_price" defaultValue={c?.data.price} placeholder="Ціна: $50/міс" />
      <input name="d_strong" defaultValue={c?.data.strong} placeholder="Чим сильна" />
      <input name="d_weak" defaultValue={c?.data.weak} placeholder="Де слабка (наш шанс)" />
    </>
  );
}
