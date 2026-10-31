import AskAssistant from "@/components/AskAssistant";
import Markdown from "@/components/Markdown";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/config";
import type { Startup, StartupItem } from "@/lib/repo/startups";
import { INFRA } from "@/lib/startupSystem";
import { addItemAction, deleteItemAction, saveSpecAction, updateItemAction } from "../../actions";
import { CopyText } from "../CopyText";
import { OldNotes, StepsBar } from "./shared";

// Технічна як карта системи: модулі зі статусами → інфраструктура (вибір + ціна; сума йде у Фінанси) →
// релізи (v0.1, v0.2…) зі своїм промптом для Claude Code → CLAUDE.md проєкту (правила, що лежать у репо).
const MOD_ST = { plan: "план", doing: "робимо", done: "готово" } as Record<string, string>;
const REL_ST = { plan: "план", building: "будуємо", shipped: "випущено" } as Record<string, string>;

const CLAUDE_MD_ASK = `Збери CLAUDE.md для репозиторію цього стартапу — файл, який Claude Code читає на початку кожної сесії. Коротко і по суті:
1. Що за проєкт, для кого, головна метрика.
2. Стек і структура папок, де що лежить.
3. Модулі і сутності (з карти модулів).
4. Інфраструктура: сервер, деплой, система оновлень (автодеплой, міграції, відкат), бекапи, моніторинг — з вибору в інфраструктурі.
5. Жорсткі правила: ключі тільки в .env, мінімум залежностей, мобільний UI першим, коміт після кожного етапу, перед злиттям — перевірки.
6. Як спілкуватись зі мною (українською, коротко), що вирішувати самому, що питати.
7. Поточний реліз і що далі.
Збережи в spec_md стартапу.`;

