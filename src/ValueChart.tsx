import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Point = { t: number; v: number };

type Props = {
  points: Point[];
};

function fmt(n: number) {
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Number.isInteger(n)) return String(n);
  return n.toPrecision(4);
}

function downsample(points: Point[], max = 800): Point[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: Point[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

function ChartSvg({ points, w, h, expanded }: { points: Point[]; w: number; h: number; expanded: boolean }) {
  const padL = expanded ? 72 : 48;
  const padR = expanded ? 36 : 16;
  const padT = expanded ? 28 : 16;
  const padB = expanded ? 48 : 28;
  const font = expanded ? 14 : 11;
  let minX = points[0].t;
  let maxX = points[0].t;
  let minY = points[0].v;
  let maxY = points[0].v;
  for (const p of points) {
    if (p.t < minX) minX = p.t;
    if (p.t > maxX) maxX = p.t;
    if (p.v < minY) minY = p.v;
    if (p.v > maxY) maxY = p.v;
  }
  const drawn = downsample(points, expanded ? 1600 : 800);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const y0 = minY === maxY ? minY - 1 : minY;
  const y1 = minY === maxY ? maxY + 1 : maxY;

  const xy = (p: Point) => {
    const x = padL + ((p.t - minX) / spanX) * (w - padL - padR);
    const y = padT + (1 - (p.v - y0) / (y1 - y0 || spanY)) * (h - padT - padB);
    return { x, y };
  };

  const coords = drawn.map(xy);
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x},${h - padB} L${coords[0].x},${h - padB} Z`;
  const ticks = [y1, (y0 + y1) / 2, y0];
  const showDots = coords.length <= 80;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height="100%"
      role="img"
      aria-label="Value history graph"
      preserveAspectRatio="none"
      style={{ display: "block", width: "100%", height: expanded ? "100%" : 220 }}
    >
      {ticks.map((tick) => {
        const y = padT + (1 - (tick - y0) / (y1 - y0 || 1)) * (h - padT - padB);
        return (
          <g key={String(tick)}>
            <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#d7e4ef" strokeWidth="1" />
            <text
              x={padL - 8}
              y={y + 4}
              textAnchor="end"
              fill="#5a6e80"
              fontSize={font}
              fontFamily="IBM Plex Mono"
            >
              {fmt(tick)}
            </text>
          </g>
        );
      })}
      <path d={area} fill="rgba(26, 111, 181, 0.12)" />
      <path d={line} fill="none" stroke="#1a6fb5" strokeWidth={expanded ? 2.5 : 2} />
      {showDots && coords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={expanded ? 4 : 3.2} fill="#1a6fb5" />)}
      <text x={padL} y={h - 12} fill="#7d90a2" fontSize={font} fontFamily="IBM Plex Mono">
        {new Date(minX).toLocaleTimeString()}
      </text>
      <text x={w - padR} y={h - 12} textAnchor="end" fill="#7d90a2" fontSize={font} fontFamily="IBM Plex Mono">
        {new Date(maxX).toLocaleTimeString()}
      </text>
    </svg>
  );
}

export function ValueChart({ points }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(() => ({
    w: typeof window === "undefined" ? 1280 : window.innerWidth,
    h: typeof window === "undefined" ? 720 : window.innerHeight,
  }));

  useEffect(() => {
    if (!expanded) return;
    const sync = () => setPage({ w: Math.max(320, window.innerWidth), h: Math.max(240, window.innerHeight) });
    sync();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("resize", sync);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  if (points.length < 2) {
    return <div className="chart-empty">Need at least two numeric samples for a graph.</div>;
  }

  const open = () => setExpanded(true);

  return (
    <>
      <button type="button" className="chart-wrap chart-clickable" onClick={open} title="Expand graph">
        <ChartSvg points={points} w={640} h={220} expanded={false} />
        <span className="chart-expand-hint">Click to fill page</span>
      </button>
      {expanded &&
        createPortal(
          <div
            className="chart-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Expanded value graph"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              zIndex: 2147483647,
              background: "#f3f8fc",
            }}
          >
            <button className="chart-close" type="button" onClick={() => setExpanded(false)}>
              Close
            </button>
            <div className="chart-overlay-plot" style={{ position: "absolute", inset: 0 }}>
              <ChartSvg points={points} w={page.w} h={page.h} expanded />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
