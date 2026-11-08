// Центр креативів: огляд по всіх клієнтах, мій стиль (шаблони, що йдуть у кожен промпт) і AI-радар.
import Link from "next/link";
import DataTable from "@/components/DataTable";
import { creativeToolsAction, styleSaveAction } from "@/app/creatives/actions";
import AskAssistant from "@/components/AskAssistant";
import Icon from "@/components/Icon";
import ListPop from "@/components/ListPop";
import Pop from "@/components/Pop";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";

import { creativeTools } from "@/lib/aiRadar";
import { money } from "@/lib/config";
import { FORMATS } from "@/lib/creativeLab";
import { adBook, creativeNums, syncCodes, VERDICT } from "@/lib/creativeStudio";
import { fmtDate } from "@/lib/dates";
import { listClients } from "@/lib/repo/clients";
import { listRadar, listStyles, radarNewCount, type CStyle } from "@/lib/repo/creativeCenter";
import { codeOf, listPrompts } from "@/lib/repo/creatives";

import RadarView from "./RadarView";

export const dynamic = "force-dynamic";

const KINDS: Record<string, string> = { general: "Загальне (усі формати)", ...FORMATS };
const kindShort = (k: string) => (k === "general" ? "Загальне" : (FORMATS[k as keyof typeof FORMATS] ?? k).split(" (")[0]);

export default async function CreativesCenter({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v = "overview" } = await searchParams;
  const fresh = radarNewCount("creatives");
  return (
    <>
      <div className="head">
        <div>
          <h1>Креативи</h1>
          <div className="row-sub">Центр креативів: що працює в усіх клієнтів, мій стиль (іде в кожен промпт) і AI-радар — що нового в AI для реклами.</div>
        </div>
        <div className="inline">
          <AskAssistant text="Подивись креативи всіх клієнтів (creative_prompt list по кожному) і мій стиль (creative_styles). Що працює, що повторити, де бракує креативів? Коротко, пунктами.">Джері, що робити з креативами?</AskAssistant>
        </div>
      </div>
      <nav className="mx-tabs" style={{ marginBottom: "1rem" }}>
        <Link href="/creatives" className={v === "overview" ? "on" : ""}>Огляд</Link>
        <Link href="/creatives?v=style" className={v === "style" ? "on" : ""}>Мій стиль</Link>
        <Link href="/creatives?v=radar" className={v === "radar" ? "on" : ""}>AI-радар{fresh ? <b className="cc-badge">{fresh}</b> : null}</Link>
      </nav>
      {v === "style" ? <Styles /> : v === "radar" ? <RadarView area="creatives" base="/creatives?v=radar" /> : <Overview />}
    </>
  );
}

