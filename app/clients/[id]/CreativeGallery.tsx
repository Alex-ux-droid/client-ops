"use client";
import { useEffect, useState } from "react";

export type GalleryItem = {
  id: string; name: string; img: string; kind: string; cards: string[]; body: string; preview: string; status: string; active: boolean; where: string;
  stats: { l: string; v: string }[];
  verdicts: { tone: string; text: string }[];
  opinion: string;
};

// Плитки креативів: наведення — збільшення (як док на Mac), клік — на весь екран; клік повз або Esc — закрити, стрілки — гортати
export default function CreativeGallery({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [card, setCard] = useState(0);
  const it = open == null ? null : items[open];

  useEffect(() => {
    if (open == null) return;
    document.documentElement.classList.add("locked");
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") { setOpen((i) => (i == null ? i : (i + 1) % items.length)); setCard(0); }
      if (e.key === "ArrowLeft") { setOpen((i) => (i == null ? i : (i - 1 + items.length) % items.length)); setCard(0); }
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); document.documentElement.classList.remove("locked"); };
  }, [open, items.length]);

  const go = (d: number) => { setOpen((i) => (i == null ? i : (i + d + items.length) % items.length)); setCard(0); };
  const main = it ? (it.cards.length > 1 ? it.cards[card] ?? it.img : it.img) : "";
  const tone = (v: GalleryItem["verdicts"]) => (v.some((x) => x.tone === "bad") ? "bad" : v.some((x) => x.tone === "good") ? "good" : v.some((x) => x.tone === "warn") ? "warn" : "");

  return (
    <>
      <div className="cg-grid">
        {items.map((x, i) => (
          <button key={x.id} type="button" className={`cg-tile ${tone(x.verdicts)}`} onClick={() => { setOpen(i); setCard(0); }} title={x.name}>
            <span className="cg-thumb">
              {x.img ? <img src={x.img} alt={x.name} loading="lazy" referrerPolicy="no-referrer" /> : <span className="cg-ph" />}
              {x.kind === "video" && <span className="cg-badge">▶</span>}
              {x.cards.length > 1 && <span className="cg-badge">{x.cards.length}</span>}
            </span>
            <span className="cg-cap">
              <b>{x.name}</b>
              <span>{x.stats[0].v} · {x.stats[2].v} лід. · {x.stats[3].v}</span>
              <em className={tone(x.verdicts)}>{x.verdicts[0]?.text}</em>
            </span>
          </button>
        ))}
      </div>

      {it && (
        <div className="cg-over" onClick={() => setOpen(null)} role="dialog" aria-modal>
          <button type="button" className="cg-nav prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Попередній">‹</button>
          <div className="cg-box" onClick={(e) => e.stopPropagation()}>
            <div className="cg-media">
              {main ? <img src={main} alt={it.name} referrerPolicy="no-referrer" /> : <span className="cg-ph" />}
              {it.cards.length > 1 && (
                <div className="cg-cards">
                  {it.cards.map((u, i) => (
                    <button key={i} type="button" className={i === card ? "on" : ""} onClick={() => setCard(i)}><img src={u} alt="" referrerPolicy="no-referrer" /></button>
                  ))}
                </div>
              )}
            </div>
            <div className="cg-side">
              <div className="cg-side-head">
                <div style={{ minWidth: 0 }}>
                  <b>{it.name}</b>
                  {it.where && <small>{it.where}</small>}
                </div>
                <button type="button" className="ghost small" onClick={() => setOpen(null)} aria-label="Закрити">✕</button>
              </div>
              <div className="cg-tags">
                <span className={`tag ${it.active ? "ok" : ""}`}>{it.status}</span>
                {it.kind === "video" && <span className="tag">відео</span>}
                {it.cards.length > 1 && <span className="tag">карусель · {it.cards.length}</span>}
              </div>
              <div className="cg-stats">{it.stats.map((s) => <div key={s.l}><b>{s.v}</b><span>{s.l}</span></div>)}</div>
              <ul className="cg-verdicts">{it.verdicts.map((v) => <li key={v.text} className={v.tone}>{v.text}</li>)}</ul>
              {it.opinion && <div className="cg-opinion"><b>Думка Джері</b><p>{it.opinion}</p></div>}
              {it.body && <p className="cg-body">{it.body}</p>}
              {it.preview && <a href={it.preview} target="_blank" rel="noreferrer" className="cg-link">Як виглядає у Facebook ↗</a>}
            </div>
          </div>
          <button type="button" className="cg-nav next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Наступний">›</button>
        </div>
      )}
    </>
  );
}
