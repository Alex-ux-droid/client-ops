// Мінімальний показ markdown плейбука: заголовки, пункти чекліста, списки, текст.
export default function Markdown({ md }: { md: string }) {
  return (
    <div className="md">
      {md.split("\n").map((line, i) => {
        const h = line.match(/^(#{1,3})\s+(.*)$/);
        if (h) { const Tag = `h${h[1].length + 1}` as "h2" | "h3" | "h4"; return <Tag key={i}>{h[2]}</Tag>; }
        const cb = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
        if (cb) return <div key={i} className="check-item"><span className="check" style={{ display: "inline-block" }} /><span>{cb[2]}</span></div>;
        const li = line.match(/^\s*[-*]\s+(.*)$/);
        if (li) return <p key={i}>• {li[1]}</p>;
        return line.trim() ? <p key={i}>{line}</p> : null;
      })}
    </div>
  );
}
