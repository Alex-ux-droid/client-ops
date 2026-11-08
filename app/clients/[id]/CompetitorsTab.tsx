// Конкуренти клієнта: огляд (загрози, рівні, висновки), інтерактивна таблиця, картка конкурента з журналом спостережень
import Link from "next/link";
import { competitorFlagAction, competitorInsightsAction, competitorNoteAction, competitorSaveAction } from "@/app/competitors/actions";
import DataTable from "@/components/DataTable";
import Icon from "@/components/Icon";
import ListPop from "@/components/ListPop";
import Markdown from "@/components/Markdown";
import Pop from "@/components/Pop";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import { fmtDate } from "@/lib/dates";
import { COMP_FIELDS, getCompetitor, listCompetitors, listNotes, NOTE_KINDS, recentNotes, THREAT, type CompField, type Competitor } from "@/lib/repo/competitors";
import { getSetting } from "@/lib/repo/settings";
import { CompCheck, CompImport } from "./CompetitorsClient";

const siteUrl = (s: string) => { const first = s.split(/[,\s]+/).find((x) => /\.[a-z]{2,}/i.test(x)) ?? ""; return first ? (/^https?:/.test(first) ? first : `https://${first}`) : ""; };
const tl = (t: string) => THREAT[t as keyof typeof THREAT];

function CompForm({ clientId, c }: { clientId: number; c?: Competitor }) {
  const long: CompField[] = ["what", "why", "pros", "cons", "numbers", "action"];
  return (
    <form action={competitorSaveAction} className="stack" style={{ gap: "0.5rem" }}>
      <input type="hidden" name="client_id" value={clientId} />
      {c && <input type="hidden" name="competitor_id" value={c.id} />}
      <div className="mk-form">
        {(Object.keys(COMP_FIELDS) as CompField[]).filter((k) => !long.includes(k)).map((k) => k === "threat"
          ? <select key={k} name="threat" defaultValue={c?.threat ?? ""} aria-label="Загроза"><option value="">Загроза: —</option>{Object.entries(THREAT).map(([v, x]) => <option key={v} value={v}>Загроза: {x.label}</option>)}</select>
          : <input key={k} name={k} defaultValue={c?.[k] ?? ""} required={k === "name"} placeholder={COMP_FIELDS[k]} aria-label={COMP_FIELDS[k]} />)}
        {long.map((k) => <VoiceTextarea key={k} name={k} defaultValue={c?.[k] ?? ""} placeholder={COMP_FIELDS[k]} aria-label={COMP_FIELDS[k]} style={{ minHeight: "3.5rem" }} className="wide" />)}
      </div>
      <div><SubmitButton className="small">{c ? "Зберегти" : "Додати конкурента"}</SubmitButton></div>
    </form>
  );
}

