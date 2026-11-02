// Карта продукту: як він виглядає в кінцевому рахунку — з усього, що вже є в проєкті.
// Для кого і який біль → що це і що дає → з чого складається (модулі, інтеграції) → як продаємо → ціна і цифри → що вже знаємо → шлях.
import Link from "next/link";
import AskAssistant from "@/components/AskAssistant";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { saveStartupAction } from "../../actions";
import { money } from "@/lib/config";
import { INFRA } from "@/lib/startupSystem";
import { calcFinance, effectiveFinance, hasFinance, tiersPrice } from "@/lib/startupFinance";
import { finLinks } from "@/lib/startupSystem";
import { KNOWLEDGE_CATS, STAGES, type Startup, type StartupItem } from "@/lib/repo/startups";

const MOD = { plan: "план", doing: "робимо", done: "готово" } as Record<string, string>;

export default function ProductMap({ s, items }: { s: Startup; items: StartupItem[] }) {
  const f = s.idea.formula;
  const of = (k: string) => items.filter((i) => i.kind === k);
  const modules = of("module"), infra = of("infra"), segments = of("segment"), channels = of("channel"), releases = of("release"), kn = of("knowledge");
  const comps = of("competitor");
  const fin = hasFinance(s.finance) ? calcFinance(effectiveFinance(s.finance, finLinks(s.mkt, items))) : null;
  const price = tiersPrice(s.finance.tiers) ?? (s.finance.price || null);
  const modDone = modules.filter((m) => m.status === "done").length;
  const infraDone = infra.filter((i) => i.data.done === "1" || i.status === "done").length;
  const link = (v: string) => `/startups/${s.id}?v=${v}`;
  const Block = ({ title, v, children, empty }: { title: string; v: string; children: React.ReactNode; empty?: boolean }) => (
    <section className={`pm-block ${empty ? "empty" : ""}`}>
      <div className="pm-h"><b>{title}</b><Link href={link(v)}>→</Link></div>
      {children}
    </section>
  );
  const none = (t: string) => <p className="pm-none">{t}</p>;
  return (
    <div className="card pm">
      <div className="mx-main-head">
        <b>Карта продукту</b>
        <span>як він виглядатиме в кінцевому рахунку · {STAGES.find((x) => x.k === s.stage)?.label ?? s.stage}</span>
      </div>
      <div className="pm-hero">
        <div className="pm-name">{s.name}</div>
        {f.category?.trim() && <div className="pm-cat">{f.category}</div>}
        <p>{s.one_liner || (f.result?.trim() ? `Що дає: ${f.result}` : "Опису ще нема — натисни «✎ Назва і опис».")}</p>
        <details className="pm-edit">
          <summary>✎ Назва і опис</summary>
          <form action={saveStartupAction} className="stack" style={{ gap: "0.5rem", marginTop: "0.625rem" }}>
            <input type="hidden" name="id" value={s.id} /><input type="hidden" name="v" value="overview" />
            <label className="cm-field"><span>Назва продукту</span><input name="name" defaultValue={s.name} required placeholder="Напр. «Відділ продажу під ключ»" /></label>
            <label className="cm-field"><span>Опис: що це, для кого і що дає (1–3 речення)</span><VoiceTextarea name="one_liner" defaultValue={s.one_liner} placeholder="Система відділу продажу для забудовників: бот заявок, CRM, телефонія із записом і щомісячне ведення — кожна заявка оброблена, всі цифри на одному екрані." style={{ minHeight: "5rem" }} /></label>
            <div><SubmitButton className="small">Зберегти</SubmitButton></div>
          </form>
        </details>
      </div>
      <div className="pm-grid">
        <Block title="Для кого і біль" v="idea" empty={!f.who && !segments.length}>
          {f.who || f.pain ? <p>{f.who && <b>{f.who}</b>}{f.pain && <><br />{f.pain}</>}</p> : null}
          {segments.length ? <ul>{segments.slice(0, 4).map((x) => <li key={x.id}>{x.title}{x.data.offer ? <small> — {x.data.offer}</small> : null}</li>)}</ul> : !f.who && none("Сегменти — вкладка «Маркетинг»")}
        </Block>
        <Block title="Чим кращі" v="idea" empty={!f.difference && !comps.length}>
          {f.difference ? <p>На відміну від {f.alternative || "альтернатив"}, ми {f.difference}</p> : null}
          {comps.length ? <ul>{comps.slice(0, 4).map((x) => <li key={x.id}>{x.title}</li>)}</ul> : !f.difference && none("Альтернативи — вкладка «Ідея»")}
        </Block>
        <Block title={`З чого складається · ${modDone}/${modules.length} готово`} v="tech" empty={!modules.length}>
          {modules.length ? <ul className="pm-mods">{modules.map((m) => <li key={m.id} className={`s-${m.status || "plan"}`}><span>{m.title}</span><em>{MOD[m.status || "plan"]}</em></li>)}</ul> : none("Модулі — вкладка «Технічна»")}
        </Block>
        <Block title={`Інтеграції й фундамент · ${infraDone}/${INFRA.length}`} v="tech" empty={!infra.length}>
          {infra.length ? <ul>{infra.filter((i) => i.data.choice || i.title).slice(0, 8).map((i) => <li key={i.id}>{i.title}{i.data.choice ? <small> — {i.data.choice}</small> : null}</li>)}</ul> : none("Сервер, база, оплата, API — вкладка «Технічна»")}
        </Block>
        <Block title="Як продаємо" v="marketing" empty={!channels.length}>
          {channels.length ? <ul>{channels.slice(0, 5).map((c) => <li key={c.id}>{c.title}{c.data.budget ? <small> — {money(Number(c.data.budget))}/міс</small> : null}</li>)}</ul> : none("Канали — вкладка «Маркетинг»")}
        </Block>
        <Block title="Ціна і гроші" v="finance" empty={!fin}>
          {fin ? (
            <div className="pm-nums">
              {s.finance.tiers.length ? s.finance.tiers.map((t) => <div key={t.name}><b>{money(t.price)}</b><span>{t.name}</span></div>) : price ? <div><b>{money(price)}</b><span>{s.finance.model === "sub" ? "на місяць" : "за продаж"}{s.finance.setup ? ` + ${money(s.finance.setup)} запуск` : ""}</span></div> : null}
              <div><b className={fin.year.profit >= 0 ? "ok" : "bad"}>{money(Math.round(fin.year.profit))}</b><span>прибуток за 1-й рік</span></div>
              {fin.breakEven != null && <div><b>{Math.ceil(fin.breakEven)}</b><span>{s.finance.model === "sub" ? "клієнтів — вихід у нуль" : "продажів/міс — у нуль"}</span></div>}
            </div>
          ) : none("Ціна і калькулятор — вкладка «Фінанси»")}
        </Block>
        <Block title={`Що вже знаємо · ${kn.length}`} v="kb" empty={!kn.length}>
          {kn.length ? <ul>{Object.keys(KNOWLEDGE_CATS).flatMap((k) => kn.filter((i) => (i.data.cat || "lesson") === k).slice(-2)).slice(0, 5).map((i) => <li key={i.id}>{i.title}</li>)}</ul> : none("Що ламалось, API, уроки — «База знань»")}
        </Block>
        <Block title="Шлях до готового" v="tech" empty={!releases.length && !s.next_step}>
          {releases.length ? <ol className="pm-rel">{releases.map((r) => <li key={r.id} className={`s-${r.status || "plan"}`}>{r.title}{r.data.goal ? <small> — {r.data.goal}</small> : null}</li>)}</ol> : null}
          {s.next_step && <p className="pm-next">Зараз: {s.next_step}</p>}
        </Block>
      </div>
      <div className="inline" style={{ flexWrap: "wrap" }}>
        <AskAssistant text={`Стартап startup_id ${s.id}: подивись на карту продукту (startup_get) — які блоки порожні або слабкі для кінцевого продукту? Заповни, що можеш з того, що вже знаємо (формула, сегменти, модулі, інтеграції, канали, релізи), а що потребує мене — запиши як відкриті питання. Коротко скажи, що змінив.`}>Джері, добудуй карту</AskAssistant>
      </div>
    </div>
  );
}