function Overview() {
  const rows = listClients().filter((c) => c.status !== "archived").map((c) => {
    syncCodes(c.id);
    const book = adBook(c.id);
    const list = listPrompts(c.id, 300).map((p) => ({ p, n: creativeNums(p, book) }));
    return { c, book, list };
  }).filter((r) => r.list.length || r.book.ads.length);
  const all = rows.flatMap((r) => r.list.map((x) => ({ ...x, c: r.c, avg: r.book.avgCpl })));
  const count = (st: string) => all.filter((x) => x.p.status === st).length;
  const wins = all.filter((x) => x.n.verdict === "win");
  // Що працює за форматами: скільки з вердиктом, скільки виграло, ціна ліда відносно середньої клієнта
  const byFmt = new Map<string, { n: number; win: number; lose: number; rel: number[] }>();
  for (const x of all) {
    if (!x.n.verdict || x.n.verdict === "few") continue;
    const k = x.p.format.split(" (")[0] || "—";
    const f = byFmt.get(k) ?? { n: 0, win: 0, lose: 0, rel: [] };
    f.n++; if (x.n.verdict === "win") f.win++; if (x.n.verdict === "lose") f.lose++;
    if (x.n.cpl != null && x.avg) f.rel.push(x.n.cpl / x.avg);
    byFmt.set(k, f);
  }
  const fmts = [...byFmt.entries()].sort((a, b) => b[1].win / b[1].n - a[1].win / a[1].n);
  const radar = listRadar("new", 3, "creatives");
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="ov-kpis">
        <div className="kpi-tile"><div className="kpi-label"><Icon name="sparkles" size={15} /> В роботі</div><div className="kpi-value">{count("idea") + count("ready")}</div><div className="kpi-sub">ідеї {count("idea")} · зроблено {count("ready")}</div></div>
        <div className="kpi-tile"><div className="kpi-label"><Icon name="megaphone" size={15} /> У рекламі</div><div className="kpi-value">{count("live")}</div><div className="kpi-sub">з кодом CR-N у назві</div></div>
        <div className="kpi-tile"><div className="kpi-label"><Icon name="flag" size={15} /> Переможці</div><div className="kpi-value" style={{ color: wins.length ? "var(--ok)" : undefined }}>{wins.length}</div><div className="kpi-sub">ціна ліда ≤ 80% середньої</div></div>
        <Link href="/creatives?v=radar" className="kpi-tile"><div className="kpi-label"><Icon name="zap" size={15} /> AI-радар</div><div className="kpi-value">{radarNewCount("creatives")}</div><div className="kpi-sub">нових карток</div></Link>
      </div>

      <div className="cc-clients">
        {rows.map(({ c, list, book }) => {
          const best = list.filter((x) => x.n.verdict === "win" || x.n.verdict === "mid").sort((a, b) => (a.n.cpl ?? 1e9) - (b.n.cpl ?? 1e9))[0];
          const st = (s: string) => list.filter((x) => x.p.status === s).length;
          return (
            <Link key={c.id} href={`/clients/${c.id}?tab=meta_ads&mv=campaigns`} className="card cc-client">
              <b>{c.name}</b>
              <span className="cc-row"><span>ідеї <b>{st("idea")}</b></span><span>зроблено <b>{st("ready")}</b></span><span>у рекламі <b>{st("live")}</b></span></span>
              <span className="cs-fmt">{best ? `★ ${codeOf(best.p)} ${best.p.title} — ${money(best.n.cpl)} за лід` : list.length ? "переможця ще нема" : "креативів ще нема — почни з контексту клієнта"}</span>
              {book.avgCpl != null && <span className="cs-fmt">середня ціна ліда {money(book.avgCpl)}</span>}
            </Link>
          );
        })}
        {!rows.length && <p className="mono">Клієнтів з рекламою ще нема.</p>}
      </div>

      <div className="qt-grid">
        <ListPop title="Переможці всіх клієнтів" ico="sparkles" tone="good" items={wins.map((x) => `${x.c.name}: ${codeOf(x.p)} ${x.p.title} — ${money(x.n.cpl)} за лід`)} empty="Ще нема" />
        <Pop className="pop-card qt" title="Що працює за форматами" trigger={
          <>
            <span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="layers" /></span><b>Формати</b></span><span className="qt-n">{fmts.length}</span></span>
            {fmts.length ? fmts.slice(0, 2).map(([k, f]) => <span key={k} className="qt-l">{k}: {f.win} з {f.n} виграли</span>) : <span className="qt-l mono">Зʼявиться, коли креативи наберуть ліди</span>}
          </>
        }>
          {fmts.length ? (
            <DataTable id="creatives-formats" cols={[
              { id: "f", label: "Формат", w: 220, pin: true }, { id: "n", label: "З результатом", num: true, w: 140 }, { id: "win", label: "Виграли", num: true, w: 110 },
              { id: "lose", label: "Програли", num: true, w: 110 }, { id: "rel", label: "Ціна ліда до середньої", num: true, w: 190 },
            ]} rows={fmts.map(([k, f]) => { const rel = f.rel.length ? f.rel.reduce((x, y) => x + y, 0) / f.rel.length : null; return { key: k, cells: {
              f: k, n: f.n, win: { v: f.win, tone: f.win ? "good" : undefined }, lose: { v: f.lose, tone: f.lose ? "bad" : undefined },
              rel: { v: rel, t: rel == null ? "—" : `${Math.round(rel * 100)}%`, tone: rel == null ? undefined : rel <= 0.9 ? "good" : rel >= 1.2 ? "bad" : undefined },
            } }; })} />
          ) : <p className="mono">Ще нема креативів з вердиктом.</p>}
        </Pop>
        <ListPop title="Свіже з AI-радару" ico="zap" tone="accent" items={radar.map((r) => r.title)} empty="Нових карток нема" />
      </div>
    </div>
  );
}