export default function TechView({ s, items }: { s: Startup; items: StartupItem[] }) {
  const mods = items.filter((i) => i.kind === "module");
  const infra = items.filter((i) => i.kind === "infra");
  const rel = items.filter((i) => i.kind === "release").sort((a, b) => a.position - b.position);
  const infraCost = infra.reduce((a, i) => a + (Number(i.data.cost) || 0), 0);
  const relName = (id: string) => rel.find((r) => String(r.id) === id)?.title;
  const custom = infra.filter((i) => !INFRA.some((x) => x.k === i.data.key));

  return (
    <div className="stack" style={{ gap: "1.75rem" }}>
      <StepsBar s={s} items={items} p="tech" ask="Збудуй технічну сторону цього стартапу: 4–8 модулів (що робить, сутності, від чого залежить, в якому релізі), заповни інфраструктуру (сервер, домен, база і бекапи, деплой і оновлення без простою, міграції, моніторинг, вхід, пошта, оплата, аналітика, ШІ) з конкретним вибором і ціною на місяць, розбий на релізи v0.1 MVP / v0.2 / v1.0 з обсягом кожного. Важливі вибори — в журнал рішень. Пиши через startup_item." />

      {/* 1. Модулі */}
      <section className="stack" style={{ gap: "0.75rem" }}>
        <div className="su-sec-head"><h2>1. Карта системи: модулі</h2><span>{mods.filter((m) => m.status === "done").length} з {mods.length} готово</span></div>
        <div className="tx-mods">
          {mods.map((m) => (
            <article key={m.id} id={`i-${m.id}`} className={`card tx-mod s-${m.status || "plan"}`}>
              <div className="tx-mod-head"><b>{m.title}</b><span className={`tag ${m.status === "done" ? "ok" : m.status === "doing" ? "accent" : ""}`}>{MOD_ST[m.status || "plan"]}</span></div>
              {m.body && <p className="su-muted-p">{m.body}</p>}
              <dl className="mk-dl">
                {m.data.entities && <><dt>Дані</dt><dd>{m.data.entities}</dd></>}
                {m.data.depends && <><dt>Залежить від</dt><dd>{m.data.depends}</dd></>}
                {m.data.release && relName(m.data.release) && <><dt>Реліз</dt><dd>{relName(m.data.release)}</dd></>}
              </dl>
              <details className="lab-edit">
                <summary>Змінити</summary>
                <form action={updateItemAction} className="mk-form" style={{ marginTop: "0.5rem" }}>
                  <input type="hidden" name="item_id" value={m.id} /><input type="hidden" name="v" value="tech" />
                  <ModFields m={m} rel={rel} />
                  <div className="inline wide"><SubmitButton className="small" /><span className="grow" /><button formAction={deleteItemAction} className="ghost small danger-text">Прибрати</button></div>
                </form>
              </details>
            </article>
          ))}
        </div>
        <details className="card" open={!mods.length}>
          <summary><b>+ Модуль</b></summary>
          <form action={addItemAction} className="mk-form" style={{ marginTop: "0.75rem" }}>
            <input type="hidden" name="id" value={s.id} /><input type="hidden" name="v" value="tech" /><input type="hidden" name="kind" value="module" />
            <ModFields rel={rel} />
            <div className="wide"><button>Додати модуль</button></div>
          </form>
        </details>
      </section>

      {/* 2. Інфраструктура */}
      <section className="stack" style={{ gap: "0.75rem" }}>
        <div className="su-sec-head"><h2>2. Інфраструктура</h2><span>{infraCost ? `${money(infraCost)}/міс → у Фінанси` : "вибір і ціна на кожен пункт"}</span></div>
        <div className="card tx-infra">
          {[...INFRA.map((x) => ({ def: x, it: infra.find((i) => i.data.key === x.k) })), ...custom.map((it) => ({ def: { k: it.data.key || `c${it.id}`, label: it.title, hint: "" }, it }))].map(({ def, it }) => (
            <details key={def.k} className={`tx-inf ${it?.status === "done" ? "done" : it?.data.choice ? "chosen" : ""}`}>
              <summary>
                <span className="tx-inf-dot" />
                <span className="tx-inf-name"><b>{def.label}</b><small>{it?.data.choice || def.hint}</small></span>
                <span className="tx-inf-cost">{Number(it?.data.cost) ? `${money(Number(it!.data.cost))}/міс` : ""}</span>
              </summary>
              <form action={it ? updateItemAction : addItemAction} className="mk-form tx-inf-form">
                {it ? <input type="hidden" name="item_id" value={it.id} /> : <><input type="hidden" name="id" value={s.id} /><input type="hidden" name="kind" value="infra" /><input type="hidden" name="d_key" value={def.k} /><input type="hidden" name="title" value={def.label} /></>}
                <input type="hidden" name="v" value="tech" />
                <input name="d_choice" defaultValue={it?.data.choice} placeholder="Що обрали: напр. Hetzner CX23, Ubuntu" className="wide" />
                <input name="d_cost" inputMode="decimal" defaultValue={it?.data.cost} placeholder="Ціна на місяць" />
                <select name="status" defaultValue={it?.status || "todo"}><option value="todo">ще не налаштовано</option><option value="done">налаштовано і працює</option></select>
                <input name="body" defaultValue={it?.body} placeholder="Деталі: як саме, де ключі, що перевірити" className="wide" />
                <div className="inline wide"><SubmitButton className="small" />{it && <><span className="grow" /><button formAction={deleteItemAction} className="ghost small danger-text">Очистити</button></>}</div>
              </form>
            </details>
          ))}
          <form action={addItemAction} className="inline tx-inf-add">
            <input type="hidden" name="id" value={s.id} /><input type="hidden" name="v" value="tech" /><input type="hidden" name="kind" value="infra" />
            <input name="title" required placeholder="+ Свій пункт: напр. CDN для картинок" />
            <button className="ghost small">Додати</button>
          </form>
        </div>
      </section>

      {/* 3. Релізи з промптами */}
      <section className="stack" style={{ gap: "0.75rem" }}>
        <div className="su-sec-head"><h2>3. Релізи і промпти для Claude Code</h2><span>кожен реліз — окремий промпт, віддаєш по черзі</span></div>
        {rel.map((r) => {
          const rm = mods.filter((m) => m.data.release === String(r.id));
          return (
            <article key={r.id} id={`i-${r.id}`} className={`card tx-rel s-${r.status || "plan"}`}>
              <div className="tx-mod-head">
                <b>{r.title}</b>
                <span className={`tag ${r.status === "shipped" ? "ok" : r.status === "building" ? "accent" : ""}`}>{REL_ST[r.status || "plan"]}</span>
              </div>
              {r.data.goal && <p className="su-muted-p"><span className="lab-kicker">Мета:</span> {r.data.goal}</p>}
              {r.body && <div className="su-muted-p"><Markdown md={r.body} /></div>}
              {rm.length > 0 && <div className="mk-angle-meta">{rm.map((m) => <span key={m.id} className={`tag ${m.status === "done" ? "ok" : ""}`}>{m.title}</span>)}</div>}
              <div className="tx-prompt">
                {r.data.prompt ? (
                  <>
                    <div className="inline" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                      <b>Промпт готовий</b><span className="lab-muted">{r.data.prompt.length.toLocaleString("uk-UA")} символів</span><span className="grow" />
                      <CopyText text={r.data.prompt} />
                      <AskAssistant text={`Онови промпт для Claude Code для релізу «${r.title}» (item_id ${r.id}) з урахуванням поточних модулів, інфраструктури і рішень.`}>Оновити</AskAssistant>
                    </div>
                    <details><summary className="lab-muted">Показати промпт</summary><pre className="tx-pre">{r.data.prompt}</pre></details>
                  </>
                ) : (
                  <div className="inline" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                    <span className="lab-muted">Промпту ще нема.</span><span className="grow" />
                    <AskAssistant text={`Напиши промпт для Claude Code для релізу «${r.title}» (item_id ${r.id}) цього стартапу: що побудувати в цьому релізі (модулі релізу, сутності, екрани, сценарії), що НЕ чіпати, технічні вимоги з інфраструктури і журналу рішень, критерії «готово», як перевірити, порядок кроків з комітами. Конкретно, щоб можна було скопіювати і віддати. Збережи в data.prompt цього релізу (startup_item update).`}>Джері, напиши промпт</AskAssistant>
                  </div>
                )}
              </div>
              <details className="lab-edit">
                <summary>Змінити реліз</summary>
                <form action={updateItemAction} className="mk-form" style={{ marginTop: "0.5rem" }}>
                  <input type="hidden" name="item_id" value={r.id} /><input type="hidden" name="v" value="tech" />
                  <RelFields r={r} />
                  <div className="wide"><VoiceTextarea name="d_prompt" defaultValue={r.data.prompt} placeholder="Промпт для Claude Code (можна вставити свій)" style={{ minHeight: "8rem", fontSize: "0.875rem" }} /></div>
                  <div className="inline wide"><SubmitButton className="small" /><span className="grow" /><button formAction={deleteItemAction} className="ghost small danger-text">Прибрати</button></div>
                </form>
              </details>
            </article>
          );
        })}
        <details className="card" open={!rel.length}>
          <summary><b>+ Реліз</b></summary>
          <form action={addItemAction} className="mk-form" style={{ marginTop: "0.75rem" }}>
            <input type="hidden" name="id" value={s.id} /><input type="hidden" name="v" value="tech" /><input type="hidden" name="kind" value="release" />
            <RelFields />
            <div className="wide"><button>Додати реліз</button></div>
          </form>
        </details>
      </section>

      {/* 4. CLAUDE.md */}
      <section className="stack" style={{ gap: "0.75rem" }} id="spec">
        <div className="su-sec-head"><h2>4. CLAUDE.md проєкту</h2><span>правила, які Claude Code читає щоразу — кладеш у корінь репозиторію</span></div>
        <div className="card su-spec-bar">
          <div><b>{s.spec_md ? "Готовий" : "Ще не зібраний"}</b><span>{s.spec_updated_at ? `оновлено ${fmtDate(s.spec_updated_at)}` : "Джері збирає з модулів, інфраструктури, рішень і релізів"}</span></div>
          <div className="inline" style={{ flexWrap: "wrap" }}>
            <AskAssistant text={CLAUDE_MD_ASK}>{s.spec_md ? "Джері, онови" : "Джері, збери"}</AskAssistant>
            {s.spec_md && <CopyText text={s.spec_md} />}
            {s.spec_md && <a href={`/api/startups/${s.id}/spec?format=md`} className="btn ghost small">CLAUDE.md ↓</a>}
            <a href={`/api/startups/${s.id}/spec?what=all&format=md`} className="btn ghost small">Експорт проєкту</a>
          </div>
        </div>
        {s.spec_md && <details className="card"><summary><b>Показати</b></summary><article className="su-spec" style={{ marginTop: "0.75rem" }}><Markdown md={s.spec_md} /></article></details>}
        <details className="lab-edit">
          <summary>Редагувати вручну</summary>
          <form action={saveSpecAction} className="stack" style={{ marginTop: "0.75rem" }}>
            <input type="hidden" name="id" value={s.id} />
            <VoiceTextarea name="spec_md" defaultValue={s.spec_md} style={{ minHeight: "20rem", fontSize: "0.9375rem" }} />
            <div><SubmitButton /></div>
          </form>
        </details>
      </section>

      <OldNotes s={s} p="tech" />
    </div>
  );
}

