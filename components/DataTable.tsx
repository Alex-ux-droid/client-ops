"use client";
// Інтерактивна таблиця (за ТЗ «налаштування колонок, порядку та щільності»): перетягування колонок за ⠿, зміна ширини за правий край,
// меню «Колонки» (видимість, закріпити зліва, ↑↓ без мишки), щільність, сортування кліком (↑ → ↓ → без), пошук, «Скинути вигляд».
// Вигляд зберігається в браузері окремо для кожної таблиці (tableId). Клітинки — прості дані (сервер передає без функцій).
import { useEffect, useMemo, useRef, useState } from "react";

export type DTCell = string | number | null | { v: string | number | null; t?: string; href?: string; sub?: string; tag?: string; tone?: "good" | "bad" };
export type DTCol = { id: string; label: string; num?: boolean; w?: number; pin?: boolean; hide?: boolean };
export type DTRow = { key: string; cells: Record<string, DTCell> };
type Density = "compact" | "normal" | "comfy";
type View = { order: string[]; widths: Record<string, number>; hidden: string[]; pinned: string[]; density: Density };

const MIN_W = 80, MAX_W = 600;
const DENS: Record<Density, string> = { compact: "Щільно", normal: "Звичайно", comfy: "Просторо" };
const cellV = (c: DTCell) => (c != null && typeof c === "object" ? c.v : c);
const cellT = (c: DTCell) => (c != null && typeof c === "object" ? c.t ?? (c.v == null ? "—" : String(c.v)) : c == null ? "—" : String(c));

