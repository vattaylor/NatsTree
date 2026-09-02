import { useEffect, useMemo, useRef, useState } from "react";
import {
  HISTORY_LIMITS,
  averageInterval,
  formatInterval,
  formatValue,
  isNumericValue,
  type HistoryLimit,
  type TreeNode,
} from "./tree";
import { ValueChart } from "./ValueChart";

const ROW = 28;
const VISIBLE = 24;

type Props = {
  node: TreeNode | null;
  onHistoryLimitChange: (path: string, limit: HistoryLimit) => void;
};

function ago(ts: number) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 1) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function asLimit(value: number): HistoryLimit {
  return (HISTORY_LIMITS as readonly number[]).includes(value)
    ? (value as HistoryLimit)
    : HISTORY_LIMITS[0];
}

export function NodeDetail({ node, onHistoryLimitChange }: Props) {
  const [mode, setMode] = useState<"table" | "graph">("table");
  const [scrollTop, setScrollTop] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  const numericPoints = useMemo(() => {
    if (!node) return [];
    return node.history
      .filter((h) => isNumericValue(h.value))
      .map((h) => ({ t: h.timestamp, v: h.value as number }));
  }, [node, node?.history, node?.hits]);

  const avg = useMemo(() => (node ? averageInterval(node.history) : null), [node, node?.hits, node?.history.length]);

  useEffect(() => {
    setScrollTop(0);
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [node?.path]);

  if (!node) {
    return (
      <div className="detail-body">
        <div className="placeholder">
          Select a leaf in the tree to inspect its values, timestamps, and (for numbers) a graph.
        </div>
      </div>
    );
  }

  const canGraph = numericPoints.length > 0 || isNumericValue(node.value);
  const count = node.history.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW) - 4);
  const limit = asLimit(node.historyLimit);

  return (
    <div className="detail-body">
      <dl className="kv">
        <dt>Path</dt>
        <dd>{node.path}</dd>
        <dt>NATS subject</dt>
        <dd>{node.natsSubject || "—"}</dd>
        <dt>Current</dt>
        <dd className="current-value">{node.hasValue ? formatValue(node.value) : "no leaf value"}</dd>
        <dt>Updated</dt>
        <dd>
          {node.lastUpdated
            ? `${new Date(node.lastUpdated).toLocaleString()} (${ago(node.lastUpdated)})`
            : "—"}
        </dd>
        <dt>Hits</dt>
        <dd>{node.hits.toLocaleString()}</dd>
        <dt>Avg interval</dt>
        <dd>{avg == null ? "Need two samples" : formatInterval(avg)}</dd>
      </dl>

      <div className="history-toolbar">
        <label htmlFor="history-limit">Keep last</label>
        <select
          id="history-limit"
          value={limit}
          onChange={(e) => onHistoryLimitChange(node.path, asLimit(Number(e.target.value)))}
        >
          {HISTORY_LIMITS.map((n) => (
            <option key={n} value={n}>
              {n.toLocaleString()}
            </option>
          ))}
        </select>
        <span className="meta">
          {count.toLocaleString()} stored
          {count < limit && node.hits > count ? " (older samples were discarded)" : ""}
        </span>
      </div>

      {canGraph && (
        <div className="tabs">
          <button className={`tab${mode === "table" ? " on" : ""}`} onClick={() => setMode("table")}>
            History
          </button>
          <button className={`tab${mode === "graph" ? " on" : ""}`} onClick={() => setMode("graph")}>
            Graph
          </button>
        </div>
      )}

      {mode === "graph" && canGraph ? (
        <ValueChart points={numericPoints} />
      ) : (
        <div className="history-virt">
          <div className="history-head">
            <span>When</span>
            <span>Age</span>
            <span>Value</span>
          </div>
          <div
            className="history-body"
            ref={scroller}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          >
            {count === 0 ? (
              <div className="hint">No samples yet.</div>
            ) : (
              <div className="log-table-wrap">
                <div className="log-spacer" style={{ height: count * ROW }} />
                <div className="log-window" style={{ top: start * ROW }}>
                  {Array.from({ length: Math.min(VISIBLE, count - start) }, (_, i) => {
                    const entry = node.history[count - 1 - (start + i)];
                    return (
                      <div className="history-row" key={`${entry.timestamp}-${start + i}`}>
                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                        <span>{ago(entry.timestamp)}</span>
                        <span title={formatValue(entry.value)}>{formatValue(entry.value)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
