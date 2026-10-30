// Мінімальний markdown без бібліотек: заголовки, чекліст, списки (• і 1.), **жирне**, `код`, [посилання](url) і голі https-посилання.
import { Fragment } from "react";

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

export default function Markdown({ md }: { md: string }) {
  return (
    <div className="md">
      {md.split("\n").map((line, i) => {
        const k = String(i);
        const h = line.match(/^(#{1,3})\s+(.*)$/);
        if (h) { const Tag = `h${h[1].length + 1}` as "h2" | "h3" | "h4"; return <Tag key={k}>{inline(h[2], k)}</Tag>; }
        const cb = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
        if (cb) return <div key={k} className="check-item"><span className="check" style={{ display: "inline-block" }} /><span>{inline(cb[2], k)}</span></div>;
        const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (ol) return <p key={k} className="md-ol"><b>{ol[1]}.</b> {inline(ol[2], k)}</p>;
        const li = line.match(/^\s*[-*]\s+(.*)$/);
        if (li) return <p key={k} className="md-li">• {inline(li[1], k)}</p>;
        return line.trim() ? <p key={k}>{inline(line, k)}</p> : <Fragment key={k} />;
      })}
    </div>
  );
}
