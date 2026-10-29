// Прості SVG-графіки без бібліотек. Одна серія, одна вісь, підказка при наведенні (<title>).

type Point = { label: string; value: number | null; tip: string };

const H = 180;
const PAD = { t: 12, r: 8, b: 24, l: 44 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function Axis({ max, fmt, W }: { max: number; fmt: (n: number) => string; W: number }) {
  const ticks = [0, max / 2, max];
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
          <text x={PAD.l - 8} y={y(t) + 3} textAnchor="end">{fmt(t)}</text>
        </g>
      ))}
    </>
  );
}

// width — ширина в одиницях viewBox: для широкої картки більше, щоб текст не роздувався
export function BarChart({ data, fmt, width: W = 600 }: { data: Point[]; fmt: (n: number) => string; width?: number }) {
  const max = niceMax(Math.max(...data.map((d) => d.value ?? 0)));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const step = iw / data.length;
  const bw = Math.min(40, step * 0.6);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      <Axis max={max} fmt={fmt} W={W} />
      {data.map((d, i) => {
        const v = d.value ?? 0;
        const h = Math.max(v ? 2 : 0, (v / max) * ih);
        const x = PAD.l + step * i + (step - bw) / 2;
        const y = PAD.t + ih - h;
        // Верх заокруглений, низ рівний — на базовій лінії
        const r = Math.min(4, bw / 2, h);
        const path = h ? `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${y + h} Z` : "";
        return (
          <g key={d.label}>
            <rect className="hit" x={PAD.l + step * i} y={PAD.t} width={step} height={ih}><title>{d.tip}</title></rect>
            {path && <path className="mark" d={path}><title>{d.tip}</title></path>}
            <text x={PAD.l + step * i + step / 2} y={H - 6} textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ data, fmt, width: W = 600 }: { data: Point[]; fmt: (n: number) => string; width?: number }) {
  const vals = data.map((d) => d.value).filter((v): v is number => v !== null);
  const max = niceMax(Math.max(0, ...vals));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (data.length === 1 ? iw / 2 : (iw * i) / (data.length - 1));
  const y = (v: number) => PAD.t + ih * (1 - v / max);
  const pts = data.map((d, i) => (d.value === null ? null : [x(i), y(d.value)] as const));
  const line = pts.filter(Boolean).map((p, i) => `${i ? "L" : "M"}${p![0]},${p![1]}`).join(" ");
  const first = pts.find(Boolean);
  const last = [...pts].reverse().find(Boolean);
  const area = first && last ? `${line} L${last[0]},${PAD.t + ih} L${first[0]},${PAD.t + ih} Z` : "";
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      <Axis max={max} fmt={fmt} W={W} />
      {area && <path className="area" d={area} />}
      {line && <path className="line" d={line} />}
      {data.map((d, i) => (
        <g key={i}>
          {pts[i] && (
            <>
              <circle className="hit" cx={pts[i]![0]} cy={pts[i]![1]} r={14}><title>{d.tip}</title></circle>
              <circle className="dot" cx={pts[i]![0]} cy={pts[i]![1]} r={4}><title>{d.tip}</title></circle>
            </>
          )}
          {(data.length <= 8 || i % Math.ceil(data.length / 8) === 0) && <text x={x(i)} y={H - 6} textAnchor="middle">{d.label}</text>}
        </g>
      ))}
    </svg>
  );
}
