"use client";
// Дошка-детектив: стікери, заголовки, червоні нитки між ними. Перетягування, масштаб, автозбереження.
// Керування: подвійний клік по полю — новий стікер; тягни стікер — рухається; тягни від шпильки (кружечок зверху) до іншого стікера — нитка;
// подвійний клік по стікеру — текст; Delete — видалити вибране; колесо — гортати, Ctrl/щипок — масштаб.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Board as B, BoardEdge, BoardNode } from "@/lib/repo/strategyPath";
import { saveBoardAction } from "./actions";

const COLORS = ["yellow", "red", "green", "blue", "white"] as const;
const COLOR_NAME: Record<string, string> = { yellow: "Жовтий", red: "Червоний", green: "Зелений", blue: "Синій", white: "Білий" };
const uid = () => Math.random().toString(36).slice(2, 10);
type View = { x: number; y: number; k: number };
type Drag =
  | { t: "pan"; sx: number; sy: number; vx: number; vy: number }
  | { t: "node"; id: string; sx: number; sy: number; nx: number; ny: number; moved: boolean }
  | { t: "resize"; id: string; sx: number; w: number }
  | { t: "link"; from: string; x: number; y: number };

export default function Board({ clientId, name, initial, back }: { clientId: number; name: string; initial: B; back: string }) {
  const [nodes, setNodes] = useState<BoardNode[]>(initial.nodes);
  const [edges, setEdges] = useState<BoardEdge[]>(initial.edges);
  const [view, setView] = useState<View>({ x: 80, y: 80, k: 1 });
  const [sel, setSel] = useState<{ kind: "node" | "edge"; id: string } | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [color, setColor] = useState<string>("yellow");
  const [saved, setSaved] = useState<"ok" | "saving" | "err">("ok");
  const [drag, setDrag] = useState<Drag | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Автозбереження: через 0,8 с після останньої зміни
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaved("saving");
    const t = setTimeout(() => { saveBoardAction(clientId, { nodes, edges }).then((r) => setSaved(r.ok ? "ok" : "err")).catch(() => setSaved("err")); }, 800);
    return () => clearTimeout(t);
  }, [nodes, edges, clientId]);

  // Не даємо закрити вкладку, поки зберігається
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (saved === "saving") e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [saved]);

  // Блок прокрутки сторінки під дошкою
  useEffect(() => { document.documentElement.classList.add("locked"); return () => document.documentElement.classList.remove("locked"); }, []);

  // Перший показ: вмістити все на екран
  const fit = useCallback(() => {
    const el = box.current;
    if (!el || !nodes.length) { setView({ x: 80, y: 80, k: 1 }); return; }
    const minX = Math.min(...nodes.map((n) => n.x)), minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + n.w)), maxY = Math.max(...nodes.map((n) => n.y + 160));
    const k = Math.min(1.2, Math.max(0.25, Math.min((el.clientWidth - 120) / (maxX - minX || 1), (el.clientHeight - 120) / (maxY - minY || 1))));
    setView({ k, x: (el.clientWidth - (maxX - minX) * k) / 2 - minX * k, y: (el.clientHeight - (maxY - minY) * k) / 2 - minY * k });
  }, [nodes]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fit(); }, []);

  const toWorld = (cx: number, cy: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k };
  };
  const zoomAt = (cx: number, cy: number, f: number) => {
    const r = box.current!.getBoundingClientRect();
    setView((v) => {
      const k = Math.min(2.5, Math.max(0.2, v.k * f));
      const px = cx - r.left, py = cy - r.top;
      return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
    });
  };
  const zoomBtn = (f: number) => { const r = box.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, f); };

  const addNode = (kind: BoardNode["kind"], at?: { x: number; y: number }) => {
    const el = box.current!;
    const p = at ?? { x: (el.clientWidth / 2 - view.x) / view.k - 100, y: (el.clientHeight / 2 - view.y) / view.k - 50 };
    const n: BoardNode = { id: uid(), x: Math.round(p.x), y: Math.round(p.y), w: kind === "title" ? 360 : 200, text: "", color: kind === "title" ? "white" : color, kind };
    setNodes((xs) => [...xs, n]);
    setSel({ kind: "node", id: n.id });
    setEdit(n.id);
  };
  const removeSel = useCallback(() => {
    if (!sel) return;
    if (sel.kind === "node") { setNodes((xs) => xs.filter((n) => n.id !== sel.id)); setEdges((es) => es.filter((e) => e.from !== sel.id && e.to !== sel.id)); }
    else setEdges((es) => es.filter((e) => e.id !== sel.id));
    setSel(null);
  }, [sel]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (edit) { if (e.key === "Escape") setEdit(null); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); removeSel(); }
      if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [sel, edit, removeSel]);

  // Колесо: гортати; Ctrl / щипок трекпада — масштаб
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  });

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    const nodeEl = t.closest<HTMLElement>("[data-node]");
    if (t.closest("textarea")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (t.closest("[data-pin]") && nodeEl) {
      const w = toWorld(e.clientX, e.clientY);
      setDrag({ t: "link", from: nodeEl.dataset.node!, x: w.x, y: w.y });
      return;
    }
    if (t.closest("[data-resize]") && nodeEl) {
      const n = nodes.find((x) => x.id === nodeEl.dataset.node)!;
      setDrag({ t: "resize", id: n.id, sx: e.clientX, w: n.w });
      return;
    }
    if (nodeEl) {
      const n = nodes.find((x) => x.id === nodeEl.dataset.node)!;
      setSel({ kind: "node", id: n.id });
      if (edit !== n.id) setEdit(null);
      setDrag({ t: "node", id: n.id, sx: e.clientX, sy: e.clientY, nx: n.x, ny: n.y, moved: false });
      return;
    }
    const edgeEl = t.closest<SVGElement>("[data-edge]");
    if (edgeEl) { setSel({ kind: "edge", id: edgeEl.dataset.edge! }); setEdit(null); return; }
    setSel(null); setEdit(null);
    setDrag({ t: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    if (drag.t === "pan") setView((v) => ({ ...v, x: drag.vx + e.clientX - drag.sx, y: drag.vy + e.clientY - drag.sy }));
    else if (drag.t === "node") {
      const dx = (e.clientX - drag.sx) / view.k, dy = (e.clientY - drag.sy) / view.k;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      if (!drag.moved) setDrag({ ...drag, moved: true });
      setNodes((xs) => xs.map((n) => (n.id === drag.id ? { ...n, x: Math.round(drag.nx + dx), y: Math.round(drag.ny + dy) } : n)));
    } else if (drag.t === "resize") setNodes((xs) => xs.map((n) => (n.id === drag.id ? { ...n, w: Math.round(Math.min(900, Math.max(80, drag.w + (e.clientX - drag.sx) / view.k))) } : n)));
    else if (drag.t === "link") { const w = toWorld(e.clientX, e.clientY); setDrag({ ...drag, x: w.x, y: w.y }); }
  };
  const onUp = (e: React.PointerEvent) => {
    if (drag?.t === "link") {
      const target = document.elementsFromPoint(e.clientX, e.clientY).map((el) => (el as HTMLElement).closest?.("[data-node]") as HTMLElement | null).find(Boolean);
      const to = target?.dataset.node;
      if (to && to !== drag.from && !edges.some((x) => (x.from === drag.from && x.to === to) || (x.from === to && x.to === drag.from))) setEdges((es) => [...es, { id: uid(), from: drag.from, to }]);
    }
    setDrag(null);
  };
  const onDbl = (e: React.MouseEvent) => {
    // після захоплення вказівника ціль події — поле, тому дивимось, що реально під курсором
    const t = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null) ?? (e.target as HTMLElement);
    if (t.closest("textarea")) return;
    const nodeEl = t.closest<HTMLElement>("[data-node]");
    if (nodeEl) { setEdit(nodeEl.dataset.node!); return; }
    if (t.closest("[data-edge]")) return;
    const w = toWorld(e.clientX, e.clientY);
    addNode("note", { x: w.x - 100, y: w.y - 40 });
  };

  const node = (id: string) => nodes.find((n) => n.id === id);
  const pin = (n: BoardNode) => ({ x: n.x + n.w / 2, y: n.y + 6 });
  const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + Math.min(120, 24 + Math.hypot(b.x - a.x, b.y - a.y) * 0.12);
    return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
  };
  const selNode = sel?.kind === "node" ? node(sel.id) : undefined;
  const linking = drag?.t === "link" ? drag : null;

  return (
    <div className="dk">
      <div className="dk-bar">
        <Link href={back} className="btn ghost small">← Стратегія</Link>
        <b className="dk-name">Дошка · {name}</b>
        <span className="dk-sep" />
        <button type="button" className="small" onClick={() => addNode("note")}>+ Стікер</button>
        <button type="button" className="ghost small" onClick={() => addNode("title")}>+ Заголовок</button>
        <span className="dk-colors" role="group" aria-label="Колір">
          {COLORS.map((c) => (
            <button key={c} type="button" className={`dk-c dk-c-${c}${(selNode ? selNode.color : color) === c ? " on" : ""}`} title={COLOR_NAME[c]} aria-label={COLOR_NAME[c]}
              onClick={() => { setColor(c); if (selNode) setNodes((xs) => xs.map((n) => (n.id === selNode.id ? { ...n, color: c } : n))); }} />
          ))}
        </span>
        {sel && <button type="button" className="ghost small" onClick={removeSel}>Видалити</button>}
        <span className="grow" />
        <span className={`mono dk-saved ${saved}`}>{saved === "saving" ? "зберігаю…" : saved === "err" ? "не збереглось — спробую ще" : "збережено"}</span>
        <span className="dk-zoom">
          <button type="button" className="ghost small" onClick={() => zoomBtn(1 / 1.2)} aria-label="Зменшити">−</button>
          <button type="button" className="ghost small" onClick={fit} title="Показати все">{Math.round(view.k * 100)}%</button>
          <button type="button" className="ghost small" onClick={() => zoomBtn(1.2)} aria-label="Збільшити">+</button>
        </span>
      </div>
      <div ref={box} className={`dk-field${drag?.t === "pan" ? " grabbing" : ""}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)} onDoubleClick={onDbl}
        style={{ backgroundPosition: `${view.x}px ${view.y}px`, backgroundSize: `${24 * view.k}px ${24 * view.k}px` }}>
        <div className="dk-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <svg className="dk-strings" width="1" height="1">
            {edges.map((e) => {
              const a = node(e.from), b = node(e.to);
              if (!a || !b) return null;
              const d = curve(pin(a), pin(b));
              return (
                <g key={e.id} data-edge={e.id} className={sel?.kind === "edge" && sel.id === e.id ? "on" : ""}>
                  <path d={d} className="dk-hit" />
                  <path d={d} className="dk-str" />
                </g>
              );
            })}
            {linking && (() => { const a = node(linking.from); return a ? <path d={curve(pin(a), linking)} className="dk-str temp" /> : null; })()}
          </svg>
          {nodes.map((n) => (
            <div key={n.id} data-node={n.id} className={`dk-n dk-${n.kind} dk-c-${n.color}${sel?.kind === "node" && sel.id === n.id ? " on" : ""}`} style={{ left: n.x, top: n.y, width: n.w }}>
              <span data-pin className="dk-pin" title="Тягни до іншого стікера — нитка" />
              {edit === n.id
                ? <textarea autoFocus defaultValue={n.text} className="dk-edit" onChange={(e) => { const v = e.target.value; setNodes((xs) => xs.map((x) => (x.id === n.id ? { ...x, text: v } : x))); }} onBlur={() => setEdit((x) => (x === n.id ? null : x))}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.target as HTMLTextAreaElement).blur(); }} placeholder={n.kind === "title" ? "Заголовок" : "Думка, проблема, факт…"} />
                : <div className="dk-text">{n.text || <span className="dk-empty">{n.kind === "title" ? "Заголовок" : "двічі клікни — написати"}</span>}</div>}
              <span data-resize className="dk-rs" aria-hidden />
            </div>
          ))}
        </div>
        {!nodes.length && <div className="dk-help"><b>Порожня дошка</b><span>Двічі клікни по полю — стікер. Тягни за шпильку зверху стікера до іншого — червона нитка. Колесо — гортати, Ctrl + колесо або щипок — масштаб.</span></div>}
      </div>
    </div>
  );
}
