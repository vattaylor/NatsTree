import { useMemo, useState } from "react";
import { formatValue, isNumericValue, type TreeNode } from "./tree";
import { ValueChart } from "./ValueChart";

type Props = {
  node: TreeNode | null;
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

export function NodeDetail({ node }: Props) {
  const [mode, setMode] = useState<"table" | "graph">("table");
  const numericPoints = useMemo(() => {
    if (!node) return [];
    return node.history
      .filter((h) => isNumericValue(h.value))
      .map((h) => ({ t: h.timestamp, v: h.value as number }));
  }, [node, node?.history, node?.hits]);

  if (!node) {
    return (
      <div className="placeholder">
        Select a leaf in the tree to inspect its last 10 values, timestamps, and (for numbers) a graph.
      </div>
    );
  }

  const canGraph = numericPoints.length > 0 || isNumericValue(node.value);

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
        <dd>{node.hits}</dd>
      </dl>

      {canGraph && (
        <div className="tabs">
          <button className={`tab${mode === "table" ? " on" : ""}`} onClick={() => setMode("table")}>
            Last 10
          </button>
          <button className={`tab${mode === "graph" ? " on" : ""}`} onClick={() => setMode("graph")}>
            Graph
          </button>
        </div>
      )}

      {mode === "graph" && canGraph ? (
        <ValueChart points={numericPoints} />
      ) : (
        <table className="history">
          <thead>
            <tr>
              <th>When</th>
              <th>Age</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {[...node.history].reverse().map((entry, i) => (
              <tr key={`${entry.timestamp}-${i}`}>
                <td>{new Date(entry.timestamp).toLocaleString()}</td>
                <td>{ago(entry.timestamp)}</td>
                <td>{formatValue(entry.value)}</td>
              </tr>
            ))}
            {node.history.length === 0 && (
              <tr>
                <td colSpan={3}>No samples yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