function StyleForm({ s }: { s?: CStyle }) {
  return (
    <form action={styleSaveAction} className="stack" style={{ gap: "0.5rem" }}>
      {s && <input type="hidden" name="style_id" value={s.id} />}
      <input type="hidden" name="active_present" value="1" />
      <div className="mk-form">
        <select name="kind" defaultValue={s?.kind ?? "general"} aria-label="Для чого">{Object.entries(KINDS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        <input name="title" defaultValue={s?.title} required placeholder="Назва: напр. «Моушен: мій стиль»" />
        <VoiceTextarea name="body" defaultValue={s?.body} placeholder={"- пункт правила\n- ще пункт"} style={{ minHeight: "9rem" }} className="wide" />
      </div>
      <label className="lp-check"><input type="checkbox" name="active" value="1" defaultChecked={s ? !!s.active : true} /> Активний — іде в промпти</label>
      <div className="inline">
        <SubmitButton className="small">{s ? "Зберегти" : "Додати шаблон"}</SubmitButton>
        {s && <button name="delete" value="1" className="ghost small danger-text">Видалити</button>}
      </div>
    </form>
  );
}

function Styles() {
  const styles = listStyles();
  const groups = [...new Set(styles.map((s) => s.kind))];
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <form action={creativeToolsAction} className="card stack" style={{ gap: "0.5rem" }}>
        <b>Чим робимо креативи</b>
        <span className="mono">Іде в кожен промпт і в AI-радар — щоб писали під твої інструменти.</span>
        <div className="inline" style={{ flexWrap: "wrap" }}>
          <input name="tools" defaultValue={creativeTools()} placeholder="Claude" style={{ flex: 1, minWidth: "14rem" }} />
          <SubmitButton className="small">Зберегти</SubmitButton>
        </div>
      </form>
      <p className="mono" style={{ margin: 0 }}>Активні шаблони самі додаються в «Контекст клієнта» (загальні) і в кожен промпт креативу (загальні + свого формату). Оновив шаблон — усі нові промпти вже по-новому.</p>
      <div className="cc-styles">
        {groups.map((k) => styles.filter((s) => s.kind === k).map((s) => (
          <Pop key={s.id} wide className={`pop-card cc-style${s.active ? "" : " off"}`} title={s.title} sub={`${KINDS[s.kind] ?? s.kind} · оновлено ${fmtDate(s.updated_at)}`} trigger={
            <>
              <span className="cs-top"><span className="cs-code">{kindShort(s.kind)}</span>{s.source === "radar" ? <span className="tag accent">з радару</span> : !s.active ? <span className="tag">вимкнено</span> : null}</span>
              <b className="cs-title">{s.title}</b>
              <span className="cc-prev">{s.body.split("\n").filter(Boolean).slice(0, 3).map((l, i) => <span key={i}>{l.replace(/^- /, "· ")}</span>)}</span>
            </>
          }>
            <StyleForm s={s} />
          </Pop>
        )))}
        <Pop wide className="pop-card cc-style cc-add" title="Новий шаблон" trigger={<><span className="qt-ico"><Icon name="sparkles" /></span><b>+ Новий шаблон</b><span className="cs-fmt">свій прийом, стиль бренду, формат</span></>}>
          <StyleForm />
        </Pop>
      </div>
    </div>
  );
}