export default function CompetitorsTab({ clientId, sel, lv }: { clientId: number; sel?: string; lv?: string }) {
  const one = sel ? getCompetitor(Number(sel)) : undefined;
  if (one && one.client_id === clientId) return <CompetitorCard c={one} />;
  const all = listCompetitors(clientId);
  const arch = listCompetitors(clientId, true);
  const levels = [...new Set(all.map((c) => c.level).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uk", { numeric: true }));
  // За замовчуванням — тільки «висока загроза» (якщо такі є); «Усі» — lv=all
  const highOnly = !lv && all.some((c) => c.threat === "high");
  const rows = highOnly ? all.filter((c) => c.threat === "high") : lv && lv !== "all" ? all.filter((c) => c.level === lv) : all;
  const watched = all.filter((c) => c.watch).length;
  const n = (t: string) => all.filter((c) => c.threat === t).length;
  const insights = getSetting(`comp.insights.${clientId}`) ?? "";
  const levelsMd = getSetting(`comp.levels.${clientId}`) ?? "";
  const notes = recentNotes(clientId, 12);
  const base = `/clients/${clientId}?tab=competitors`;
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="ov-kpis">
        <div className="kpi-tile"><div className="kpi-label"><Icon name="users" size={15} /> Конкурентів</div><div className="kpi-value">{all.length}</div><div className="kpi-sub">{levels.length} рівнів{arch.length ? ` · в архіві ${arch.length}` : ""}</div></div>
        <div className="kpi-tile"><div className="kpi-label"><Icon name="alert" size={15} /> Висока загроза</div><div className="kpi-value" style={{ color: n("high") ? "var(--bad)" : undefined }}>{n("high")}</div><div className="kpi-sub">середня {n("mid")} · низька {n("low")}</div></div>
        <div className="kpi-tile"><div className="kpi-label"><Icon name="zap" size={15} /> Під наглядом</div><div className="kpi-value">{all.filter((c) => c.watch).length}</div><div className="kpi-sub">Джері перевіряє раз на тиждень</div></div>
        <div className="kpi-tile"><div className="kpi-label"><Icon name="clock" size={15} /> Спостережень</div><div className="kpi-value">{notes.length}</div><div className="kpi-sub">{notes[0] ? `останнє ${fmtDate(notes[0].created_at)}` : "ще не було"}</div></div>
      </div>

      <div className="qt-grid">
        <ListPop title="Найнебезпечніші" ico="alert" tone="bad" items={all.filter((c) => c.threat === "high").map((c) => `${c.name}${c.action ? ` — ${c.action}` : ""}`)} empty="Нема з високою загрозою" />
        <Pop wide className="pop-card qt qt-accent" title="Висновки для клієнта" trigger={<><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="sparkles" /></span><b>Висновки</b></span><span className="qt-n">{insights.split("\n").filter(Boolean).length}</span></span>{insights ? insights.split("\n").filter(Boolean).slice(0, 2).map((l, i) => <span key={i} className="qt-l">{l.replace(/^- /, "")}</span>) : <span className="qt-l mono">додати →</span>}</>}>
          <form action={competitorInsightsAction} className="stack" style={{ gap: "0.5rem" }}>
            <input type="hidden" name="client_id" value={clientId} />
            <VoiceTextarea name="insights" defaultValue={insights} placeholder="- що з цього випливає для клієнта" style={{ minHeight: "14rem" }} />
            <div><SubmitButton className="small">Зберегти</SubmitButton></div>
          </form>
        </Pop>
        {levelsMd && <Pop wide className="pop-card qt" title="Рівні конкурентів" trigger={<><span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="layers" /></span><b>Рівні</b></span><span className="qt-n">{levels.length}</span></span><span className="qt-l">хто це і чому конкурують →</span></>}><Markdown md={levelsMd} /></Pop>}
        <ListPop title="Свіжі спостереження" ico="clock" items={notes.map((x) => `${fmtDate(x.created_at)} · ${x.comp}: ${x.text.replace(/\s+/g, " ").slice(0, 160)}`)} empty="Постав конкурентів «під нагляд» або натисни «Перевірити» в картці" />
      </div>

      <div className="inline" style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
        <nav className="rd-areas">
          {all.some((c) => c.threat === "high") && <Link href={base} className={highOnly ? "on" : ""}>Висока загроза <b>{all.filter((c) => c.threat === "high").length}</b></Link>}
          <Link href={`${base}&lv=all`} className={lv === "all" || (!lv && !highOnly) ? "on" : ""}>Усі <b>{all.length}</b></Link>
          {levels.map((l) => <Link key={l} href={`${base}&lv=${encodeURIComponent(l)}`} className={lv === l ? "on" : ""}>{l} <b>{all.filter((c) => c.level === l).length}</b></Link>)}
        </nav>
        <Pop wide className="pop-trigger pop-inline" title="Новий конкурент" trigger={<span className="btn small">+ Конкурент</span>}><CompForm clientId={clientId} /></Pop>
      </div>

      {all.length > 0 && watched < 5 && <div className="mono">Підказка: постав топ-5 найнебезпечніших «під нагляд» (картка → «Нагляд») — Джері перевірятиме їх раз на тиждень. Зараз під наглядом: {watched}.</div>}
      {/* 5 колонок на виду, решта — «Колонки ▾» */}
      <DataTable id="competitors-v2" search cols={[
        { id: "name", label: "Компанія", w: 260, pin: true }, { id: "threat", label: "Загроза", w: 110 }, { id: "level", label: "Рівень", w: 200, hide: true },
        { id: "region", label: "Регіон", w: 160, hide: true }, { id: "scale", label: "Масштаб", w: 110, hide: true }, { id: "what", label: "Що роблять", w: 280 },
        { id: "for_whom", label: "Для кого", w: 200, hide: true }, { id: "pros", label: "Переваги", w: 260, hide: true }, { id: "cons", label: "Мінуси", w: 260, hide: true },
        { id: "numbers", label: "Цифри / ціни", w: 220, hide: true }, { id: "action", label: "Що робимо", w: 300 }, { id: "watch", label: "Нагляд", w: 100 },
        { id: "last", label: "Остання перевірка", w: 150, hide: true }, { id: "site", label: "Сайт", w: 200, hide: true }, { id: "why", label: "Чому конкурент", w: 260, hide: true },
      ]} rows={rows.map((c) => ({ key: String(c.id), cells: {
        name: { v: c.name, href: `${base}&c=${c.id}`, sub: c.site || undefined },
        threat: { v: c.threat === "high" ? 0 : c.threat === "mid" ? 1 : c.threat === "low" ? 2 : 3, t: tl(c.threat)?.label ?? "—", tag: c.threat === "high" ? "bad" : c.threat === "mid" ? "warn" : "" },
        level: c.level, region: c.region, scale: c.scale, what: c.what, for_whom: c.for_whom, pros: c.pros, cons: c.cons, numbers: c.numbers, action: c.action,
        watch: { v: c.watch, t: c.watch ? "👁 так" : "—" }, last: { v: c.checked_at ?? "", t: c.checked_at ? fmtDate(c.checked_at) : "—" },
        site: { v: c.site, href: siteUrl(c.site) || undefined }, why: c.why,
      } }))} empty="Конкурентів ще нема — імпортуй Excel або додай вручну" />

      <CompImport clientId={clientId} />
      {arch.length > 0 && <ListPop title="Архів" ico="flag" items={arch.map((c) => c.name)} />}
    </div>
  );
}

function CompetitorCard({ c }: { c: Competitor }) {
  const notes = listNotes(c.id);
  const url = siteUrl(c.site);
  const t = tl(c.threat);
  const flag = (op: string, label: string, cls = "ghost small") => (
    <form action={competitorFlagAction}><input type="hidden" name="competitor_id" value={c.id} /><button name="op" value={op} className={cls}>{label}</button></form>
  );
  const show: CompField[] = ["what", "for_whom", "why", "pros", "cons", "numbers", "action", "checked"];
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <Link href={`/clients/${c.client_id}?tab=competitors`} className="h-link">← Усі конкуренти</Link>
      <div className="card bb-hero">
        <div className="stack" style={{ gap: "0.375rem", flex: 1, minWidth: 0 }}>
          <span className="inline" style={{ flexWrap: "wrap" }}>{t && <span className={`tag ${c.threat === "high" ? "bad" : c.threat === "mid" ? "warn" : ""}`}>Загроза: {t.label}</span>}{c.level && <span className="tag">{c.level}</span>}{c.watch ? <span className="tag accent">👁 під наглядом</span> : null}</span>
          <b className="bb-name">{c.name}</b>
          <span className="mono">{[c.region, c.scale].filter(Boolean).join(" · ")}{url && <> · <a href={url} target="_blank" rel="noreferrer" className="h-link">{c.site} ↗</a></>}</span>
        </div>
        <div className="bb-acts">
          <CompCheck id={c.id} />
          <div className="inline">{flag("watch", c.watch ? "Зняти з нагляду" : "👁 Під нагляд")}<Pop wide className="pop-trigger pop-inline" title={`Редагувати: ${c.name}`} trigger={<span className="btn ghost small">Редагувати</span>}><CompForm clientId={c.client_id} c={c} /></Pop></div>
          <div className="inline">{flag("archive", c.archived ? "З архіву" : "В архів")}{flag("delete", "Видалити", "ghost small danger-text")}</div>
        </div>
      </div>
      <div className="bb-grid">
        {show.filter((k) => c[k]).map((k) => (
          <div key={k} className={`card stack cmp-f${k === "action" ? " cmp-act" : ""}`} style={{ gap: "0.375rem" }}>
            <b>{COMP_FIELDS[k]}</b>
            <span className="cc-p" style={{ whiteSpace: "pre-line" }}>{c[k]}</span>
          </div>
        ))}
      </div>
      <section className="card stack" style={{ gap: "0.75rem" }}>
        <div className="bb-h"><b>Журнал спостережень</b><span className="mono">що змінилось, ціни, реклама, нові послуги — твоє і від Джері</span></div>
        <form action={competitorNoteAction} className="inline bb-add" style={{ flexWrap: "wrap" }}>
          <input type="hidden" name="competitor_id" value={c.id} />
          <select name="kind" defaultValue="note" aria-label="Що це">{Object.entries(NOTE_KINDS).filter(([k]) => k !== "check").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input name="text" required placeholder="Що помітив: напр. «запустили рекламу на ФОП, оффер — безкоштовна консультація»" style={{ flex: 3, minWidth: "14rem" }} />
          <input name="url" placeholder="Посилання" style={{ flex: 1, minWidth: "8rem" }} />
          <SubmitButton className="small">Записати</SubmitButton>
        </form>
        {notes.length ? <div className="stack" style={{ gap: "0.5rem" }}>{notes.map((x) => (
          <div key={x.id} className="cmp-note">
            <span className="mono">{fmtDate(x.created_at)} · {NOTE_KINDS[x.kind as keyof typeof NOTE_KINDS] ?? x.kind}{x.source === "jerry" ? " · Джері" : ""}</span>
            <Markdown md={x.text} />
            <span className="inline">{x.url && <a href={x.url} target="_blank" rel="noreferrer" className="h-link">джерело ↗</a>}<form action={competitorNoteAction}><input type="hidden" name="competitor_id" value={c.id} /><button name="delete" value={x.id} className="bb-x" aria-label="Видалити">×</button></form></span>
          </div>
        ))}</div> : <p className="mono" style={{ margin: 0 }}>Ще нема. «Перевірити зараз» — Джері подивиться сайт і новини.</p>}
      </section>
    </div>
  );
}
