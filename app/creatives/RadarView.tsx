// AI-радар: картки «що нового → що дає нам → оцінка» по 6 напрямках. Повний — у Розвиток → Радар, креативний зріз — у Креативах.
import Link from "next/link";
import { creativeToolsAction, radarDecideAction } from "@/app/creatives/actions";
import Icon from "@/components/Icon";
import ListPop from "@/components/ListPop";
import Markdown from "@/components/Markdown";
import Pop from "@/components/Pop";
import SubmitButton from "@/components/SubmitButton";
import { autoOn } from "@/lib/agent/caps";
import { radarRepos, radarRunning, radarSources } from "@/lib/aiRadar";
import { fmtDate } from "@/lib/dates";
import { RADAR_AREAS, type RadarArea } from "@/lib/radarConfig";
import { FORMATS } from "@/lib/creativeLab";
import { getStyle, listRadar, radarNewCount, type RadarItem } from "@/lib/repo/creativeCenter";
import { getSetting } from "@/lib/repo/settings";
import RadarLink from "./RadarLink";
import RadarMap from "./RadarMap";
import RadarRun from "./RadarRun";

const SENT: Record<string, string> = { style: "у стилі креативів", idea: "в ідеях", plan: "у плані розвитку", ok: "корисно" };
const kindShort = (k: string) => (k === "general" ? "Загальне" : (FORMATS[k as keyof typeof FORMATS] ?? k).split(" (")[0]);

export default function RadarView({ area, base, full }: { area?: RadarArea; base: string; full?: boolean }) {
  const fresh = listRadar("new", 80, area).sort((a, b) => b.score - a.score || b.id - a.id);
  const done = listRadar(undefined, 120, area).filter((r) => r.status !== "new");
  const last = getSetting("radar.last_at");
  const map = full ? getSetting("radar.map") ?? "" : "";
  const sep = base.includes("?") ? "&" : "?";
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="card cc-radar-head">
        <div className="stack" style={{ gap: "0.25rem", minWidth: 0 }}>
          <b>AI-радар{area && !full ? ` · ${RADAR_AREAS[area].label}` : ""}</b>
          <span className="mono">6 напрямків: {Object.values(RADAR_AREAS).map((a) => a.label).join(", ")}. {autoOn("ai_radar") ? "Сам — раз на 3 дні." : "Автозапуск вимкнено (Налаштування → Можливості)."} Останній прогін: {last ? fmtDate(last) : "ще не було"}.</span>
        </div>
        <div className="inline" style={{ flexWrap: "wrap" }}>
          <RadarRun running={radarRunning()} error={getSetting("radar.error") ?? ""} area={area} />
          <Pop wide title="Що читає радар" trigger={<span className="h-link">Джерела</span>}>
            <form action={creativeToolsAction} className="stack" style={{ gap: "0.5rem" }}>
              <label className="mono">Блоги, ченджлоги, розсилки — Джері шукає по них (по рядку: назва — адреса)</label>
              <textarea name="sources" defaultValue={radarSources()} style={{ minHeight: "12rem" }} />
              <label className="mono">Репозиторії GitHub, за якими стежимо (по рядку, owner/name). Плюс сам — що найшвидше росте за тиждень. Потрібен підключений GitHub.</label>
              <textarea name="repos" defaultValue={radarRepos().join("\n")} style={{ minHeight: "7rem" }} />
              <span className="mono">Hacker News (топ-обговорення) — завжди. X, Telegram-канали і YouTube автоматично не читаються — кидай посилання нижче або Джері.</span>
              <div><SubmitButton className="small">Зберегти</SubmitButton></div>
            </form>
          </Pop>
        </div>
      </div>

      {full && (
        <div className="rd-top">
          <RadarLink />
          <Pop wide className="pop-card rd-map" title="Карта ринку" sub={getSetting("radar.map_at") ? `складено ${fmtDate(getSetting("radar.map_at")!)}` : undefined} trigger={
            <>
              <span className="qt-h"><span className="qt-t"><span className="qt-ico"><Icon name="compass" /></span><b>Карта ринку</b></span></span>
              <span className="qt-l">{map ? map.split("\n").find((l) => /^[-*]\s/.test(l))?.replace(/^[-*]\s*/, "").replace(/\*\*/g, "").slice(0, 140) : "Де зараз гра, що стало стандартом, 3 ідеї продуктів — раз на місяць"}</span>
              <span className="qt-more">{map ? "відкрити →" : "скласти →"}</span>
            </>
          }>
            {map ? <Markdown md={map} /> : <p className="mono">Ще не складена. Джері складе сам раз на місяць з карток радару, або натисни нижче.</p>}
            <RadarMap />
          </Pop>
        </div>
      )}

      {full && (
        <nav className="rd-areas">
          <Link href={base} className={!area ? "on" : ""}>Усі{radarNewCount() ? <b>{radarNewCount()}</b> : null}</Link>
          {(Object.keys(RADAR_AREAS) as RadarArea[]).map((k) => (
            <Link key={k} href={`${base}${sep}a=${k}`} className={area === k ? "on" : ""}><Icon name={RADAR_AREAS[k].ico} size={14} /> {RADAR_AREAS[k].label}{radarNewCount(k) ? <b>{radarNewCount(k)}</b> : null}</Link>
          ))}
        </nav>
      )}

      {fresh.length ? <div className="cc-cards">{fresh.map((r) => <RadarCard key={r.id} r={r} showArea={full && !area} />)}</div> : <p className="mono">Нових карток нема. Натисни «Перевірити зараз», кинь посилання або дочекайся автопрогону.</p>}
      {done.length > 0 && (
        <div className="qt-grid">
          <ListPop title="Взяли" ico="check" tone="good" items={done.filter((r) => r.status === "accepted").map((r) => `${fmtDate(r.created_at)} · ${r.title}${SENT[r.sent_to] ? ` — ${SENT[r.sent_to]}` : ""}`)} empty="Нема" />
          <ListPop title="Пропущені" ico="flag" items={done.filter((r) => r.status === "skipped").map((r) => `${fmtDate(r.created_at)} · ${r.title}`)} empty="Нема" />
        </div>
      )}
    </div>
  );
}

