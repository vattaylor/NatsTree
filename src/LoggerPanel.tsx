import { useCallback, useMemo, useRef, useState } from "react";
import { formatValue } from "./tree";
import type { LogEntry } from "./types";

const ROW = 24;

type Props = {
  getEntries: () => LogEntry[];
  version: number;
  selected: string[];
  onRemove: (path: string) => void;
  onClear: () => void;
};

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function LoggerPanel({ getEntries, version, selected, onRemove, onClear }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const entries = getEntries();
  const count = entries.length;

  const start = Math.max(0, Math.floor(scrollTop / ROW) - 6);
  const visible = 48;
  const slice = useMemo(() => {
    const rows: LogEntry[] = [];
    for (let i = start; i < Math.min(count, start + visible); i++) {
      rows.push(entries[count - 1 - i]);
    }
    return rows;
  }, [entries, start, count, visible, version]);

  const download = useCallback(() => {
    const rows = getEntries();
    const header = "timestamp,iso,path,nats_subject,value";
    const lines = rows.map((e) =>
      [
        String(e.timestamp),
        new Date(e.timestamp).toISOString(),
        csvEscape(e.path),
        csvEscape(e.subject),
        csvEscape(formatValue(e.value)),
      ].join(","),
    );
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `natstree-log-${new Date().toISOString().replaceAll(":", "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [getEntries]);

  const status =
    selected.length === 0
      ? "No branches selected"
      : `${selected.length} branch${selected.length === 1 ? "" : "es"} · ${count.toLocaleString()} recorded`;

  return (
    <>
      <div className="panel-head">
        <div>
          <h2>Logger</h2>
          <div className="meta">{status}</div>
        </div>
        <div className="log-controls">
          <span className="count-chip">{count.toLocaleString()} logs</span>
          <button className="btn" onClick={download} disabled={count === 0}>
            Download CSV
          </button>
          <button className="btn danger" onClick={onClear} disabled={count === 0}>
            Clear
          </button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="chips">
          {selected.map((path) => (
            <span className="chip" key={path}>
              {path}
              <button onClick={() => onRemove(path)} aria-label={`Stop logging ${path}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {selected.length === 0 ? (
        <p className="hint">Tick any node in the tree to log that branch without a record limit.</p>
      ) : count === 0 ? (
        <p className="hint">Waiting for matching messages…</p>
      ) : (
        <>
          <div className="log-head">
            <span>Time</span>
            <span>Path</span>
            <span>Subject</span>
            <span>Value</span>
          </div>
          <div
            className="log-body"
            ref={scroller}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          >
            <div className="log-table-wrap">
              <div className="log-spacer" style={{ height: count * ROW }} />
              <div className="log-window" style={{ top: start * ROW }}>
                {slice.map((entry) => (
                  <div className="log-row" key={entry.id}>
                    <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    <span title={entry.path}>{entry.path}</span>
                    <span title={entry.subject}>{entry.subject}</span>
                    <span title={formatValue(entry.value)}>{formatValue(entry.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
