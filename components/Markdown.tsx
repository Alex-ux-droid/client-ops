// Markdown без бібліотек, під інструкції Джері:
// ## розділ, ### підрозділ · списки (- і 1.) · [ ] чекліст · **жирне**, `код`, посилання
// ```Підпис\nтекст\n``` — блок «скопіюй і встав» з кнопкою · > виділення важливого · | таблиці | · --- роздільник.
import { Fragment } from "react";
import MdCopy from "./MdCopy";

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<b key={k}>{m[1]}</b>);
    else if (m[2]) out.push(<code key={k}>{m[2]}</code>);
    else if (m[3]) out.push(<a key={k} href={m[4]} target="_blank" rel="noreferrer" className="h-link">{m[3]}</a>);
    else if (m[5]) out.push(<a key={k} href={m[5]} target="_blank" rel="noreferrer" className="h-link">{m[5].replace(/^https?:\/\//, "")}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { t: "h"; level: number; text: string }
  | { t: "p"; text: string }
  | { t: "ul" | "ol"; items: { text: string; n?: string }[] }
  | { t: "check"; items: { text: string; done: boolean }[] }
  | { t: "copy"; label: string; text: string }
  | { t: "note"; lines: string[] }
  | { t: "table"; rows: string[][] }
  | { t: "hr" };

function parse(md: string): Block[] {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: Block[] = [];
  const last = () => out[out.length - 1];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```\s*(.*)$/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]);
      out.push({ t: "copy", label: fence[1].trim(), text: body.join("\n").replace(/^\n+|\n+$/g, "") });
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) { out.push({ t: "hr" }); continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { out.push({ t: "h", level: Math.min(3, h[1].length <= 2 ? 2 : 3), text: h[2] }); continue; }
    const q = line.match(/^\s*>\s?(.*)$/);
    if (q) { const l = last(); if (l?.t === "note") l.lines.push(q[1]); else out.push({ t: "note", lines: [q[1]] }); continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue; // роздільник заголовка
      const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
      const l = last(); if (l?.t === "table") l.rows.push(cells); else out.push({ t: "table", rows: [cells] });
      continue;
    }
    const cb = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (cb) { const l = last(); const it = { text: cb[2], done: cb[1] !== " " }; if (l?.t === "check") l.items.push(it); else out.push({ t: "check", items: [it] }); continue; }
    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (ol) { const l = last(); const it = { text: ol[2], n: ol[1] }; if (l?.t === "ol") l.items.push(it); else out.push({ t: "ol", items: [it] }); continue; }
    const li = line.match(/^\s*[-*•]\s+(.*)$/);
    if (li) { const l = last(); if (l?.t === "ul") l.items.push({ text: li[1] }); else out.push({ t: "ul", items: [{ text: li[1] }] }); continue; }
    if (line.trim()) out.push({ t: "p", text: line });
  }
  return out;
}

export default function Markdown({ md }: { md: string }) {
  return (
    <div className="md">
      {parse(md).map((b, i) => {
        const k = String(i);
        switch (b.t) {
          case "h": { const Tag = (b.level === 2 ? "h3" : "h4") as "h3" | "h4"; return <Tag key={k} className={b.level === 2 ? "md-sec" : "md-sub"}>{inline(b.text, k)}</Tag>; }
          case "p": return <p key={k}>{inline(b.text, k)}</p>;
          case "ul": return <ul key={k} className="md-list">{b.items.map((x, j) => <li key={j}>{inline(x.text, `${k}-${j}`)}</li>)}</ul>;
          case "ol": return <ol key={k} className="md-list" start={Number(b.items[0].n) || 1}>{b.items.map((x, j) => <li key={j}>{inline(x.text, `${k}-${j}`)}</li>)}</ol>;
          case "check": return <Fragment key={k}>{b.items.map((x, j) => <div key={j} className="check-item"><span className={`check ${x.done ? "on" : ""}`} style={{ display: "inline-block" }} /><span>{inline(x.text, `${k}-${j}`)}</span></div>)}</Fragment>;
          case "copy": return <MdCopy key={k} label={b.label} text={b.text} />;
          case "note": return <div key={k} className="md-note">{b.lines.map((l, j) => (l.trim() ? <p key={j}>{inline(l, `${k}-${j}`)}</p> : null))}</div>;
          case "table": return (
            <div key={k} className="md-table-wrap"><table className="md-table">
              <thead><tr>{b.rows[0].map((c, j) => <th key={j}>{inline(c, `${k}-h${j}`)}</th>)}</tr></thead>
              <tbody>{b.rows.slice(1).map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, `${k}-${ri}-${j}`)}</td>)}</tr>)}</tbody>
            </table></div>
          );
          case "hr": return <hr key={k} className="md-hr" />;
        }
      })}
    </div>
  );
}
