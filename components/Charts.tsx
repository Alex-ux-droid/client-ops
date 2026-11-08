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
// Порожній графік не малюємо (усі нулі / нема даних)
const emptyData = (xs: (number | null | undefined)[]) => !xs.some((v) => (v ?? 0) !== 0);
const NoData = () => <div className="mono chart-empty">Даних за цей період ще нема.</div>;

export function BarChart({ data, fmt, width: W = 600 }: { data: Point[]; fmt: (n: number) => string; width?: number }) {
  if (emptyData(data.map((d) => d.value))) return <NoData />;
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
  if (emptyData(data.map((d) => d.value))) return <NoData />;
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

// Дві серії на одному графіку: стовпчики (ліва вісь) + лінія з точками (права вісь). Напр. витрати і ліди по днях.
type ComboProps = { data: { label: string; bar: number; line: number; tip: string }[]; fmtBar: (n: number) => string; fmtLine: (n: number) => string; barName: string; lineName: string };
// Дві версії: широка для компʼютера і вузька для телефону (у вузькій підписи більші відносно ширини)
export function ComboChart(props: ComboProps) {
  if (emptyData(props.data.flatMap((d) => [d.bar, d.line]))) return <NoData />;
  return (
    <div className="combo">
      <div className="combo-legend"><span><i className="cl-bar" />{props.barName}</span><span><i className="cl-line" />{props.lineName}</span></div>
      <div className="combo-wide"><ComboSvg {...props} W={1100} labels={15} /></div>
      <div className="combo-narrow"><ComboSvg {...props} W={420} labels={6} /></div>
    </div>
  );
}

function ComboSvg({ data, fmtBar, fmtLine, W, labels }: ComboProps & { W: number; labels: number }) {
  const P = { t: 12, r: 40, b: 24, l: 48 };
  const maxB = niceMax(Math.max(0, ...data.map((d) => d.bar)));
  const maxL = niceMax(Math.max(0, ...data.map((d) => d.line)));
  const iw = W - P.l - P.r, ih = H - P.t - P.b, step = iw / Math.max(1, data.length), bw = Math.min(28, step * 0.6);
  const yB = (v: number) => P.t + ih * (1 - v / maxB), yL = (v: number) => P.t + ih * (1 - v / maxL);
  const cx = (i: number) => P.l + step * i + step / 2;
  const line = data.map((d, i) => `${i ? "L" : "M"}${cx(i)},${yL(d.line)}`).join(" ");
  const every = Math.ceil(data.length / labels);
  return (
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
        {[0, 0.5, 1].map((k) => (
          <g key={k}>
            <line className="grid" x1={P.l} x2={W - P.r} y1={P.t + ih * (1 - k)} y2={P.t + ih * (1 - k)} />
            <text x={P.l - 8} y={P.t + ih * (1 - k) + 3} textAnchor="end">{fmtBar(maxB * k)}</text>
            <text x={W - P.r + 8} y={P.t + ih * (1 - k) + 3} textAnchor="start" className="combo-r">{fmtLine(maxL * k)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = Math.max(d.bar ? 2 : 0, (d.bar / maxB) * ih), x = cx(i) - bw / 2, y = P.t + ih - h, r = Math.min(3, bw / 2, h);
          const path = h ? `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${y + h} Z` : "";
          return (
            <g key={d.label + i}>
              <rect className="hit" x={P.l + step * i} y={P.t} width={step} height={ih}><title>{d.tip}</title></rect>
              {path && <path className="mark" d={path}><title>{d.tip}</title></path>}
              {i % every === 0 && <text x={cx(i)} y={H - 6} textAnchor="middle">{d.label}</text>}
            </g>
          );
        })}
        {data.length > 1 && <path className="combo-line" d={line} />}
        {data.map((d, i) => <circle key={"c" + i} className="combo-dot" cx={cx(i)} cy={yL(d.line)} r={W < 600 ? 2.5 : 3}><title>{d.tip}</title></circle>)}
      </svg>
  );
}
