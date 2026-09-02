import { useCallback, useMemo, useRef, useState } from "react";
import { LoggerPanel } from "./LoggerPanel";
import { NodeDetail } from "./NodeDetail";
import { TreeBranch } from "./TreeBranch";
import {
  HISTORY_LIMIT,
  collectBranchPaths,
  countLeaves,
  createRoot,
  exportTree,
  findNode,
  ingestMessage,
  pathIsLogged,
  type HistoryLimit,
  type TreeNode,
} from "./tree";
import type { LogEntry, NatsMessage } from "./types";
import { useNatsBridge } from "./useNatsBridge";

export default function App() {
  const rootRef = useRef<TreeNode>(createRoot());
  const logsRef = useRef<LogEntry[]>([]);
  const loggedRef = useRef<Set<string>>(new Set());
  const logId = useRef(1);
  const msgCountRef = useRef(0);
  const flashTimer = useRef<number | undefined>(undefined);
  const raf = useRef<number>(0);
  const pendingFlash = useRef<Set<string>>(new Set());
  const pendingExpand = useRef<string[]>([]);

  const [host, setHost] = useState(() =>
    import.meta.env.VITE_STATIC === "true" ? "demo" : "127.0.0.1",
  );
  const [port, setPort] = useState("4222");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);
  const [logVersion, setLogVersion] = useState(0);
  const [msgCount, setMsgCount] = useState(0);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [logged, setLogged] = useState<Set<string>>(() => new Set());
  const [flashed, setFlashed] = useState<Set<string>>(() => new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const selectedPathRef = useRef<string | null>(null);

  const flush = useCallback(() => {
    raf.current = 0;
    setMsgCount(msgCountRef.current);
    setTick((n) => n + 1);
    setLogVersion((n) => n + 1);
    if (pendingFlash.current.size) {
      setFlashed(new Set(pendingFlash.current));
      pendingFlash.current = new Set();
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlashed(new Set()), 700);
    }
    if (pendingExpand.current.length) {
      const extra = pendingExpand.current;
      pendingExpand.current = [];
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const path of extra) next.add(path);
        return next;
      });
    }
  }, []);

  const onMessage = useCallback(
    (msg: NatsMessage) => {
      const { changed, created } = ingestMessage(
        rootRef.current,
        msg.subject,
        msg.payload,
        msg.timestamp,
      );
      msgCountRef.current += 1;
      for (const path of changed) pendingFlash.current.add(path);
      if (created.length) pendingExpand.current.push(...created);

      if (loggedRef.current.size) {
        for (const path of changed) {
          if (!pathIsLogged(path, loggedRef.current)) continue;
          const node = findNode(rootRef.current, path);
          if (!node?.hasValue) continue;
          logsRef.current.push({
            id: logId.current++,
            timestamp: msg.timestamp,
            path,
            subject: msg.subject,
            value: node.value,
          });
        }
      }

      if (!raf.current) raf.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  const { status, socketReady, connect, disconnect } = useNatsBridge(onMessage);

  const leafCount = useMemo(() => countLeaves(rootRef.current), [tick]);
  const selectedNode = selectedPath ? findNode(rootRef.current, selectedPath) : null;
  const getEntries = useCallback(() => logsRef.current, []);

  const toggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(collectBranchPaths(rootRef.current)));
  }, []);

  const collapseAll = useCallback(() => {
    pendingExpand.current = [];
    setExpanded(new Set());
  }, []);

  const toggleLog = useCallback((path: string) => {
    setLogged((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      loggedRef.current = next;
      return next;
    });
  }, []);

  const trimHistory = useCallback((path: string, limit: number) => {
    const node = findNode(rootRef.current, path);
    if (!node) return;
    node.historyLimit = limit;
    if (node.history.length > limit) node.history.splice(0, node.history.length - limit);
  }, []);

  const onSelect = useCallback(
    (path: string) => {
      const prev = selectedPathRef.current;
      if (prev && prev !== path) trimHistory(prev, HISTORY_LIMIT);
      selectedPathRef.current = path;
      setSelectedPath(path);
    },
    [trimHistory],
  );

  const onHistoryLimitChange = useCallback(
    (path: string, limit: HistoryLimit) => {
      trimHistory(path, limit);
      setTick((n) => n + 1);
    },
    [trimHistory],
  );

  const exportStructure = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      messages: msgCountRef.current,
      leaves: countLeaves(rootRef.current),
      tree: exportTree(rootRef.current),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `natstree-structure-${new Date().toISOString().replaceAll(":", "")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const start = () => {
    connect({
      host: host.trim() || "127.0.0.1",
      port: Number(port) || 4222,
      user: user.trim() || undefined,
      pass: pass || undefined,
    });
  };

  let led = "led";
  if (status.connecting) led += " wait";
  else if (status.connected) led += " on";
  else if (status.error) led += " err";

  const statusLabel = status.connecting
    ? "Connecting…"
    : status.connected
      ? `Live · ${status.server ?? ""}`
      : status.error
        ? status.error
        : socketReady
          ? "Idle"
          : "Bridge offline";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="mark">N</div>
          <div>
            <h1>NatsTree</h1>
            <span>Subscribe · inspect · log</span>
          </div>
          <a
            className="github-link"
            href="https://github.com/vattaylor/NatsTree"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          {import.meta.env.VITE_STATIC !== "true" && (
            <a
              className="github-link"
              href="https://vattaylor.github.io/NatsTree/"
              target="_blank"
              rel="noreferrer"
            >
              Live demo
            </a>
          )}
        </div>
        <form
          className="conn"
          onSubmit={(e) => {
            e.preventDefault();
            if (status.connected || status.connecting) disconnect();
            else start();
          }}
        >
          <div className="field">
            <label htmlFor="host">Server</label>
            <input
              id="host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="127.0.0.1 or demo"
              autoComplete="off"
              disabled={status.connected || status.connecting}
            />
          </div>
          <div className="field">
            <label htmlFor="port">Port</label>
            <input
              id="port"
              className="port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="4222"
              inputMode="numeric"
              disabled={status.connected || status.connecting}
            />
          </div>
          <div className="field">
            <label htmlFor="user">User</label>
            <input
              id="user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="optional"
              autoComplete="username"
              disabled={status.connected || status.connecting}
            />
          </div>
          <div className="field">
            <label htmlFor="pass">Password</label>
            <input
              id="pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="optional"
              autoComplete="current-password"
              disabled={status.connected || status.connecting}
            />
          </div>
          {status.connected || status.connecting ? (
            <button className="btn danger" type="submit">
              Stop
            </button>
          ) : (
            <button className="btn primary" type="submit" disabled={!socketReady}>
              Connect
            </button>
          )}
          <div className={`status-pill${status.error ? " error-text" : ""}`}>
            <span className={led} />
            {statusLabel}
          </div>
        </form>
      </header>

      <main className="workspace">
        <section className="panel">
          <div className="panel-head">
            <div style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <h2>Subjects</h2>
                <span className="meta">
                  {msgCount.toLocaleString()} msgs · {leafCount.toLocaleString()} leaves
                </span>
              </div>
              <div className="tree-tools">
                <button
                  className="btn small"
                  type="button"
                  onClick={expandAll}
                  disabled={rootRef.current.children.size === 0}
                >
                  Expand all
                </button>
                <button
                  className="btn small"
                  type="button"
                  onClick={collapseAll}
                  disabled={rootRef.current.children.size === 0}
                >
                  Collapse all
                </button>
                <button
                  className={`btn small${showSelectedOnly ? " on" : ""}`}
                  type="button"
                  onClick={() => setShowSelectedOnly((v) => !v)}
                  disabled={rootRef.current.children.size === 0}
                >
                  Show selected
                </button>
                <button
                  className="btn small"
                  type="button"
                  onClick={exportStructure}
                  disabled={rootRef.current.children.size === 0}
                >
                  Export tree
                </button>
              </div>
              <input
                className="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search path or value…"
              />
            </div>
          </div>
          <div className="tree-scroll">
            {rootRef.current.children.size === 0 ? (
              <div className="placeholder">
                Connect to a NATS server to subscribe to <strong>&gt;</strong>. Subjects and JSON
                payloads unfold into this tree. Use host <strong>demo</strong> to preview without a
                server.
              </div>
            ) : showSelectedOnly && logged.size === 0 ? (
              <div className="placeholder">
                Tick one or more nodes, then use <strong>Show selected</strong> to hide everything
                else.
              </div>
            ) : (
              <TreeBranch
                node={rootRef.current}
                depth={0}
                query={query}
                version={tick}
                selectedPath={selectedPath}
                logged={logged}
                expanded={expanded}
                flashed={flashed}
                showSelectedOnly={showSelectedOnly}
                onToggleExpand={toggleExpand}
                onSelect={onSelect}
                onToggleLog={toggleLog}
              />
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Value</h2>
            <span className="meta">{selectedPath ?? "nothing selected"}</span>
          </div>
          <NodeDetail node={selectedNode} onHistoryLimitChange={onHistoryLimitChange} />
        </section>

        <section className="panel">
          <LoggerPanel
            getEntries={getEntries}
            version={logVersion}
            selected={[...logged]}
            onRemove={toggleLog}
            onClear={() => {
              logsRef.current = [];
              setLogVersion((n) => n + 1);
            }}
          />
        </section>
      </main>
    </div>
  );
}