export default function DataTable({ id, cols, rows, empty = "Порожньо", search, maxHeight = "70vh" }: {
  id: string; cols: DTCol[]; rows: DTRow[]; empty?: string; search?: boolean; maxHeight?: string;
}) {
  const key = `dt.${id}`;
  const def = useMemo<View>(() => ({ order: cols.map((c) => c.id), widths: {}, hidden: cols.filter((c) => c.hide).map((c) => c.id), pinned: cols.filter((c) => c.pin).map((c) => c.id), density: "normal" }), [cols]);
  const [view, setView] = useState<View>(def);
  const [sort, setSort] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [drag, setDrag] = useState<{ id: string; over?: string; after?: boolean } | null>(null);
  const resizing = useRef(false);

  // Відновити збережений вигляд; нові колонки — в кінець, зниклі — прибрати (безпечно після оновлень)
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(key) || "null") as View | null;
      if (!s) return;
      const ids = new Set(cols.map((c) => c.id));
      const order = [...s.order.filter((x) => ids.has(x)), ...cols.map((c) => c.id).filter((x) => !s.order.includes(x))];
      setView({ order, widths: s.widths ?? {}, hidden: (s.hidden ?? []).filter((x) => ids.has(x)), pinned: (s.pinned ?? []).filter((x) => ids.has(x)), density: s.density ?? "normal" });
    } catch { /* сховище недоступне — дефолт */ }
  }, [key, cols]);
  const save = (v: View) => { setView(v); try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ok */ } };

  const byId = useMemo(() => new Map(cols.map((c) => [c.id, c])), [cols]);
  const visible = view.order.filter((x) => byId.has(x) && !view.hidden.includes(x));
  const shown = [...visible.filter((x) => view.pinned.includes(x)), ...visible.filter((x) => !view.pinned.includes(x))];
  const width = (cid: string) => view.widths[cid] ?? byId.get(cid)?.w ?? (byId.get(cid)?.num ? 120 : 200);
  const left: Record<string, number> = {};
  let acc = 0;
  for (const cid of shown) if (view.pinned.includes(cid)) { left[cid] = acc; acc += width(cid); }

  const data = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = needle ? rows.filter((row) => cols.some((c) => cellT(row.cells[c.id] ?? null).toLowerCase().includes(needle))) : rows;
    if (sort) {
      const s = sort;
      r = [...r].sort((a, b) => {
        const x = cellV(a.cells[s.id] ?? null), y = cellV(b.cells[s.id] ?? null);
        if (x == null || x === "") return 1;
        if (y == null || y === "") return -1;
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "uk")) * s.dir;
      });
    }
    return r;
  }, [rows, cols, q, sort]);

  const cycleSort = (cid: string) => setSort((s) => (!s || s.id !== cid ? { id: cid, dir: 1 } : s.dir === 1 ? { id: cid, dir: -1 } : null));
  const move = (cid: string, to: string, after: boolean) => {
    if (cid === to) return;
    const o = view.order.filter((x) => x !== cid);
    const i = o.indexOf(to) + (after ? 1 : 0);
    o.splice(i, 0, cid);
    save({ ...view, order: o });
  };
  const step = (cid: string, d: -1 | 1) => {
    const o = [...view.order], i = o.indexOf(cid), j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    save({ ...view, order: o });
  };
  const toggleHidden = (cid: string) => {
    const hidden = view.hidden.includes(cid) ? view.hidden.filter((x) => x !== cid) : [...view.hidden, cid];
    if (cols.every((c) => hidden.includes(c.id))) return; // не можна сховати все
    save({ ...view, hidden });
  };
  const togglePin = (cid: string) => save({ ...view, pinned: view.pinned.includes(cid) ? view.pinned.filter((x) => x !== cid) : [...view.pinned, cid] });

  const startResize = (e: React.PointerEvent, cid: string) => {
    e.preventDefault(); e.stopPropagation();
    resizing.current = true;
    const x0 = e.clientX, w0 = width(cid);
    let cur = view;
    const mv = (ev: PointerEvent) => { cur = { ...cur, widths: { ...cur.widths, [cid]: Math.max(MIN_W, Math.min(MAX_W, Math.round(w0 + ev.clientX - x0))) } }; setView(cur); };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); save(cur); setTimeout(() => { resizing.current = false; }, 0); };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  };
  const autoWidth = (cid: string) => { const w = { ...view.widths }; delete w[cid]; save({ ...view, widths: w }); };

  useEffect(() => {
    if (!menu) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); setMenu(false); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [menu]);

  const custom = JSON.stringify({ ...view }) !== JSON.stringify(def);
  return (
    <div className={`dt dt-${view.density}`}>
      <div className="dt-bar">
        {(search ?? rows.length > 8) && <input className="dt-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук у таблиці…" aria-label="Пошук у таблиці" />}
        <span className="dt-count">{data.length}{data.length !== rows.length ? ` з ${rows.length}` : ""} рядк.</span>
        <div className="dt-dens" role="group" aria-label="Щільність">
          {(Object.keys(DENS) as Density[]).map((d) => <button key={d} type="button" className={view.density === d ? "on" : ""} onClick={() => save({ ...view, density: d })} aria-pressed={view.density === d}>{DENS[d]}</button>)}
        </div>
        <div className="dt-menu-wrap">
          <button type="button" className="ghost small" onClick={() => setMenu((x) => !x)} aria-expanded={menu}>Колонки ▾</button>
          {menu && (
            <div className="dt-menu" role="dialog" aria-label="Колонки">
              {view.order.filter((x) => byId.has(x)).map((cid, i, arr) => (
                <div key={cid} className="dt-mrow">
                  <label><input type="checkbox" checked={!view.hidden.includes(cid)} onChange={() => toggleHidden(cid)} /> {byId.get(cid)!.label}</label>
                  <button type="button" className={`dt-pin${view.pinned.includes(cid) ? " on" : ""}`} onClick={() => togglePin(cid)} title={view.pinned.includes(cid) ? "Відкріпити" : "Закріпити зліва"} aria-label={view.pinned.includes(cid) ? "Відкріпити" : "Закріпити зліва"}>📌</button>
                  <button type="button" disabled={i === 0} onClick={() => step(cid, -1)} aria-label="Вліво">↑</button>
                  <button type="button" disabled={i === arr.length - 1} onClick={() => step(cid, 1)} aria-label="Вправо">↓</button>
                </div>
              ))}
              <button type="button" className="ghost small" disabled={!custom} onClick={() => { save(def); setSort(null); try { localStorage.removeItem(key); } catch { /* ok */ } }}>Скинути вигляд</button>
            </div>
          )}
        </div>
      </div>
      <div className="dt-scroll" style={{ maxHeight }}>
        <table className="dt-table" style={{ width: shown.reduce((s, c) => s + width(c), 0) }}>
          <colgroup>{shown.map((c) => <col key={c} style={{ width: width(c) }} />)}</colgroup>
          <thead>
            <tr>
              {shown.map((cid) => {
                const c = byId.get(cid)!;
                const pin = view.pinned.includes(cid);
                const s = sort?.id === cid ? sort.dir : 0;
                const over = drag?.over === cid && drag.id !== cid;
                return (
                  <th key={cid} className={`${c.num ? "num" : ""}${pin ? " pin" : ""}${over ? (drag!.after ? " drop-r" : " drop-l") : ""}${drag?.id === cid ? " dragging" : ""}`}
                    style={pin ? { left: left[cid] } : undefined} aria-sort={s === 1 ? "ascending" : s === -1 ? "descending" : "none"}
                    onDragOver={(e) => { if (!drag) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setDrag({ ...drag, over: cid, after: e.clientX > r.left + r.width / 2 }); }}
                    onDrop={(e) => { e.preventDefault(); if (drag?.over) move(drag.id, drag.over, !!drag.after); setDrag(null); }}>
                    <span className="dt-th">
                      <span className="dt-grip" draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", cid); setDrag({ id: cid }); }} onDragEnd={() => setDrag(null)} title="Перетягни, щоб змінити порядок" aria-hidden>⠿</span>
                      <button type="button" className="dt-sort" onClick={() => { if (!resizing.current) cycleSort(cid); }}>{c.label}<i>{s === 1 ? "↑" : s === -1 ? "↓" : ""}</i></button>
                    </span>
                    <span className="dt-rs" onPointerDown={(e) => startResize(e, cid)} onDoubleClick={() => autoWidth(cid)} title="Тягни — ширина; подвійний клік — як було" aria-hidden />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.length ? data.map((r) => (
              <tr key={r.key}>
                {shown.map((cid) => {
                  const c = byId.get(cid)!, x = r.cells[cid] ?? null, o = x != null && typeof x === "object" ? x : null;
                  const txt = cellT(x);
                  const body = o?.tag ? <span className={`tag ${o.tag}`}>{txt}</span> : o?.href ? <a href={o.href}>{txt}</a> : txt;
                  return (
                    <td key={cid} className={`${c.num ? "num" : ""}${view.pinned.includes(cid) ? " pin" : ""}${o?.tone ? ` t-${o.tone}` : ""}`} style={view.pinned.includes(cid) ? { left: left[cid] } : undefined} title={txt.length > 40 ? txt : undefined}>
                      <div className="dt-cell">{body}</div>
                      {o?.sub && <div className="dt-sub">{o.sub}</div>}
                    </td>
                  );
                })}
              </tr>
            )) : <tr><td colSpan={shown.length} className="dt-empty">{q ? "Нічого не знайдено" : empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
