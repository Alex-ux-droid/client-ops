// Хронологія «змійкою»: блоки по порядку, лінія їх звʼязує, рядок за рядком туди-назад. Клік по блоку — попап з деталями.
import Markdown from "./Markdown";
import Pop from "./Pop";

export type TlItem = { id: number | string; at: string; title: string; body?: string; tag?: string; actions?: React.ReactNode };
const PER = 3;
const day = (t: string) => { const d = new Date(t.replace(" ", "T") + (t.length <= 19 ? "Z" : "")); return Number.isNaN(+d) ? t.slice(0, 10) : d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Kyiv" }); };
const firstLine = (s = "") => {
  const l = s.replace(/\*\*/g, "").split("\n").map((x) => x.replace(/^[\s\-*•#>]+/, "").trim()).find(Boolean) ?? "";
  return l.replace(/^(До чого дійшли|Результат):\s*/i, "→ ");
};

export default function Timeline({ items, empty }: { items: TlItem[]; empty?: string }) {
  if (!items.length) return <p className="mono">{empty ?? "Поки порожньо."}</p>;
  if (items.length > 9) return <Stream items={items} />;
  const rows: TlItem[][] = [];
  for (let i = 0; i < items.length; i += PER) rows.push(items.slice(i, i + PER));
  return (
    <div className="tl">
      {rows.map((row, r) => {
        const rev = r % 2 === 1, last = r === rows.length - 1;
        const span = ((row.length - 1) / PER) * 100;
        const line: React.CSSProperties = rev ? { right: `${50 / PER}%`, width: `${span}%` } : { left: `${50 / PER}%`, width: `${span}%` };
        return (
          <div key={r} className={`tl-row${rev ? " rev" : ""}${last ? " last" : ""}`}>
            {row.length > 1 && <i className="tl-line" style={line} />}
            {!last && <i className="tl-turn" style={rev ? { left: `${50 / PER}%` } : { right: `${50 / PER}%` }} />}
            {row.map((it, k) => {
              const n = r * PER + k + 1;
              return (
                <div key={it.id} className="tl-cell">
                  <Pop className="tl-node" title={it.title} sub={[day(it.at), it.tag].filter(Boolean).join(" · ")} trigger={
                    <>
                      <span className="tl-n">{n}</span>
                      <span className="tl-date">{day(it.at)}{it.tag ? ` · ${it.tag}` : ""}</span>
                      <span className="tl-title">{it.title}</span>
                      {it.body && <span className="tl-sub">{firstLine(it.body)}</span>}
                    </>
                  }>
                    {it.body ? <div className="tm-details"><Markdown md={it.body} /></div> : <p className="mono">Деталей нема.</p>}
                    {it.actions && <div className="inline" style={{ marginTop: "0.75rem" }}>{it.actions}</div>}
                  </Pop>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Довга хронологія: вертикальна стрічка по днях, нові зверху. Клік по етапу — попап.
function Stream({ items }: { items: TlItem[] }) {
  const numbered = items.map((it, i) => ({ ...it, n: i + 1 }));
  const days = new Map<string, typeof numbered>();
  for (const it of [...numbered].reverse()) { const k = day(it.at); days.set(k, [...(days.get(k) ?? []), it]); }
  return (
    <div className="ts">
      {[...days].map(([d, xs]) => (
        <div key={d} className="ts-day">
          <div className="ts-date"><span>{d}</span><small>{xs.length} {xs.length === 1 ? "етап" : xs.length < 5 ? "етапи" : "етапів"}</small></div>
          <div className="ts-items">
            {xs.map((it) => (
              <Pop key={it.id} className="ts-item" title={it.title} sub={[day(it.at), it.tag].filter(Boolean).join(" · ")} trigger={
                <>
                  <span className="ts-n">{it.n}</span>
                  <span className="ts-main"><b>{it.title}</b>{it.body && <span>{firstLine(it.body)}</span>}</span>
                  {it.tag && <span className="ts-tag">{it.tag}</span>}
                </>
              }>
                {it.body ? <div className="tm-details"><Markdown md={it.body} /></div> : <p className="mono">Деталей нема.</p>}
                {it.actions && <div className="inline" style={{ marginTop: "0.75rem" }}>{it.actions}</div>}
              </Pop>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