function RadarCard({ r, showArea }: { r: RadarItem; showArea?: boolean }) {
  const st = r.hint_style_id ? getStyle(r.hint_style_id) : undefined;
  const A = RADAR_AREAS[r.area as RadarArea];
  return (
    <div className={`card cc-card${r.score >= 5 ? " rd-hot" : ""}`}>
      <div className="cs-top">
        <span className="cs-code">{showArea && A ? A.label : r.source || "радар"}</span>
        <span className="rd-score" title="Наскільки змінює гру">{"★".repeat(Math.max(0, Math.min(5, r.score)))}<i>{"★".repeat(5 - Math.max(0, Math.min(5, r.score)))}</i></span>
      </div>
      <b>{r.title}</b>
      {r.what && <p className="cc-p">{r.what}</p>}
      {r.how && <p className="cc-p"><b>Що дає нам:</b> {r.how}</p>}
      <span className="cs-fmt">{showArea && r.source ? `${r.source} · ` : ""}{fmtDate(r.created_at)}{r.url && <> · <a href={r.url} target="_blank" rel="noreferrer" className="h-link">джерело ↗</a></>}</span>
      <form action={radarDecideAction} className="stack" style={{ gap: "0.5rem", marginTop: "auto" }}>
        <input type="hidden" name="radar_id" value={r.id} />
        {r.hint_body && (
          <>
            <span className="mono">{st ? `Дописати в стиль «${st.title}»:` : `Новий шаблон стилю «${r.hint_title || r.title}» (${kindShort(r.hint_kind || "general")}):`}</span>
            {st && <input type="hidden" name="style_id" value={st.id} />}
            <textarea name="add" defaultValue={r.hint_body} style={{ minHeight: "4.5rem" }} />
          </>
        )}
        <div className="inline" style={{ flexWrap: "wrap" }}>
          {r.hint_body && <button name="op" value="style" className="small">В стиль креативів</button>}
          <button name="op" value="idea" className={r.hint_body ? "ghost small" : "small"}>В ідеї</button>
          <button name="op" value="plan" className="ghost small">В план</button>
          <button name="op" value="ok" className="ghost small">Корисно ✓</button>
          <button name="op" value="skip" className="ghost small">Пропустити</button>
        </div>
      </form>
    </div>
  );
}