function ModFields({ m, rel }: { m?: StartupItem; rel: StartupItem[] }) {
  return (
    <>
      <input name="title" required defaultValue={m?.title} placeholder="Модуль: Шахматка квартир" />
      <select name="status" defaultValue={m?.status || "plan"}>{Object.entries(MOD_ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <input name="body" defaultValue={m?.body} placeholder="Що робить: сітка поверхів, статуси, бронь на 3 дні" className="wide" />
      <input name="d_entities" defaultValue={m?.data.entities} placeholder="Дані: Квартира, Поверх, Бронь" />
      <input name="d_depends" defaultValue={m?.data.depends} placeholder="Залежить від: Вхід, Обʼєкти" />
      <select name="d_release" defaultValue={m?.data.release ?? ""}><option value="">— реліз —</option>{rel.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select>
    </>
  );
}

function RelFields({ r }: { r?: StartupItem }) {
  return (
    <>
      <input name="title" required defaultValue={r?.title} placeholder="v0.1 MVP" />
      <select name="status" defaultValue={r?.status || "plan"}>{Object.entries(REL_ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <input name="d_goal" defaultValue={r?.data.goal} placeholder="Мета релізу: перший забудовник веде продажі в системі" className="wide" />
      <div className="wide"><VoiceTextarea name="body" defaultValue={r?.body} placeholder="Що входить: 1. … 2. … Що НЕ входить: …" style={{ minHeight: "5rem" }} /></div>
    </>
  );
}
