// Бібліотека лід-форм клієнта (Meta Ads → «Лід-форми»): форма = конструктор Meta з готовими значеннями,
// прев'ю як на телефоні, копіювання кожного поля, версії для тесту зі статистикою.
import Link from "next/link";
import { formStatusAction, formVersionAction, newFormAction, saveFormAction } from "@/app/campaigns/actions";
import Icon from "@/components/Icon";
import Pop from "@/components/Pop";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { formMd, formStats, money2 } from "@/lib/campaigns";
import { fmtDate } from "@/lib/dates";
import { FORM_LIMITS, FORM_TYPES, formVersions, getForm, listForms, parseQuestions, type LeadForm } from "@/lib/repo/campaigns";
import { getClientRow } from "@/lib/repo/clients";
import { logoSrc } from "@/lib/repo/logos";
import { CopyBtn, CopyField, GenForm } from "./CampaignClient";

const base = (cid: number) => `/clients/${cid}?tab=meta_ads&mv=forms`;

export default function FormsView({ clientId, form }: { clientId: number; form?: string }) {
  const f = form ? getForm(Number(form)) : undefined;
  if (f && f.client_id === clientId) return <FormEditor f={f} />;
  const forms = listForms(clientId, true);
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="kp-head">
        <div><b>Лід-форми</b><span className="mono">Бібліотека форм клієнта: міняємо спершу тут, потім у Meta. Кожна зміна — нова версія, видно, яка дала дешевші заявки.</span></div>
        <Pop className="pop-trigger pop-inline" title="Нова форма" trigger={<span className="btn ghost small">+ Порожня форма</span>}>
          <form action={newFormAction} className="stack" style={{ gap: "0.5rem" }}>
            <input type="hidden" name="client_id" value={clientId} />
            <input name="name" placeholder="Назва: напр. «Імплантація — розстрочка»" autoFocus required />
            <div><SubmitButton className="small">Створити</SubmitButton></div>
          </form>
        </Pop>
      </div>
      <div className="card kp-sec"><GenForm clientId={clientId} /></div>
      {forms.length ? (
        <div className="kp-cards">
          {forms.map((x) => {
            const st = formStats(x);
            return (
              <Link key={x.id} href={`${base(clientId)}&form=${x.id}`} className={`card kp-card${x.status === "active" ? "" : " kp-arch"}`} scroll={false}>
                <span className="kp-card-top"><span className="tag accent">v{x.version}</span><span className="mono">{x.status === "active" ? fmtDate(x.updated_at) : "в архіві"}</span></span>
                <b>{x.name}</b>
                <span className="mono">{FORM_TYPES[x.form_type as keyof typeof FORM_TYPES]?.split(" (")[0] ?? x.form_type} · питань {parseQuestions(x.questions).length} · оголошень {x.ads}</span>
                {st.leads ? <span className="kp-card-live"><span><b>{st.leads}</b> лідів</span><span><b>{money2(st.cpl)}</b> за лід</span></span>
                  : <span className="mono kp-card-hint">{x.changes ? `Що змінили: ${x.changes}` : "Цифр ще нема"}</span>}
              </Link>
            );
          })}
        </div>
      ) : <div className="card kp-empty"><Icon name="file" size={28} /><b>Форм ще нема</b><span className="mono">Джері складе форму під кампанію сам — або натисни «Нова форма від Джері».</span></div>}
    </div>
  );
}

// Прев'ю як на телефоні: вступ → питання → політика → дякуємо
function FormPreview({ f }: { f: LeadForm }) {
  const c = getClientRow(f.client_id);
  const logo = logoSrc("client", f.client_id);
  const qs = parseQuestions(f.questions);
  return (
    <div className="kp-fp">
      <div className="kp-fp-scr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="kp-fp-ava">{logo ? <img src={logo} alt="" /> : <i>{(c?.name ?? "?").replace(/^Тест:\s*/, "").slice(0, 1)}</i>}</div>
        <small>{c?.name.replace(/^Тест:\s*/, "")}</small>
        <b>{f.intro_headline || "Заголовок вступу"}</b>
        {f.intro_text && <p>{f.intro_text}</p>}
      </div>
      <div className="kp-fp-scr">
        {qs.length ? qs.map((q, i) => (
          <div key={i} className="kp-fp-q">
            <span>{q.label}</span>
            {q.kind === "choice" ? <div className="kp-fp-opts">{q.options.map((o) => <i key={o}>{o}</i>)}</div> : <div className="kp-fp-in">{q.kind === "prefill" ? "заповнить Facebook" : "відповідь"}</div>}
          </div>
        )) : <span className="mono">Питань ще нема</span>}
        <small className="kp-fp-priv">Натискаючи «Надіслати», ви погоджуєтесь з <u>{f.privacy_text || "політикою конфіденційності"}</u></small>
        <div className="kp-fp-btn">{f.form_type === "intent" ? "Далі" : "Надіслати"}</div>
      </div>
      <div className="kp-fp-scr kp-fp-end">
        <span className="kp-fp-ok">✓</span>
        <b>{f.thanks_headline || "Дякуємо!"}</b>
        {f.thanks_text && <p>{f.thanks_text}</p>}
        {f.thanks_button && <div className="kp-fp-btn">{f.thanks_button}</div>}
      </div>
    </div>
  );
}

