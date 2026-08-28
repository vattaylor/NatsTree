type Point = { t: number; v: number };

type Props = {
  points: Point[];
};

function fmt(n: number) {
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Number.isInteger(n)) return String(n);
  return n.toPrecision(4);
}

export function ValueChart({ points }: Props) {
  if (points.length < 2) {
    return <div className="chart-empty">Need at least two numeric samples for a graph.</div>;
  }

  const w = 640;
  const h = 220;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const xs = points.map((p) => p.t);
  const ys = points.map((p) => p.v);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const y0 = minY === maxY ? minY - 1 : minY;
  const y1 = minY === maxY ? maxY + 1 : maxY;

  const xy = (p: Point) => {
    const x = padL + ((p.t - minX) / spanX) * (w - padL - padR);
    const y = padT + (1 - (p.v - y0) / (y1 - y0 || spanY)) * (h - padT - padB);
    return { x, y };
  };

  const coords = points.map(xy);
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x},${h - padB} L${coords[0].x},${h - padB} Z`;
  const ticks = [y1, (y0 + y1) / 2, y0];

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Value history graph">
        {ticks.map((tick) => {
          const y = padT + (1 - (tick - y0) / (y1 - y0 || 1)) * (h - padT - padB);
          return (
            <g key={tick}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#d7e4ef" strokeWidth="1" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fill="#5a6e80" fontSize="11" fontFamily="IBM Plex Mono">
                {fmt(tick)}
              </text>
            </g>
          );
        })}
        <path d={area} fill="rgba(26, 111, 181, 0.12)" />
        <path d={line} fill="none" stroke="#1a6fb5" strokeWidth="2" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="3.2" fill="#1a6fb5" />
        ))}
        <text x={padL} y={h - 8} fill="#7d90a2" fontSize="11" fontFamily="IBM Plex Mono">
          {new Date(minX).toLocaleTimeString()}
        </text>
        <text x={w - padR} y={h - 8} textAnchor="end" fill="#7d90a2" fontSize="11" fontFamily="IBM Plex Mono">
          {new Date(maxX).toLocaleTimeString()}
        </text>
      </svg>
    </div>
  );
}