function Edit({ f, title, children }: { f: LeadForm; title: string; children: React.ReactNode }) {
  return (
    <Pop wide closeOnSubmit className="pop-trigger pop-inline" title={`${title} · ${f.name} v${f.version}`} trigger={<span className="btn ghost small">Змінити</span>}>
      <form action={saveFormAction} className="stack" style={{ gap: "0.625rem" }}>
        <input type="hidden" name="form_id" value={f.id} />
        {children}
        <div><SubmitButton className="small">Зберегти</SubmitButton></div>
      </form>
    </Pop>
  );
}
const Sec = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <div className="card kp-sec"><div className="kp-sec-h"><b>{title}</b>{action}</div>{children}</div>
);

function FormEditor({ f }: { f: LeadForm }) {
  const qs = parseQuestions(f.questions);
  const versions = formVersions(f);
  const st = formStats(f);
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="kp-ed-head">
        <Link href={base(f.client_id)} className="h-link" scroll={false}>← Усі форми</Link>
        <div className="kp-ed-title"><h2>{f.name}</h2><span className="tag accent">v{f.version}</span>{f.status !== "active" && <span className="tag">архів</span>}</div>
        <div className="kp-ed-act">
          <CopyBtn text={formMd(f)} label="⧉ Уся форма текстом" small />
          <Pop wide className="pop-trigger pop-inline" title="Нова версія для тесту" sub="Стара лишається як є (і на оголошеннях, де стоїть). Нову підключиш до нових оголошень." trigger={<span className="btn small">+ Нова версія</span>}>
            <form action={formVersionAction} className="stack" style={{ gap: "0.5rem" }}>
              <input type="hidden" name="form_id" value={f.id} />
              <label className="cg-f"><span>Що міняємо і чому</span><VoiceTextarea name="changes" required placeholder="напр. «прибрав питання про бюджет — багато відвалювалось на 2-му кроці»" style={{ minHeight: "4rem" }} /></label>
              <div><SubmitButton className="small">Створити v{Math.max(...versions.map((v) => v.version)) + 1}</SubmitButton></div>
            </form>
          </Pop>
          <form action={formStatusAction}><input type="hidden" name="form_id" value={f.id} /><button className="ghost small">{f.status === "active" ? "В архів" : "Повернути"}</button></form>
        </div>
      </div>
      {f.changes && <div className="mx-warn" style={{ background: "var(--accent-soft)", borderColor: "var(--line)" }}><Icon name="flag" size={15} /> Що змінили у v{f.version}: {f.changes}</div>}

      <div className="kp-ad">
        <FormPreview f={f} />
        <div className="stack" style={{ gap: "0.875rem", minWidth: 0 }}>
          <Sec title="Назва і тип" action={<Edit f={f} title="Назва і тип">
            <label className="cg-f"><span>Назва форми</span><input name="name" defaultValue={f.name} required /></label>
            <label className="cg-f"><span>Тип форми</span><select name="form_type" defaultValue={f.form_type}>{Object.entries(FORM_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="cg-f"><span>Нотатка</span><textarea name="notes" defaultValue={f.notes} style={{ minHeight: "3rem" }} /></label>
          </Edit>}>
            <CopyField label="Назва форми" value={`${f.name} v${f.version}`} hint="з версією — щоб розрізняти в Meta" />
            <CopyField label="Тип" value={FORM_TYPES[f.form_type as keyof typeof FORM_TYPES] ?? f.form_type} />
          </Sec>
          <Sec title="1 · Вступ" action={<Edit f={f} title="Вступ">
            <label className="cg-f"><span>Заголовок <i>до {FORM_LIMITS.intro_headline}</i></span><input name="intro_headline" defaultValue={f.intro_headline} /></label>
            <label className="cg-f"><span>Опис</span><VoiceTextarea name="intro_text" defaultValue={f.intro_text} style={{ minHeight: "5rem" }} /></label>
          </Edit>}>
            <CopyField label="Заголовок" value={f.intro_headline} limit={FORM_LIMITS.intro_headline} />
            <CopyField label="Опис" value={f.intro_text} multiline />
          </Sec>
          <Sec title={`2 · Питання · ${qs.length}`} action={<Edit f={f} title="Питання">
            <span className="mono">По рядку. «Імʼя», «Телефон», «Email», «Місто» — стандартні поля Meta. «? Питання | варіант | варіант» — з варіантами. «? Питання» — коротка відповідь.</span>
            <textarea name="questions" defaultValue={f.questions} style={{ minHeight: "10rem" }} />
          </Edit>}>
            {qs.map((q, i) => (
              <div key={i} className="kp-f">
                <div className="kp-f-h"><span className="kp-f-l">{i + 1}. {q.kind === "prefill" ? "Стандартне поле" : q.kind === "choice" ? "З варіантами" : "Коротка відповідь"}</span>
                  {q.kind !== "prefill" && <span className={`kp-cnt${q.label.length > FORM_LIMITS.question ? " over" : ""}`}>{q.label.length}/{FORM_LIMITS.question}</span>}<CopyBtn text={q.label} /></div>
                <div className="kp-f-v">{q.label}</div>
                {q.options.length > 0 && <div className="kp-chips">{q.options.map((o) => <span key={o} className="kp-chip">{o}<CopyBtn text={o} label="⧉" /></span>)}</div>}
              </div>
            ))}
          </Sec>
          <Sec title="3 · Політика конфіденційності" action={<Edit f={f} title="Політика">
            <label className="cg-f"><span>Текст посилання</span><input name="privacy_text" defaultValue={f.privacy_text} /></label>
            <label className="cg-f"><span>Адреса сторінки</span><input name="privacy_url" defaultValue={f.privacy_url} placeholder="https://" /></label>
          </Edit>}>
            <CopyField label="Текст посилання" value={f.privacy_text} />
            <CopyField label="Адреса" value={f.privacy_url} />
          </Sec>
          <Sec title="4 · Екран «Дякуємо»" action={<Edit f={f} title="Дякуємо">
            <label className="cg-f"><span>Заголовок <i>до {FORM_LIMITS.thanks_headline}</i></span><input name="thanks_headline" defaultValue={f.thanks_headline} /></label>
            <label className="cg-f"><span>Опис</span><VoiceTextarea name="thanks_text" defaultValue={f.thanks_text} style={{ minHeight: "4rem" }} /></label>
            <div className="kp-row2">
              <label className="cg-f"><span>Кнопка <i>до {FORM_LIMITS.thanks_button}</i></span><input name="thanks_button" defaultValue={f.thanks_button} /></label>
              <label className="cg-f"><span>Посилання кнопки</span><input name="thanks_url" defaultValue={f.thanks_url} placeholder="https://" /></label>
            </div>
          </Edit>}>
            <CopyField label="Заголовок" value={f.thanks_headline} limit={FORM_LIMITS.thanks_headline} />
            <CopyField label="Опис" value={f.thanks_text} multiline />
            <CopyField label="Кнопка" value={f.thanks_button} limit={FORM_LIMITS.thanks_button} />
            {f.thanks_url && <CopyField label="Посилання кнопки" value={f.thanks_url} />}
          </Sec>
          <Sec title={`Версії · ${versions.length}`}>
            <div className="kp-vers">
              {versions.map((v) => {
                const s = v.id === f.id ? st : formStats(v);
                return (
                  <Link key={v.id} href={`${base(f.client_id)}&form=${v.id}`} scroll={false} className={`kp-ver${v.id === f.id ? " on" : ""}`}>
                    <b>v{v.version}</b>
                    <span>{v.changes || (v.version === 1 ? "перша версія" : "—")}</span>
                    <span className="kp-ver-n">{s.ads} огол. · {s.leads ? `${s.leads} лідів · ${money2(s.cpl)}` : "цифр нема"}</span>
                  </Link>
                );
              })}
            </div>
            <span className="mono">Цифри — сума по оголошеннях з цією версією (за весь час), коли в назві оголошення в Meta є код AD-N.</span>
          </Sec>
        </div>
      </div>
    </div>
  );
}
