export type HistoryEntry = {
  value: unknown;
  timestamp: number;
};

export type TreeNode = {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  hasValue: boolean;
  value: unknown;
  lastUpdated: number | null;
  history: HistoryEntry[];
  hits: number;
  natsSubject: string;
  historyLimit: number;
};

export const HISTORY_LIMIT = 10;
export const HISTORY_LIMITS = [10, 100, 1000, 10000, 50000, 100000] as const;
export type HistoryLimit = (typeof HISTORY_LIMITS)[number];

export function createRoot(): TreeNode {
  return {
    name: "",
    path: "",
    children: new Map(),
    hasValue: false,
    value: undefined,
    lastUpdated: null,
    history: [],
    hits: 0,
    natsSubject: "",
    historyLimit: HISTORY_LIMIT,
  };
}

function ensureChild(parent: TreeNode, name: string, created: string[]): TreeNode {
  let child = parent.children.get(name);
  if (!child) {
    const path = parent.path ? `${parent.path}.${name}` : name;
    child = {
      name,
      path,
      children: new Map(),
      hasValue: false,
      value: undefined,
      lastUpdated: null,
      history: [],
      hits: 0,
      natsSubject: "",
      historyLimit: HISTORY_LIMIT,
    };
    parent.children.set(name, child);
    created.push(path);
  }
  return child;
}

function setLeaf(node: TreeNode, value: unknown, timestamp: number, natsSubject: string) {
  node.hasValue = true;
  node.value = value;
  node.lastUpdated = timestamp;
  node.hits += 1;
  node.natsSubject = natsSubject;
  node.history.push({ value, timestamp });
  const cap = node.historyLimit || HISTORY_LIMIT;
  if (node.history.length > cap) node.history.splice(0, node.history.length - cap);
}

function ingestValue(
  node: TreeNode,
  value: unknown,
  timestamp: number,
  natsSubject: string,
  created: string[],
) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      setLeaf(node, value, timestamp, natsSubject);
      return;
    }
    for (const [key, nested] of entries) {
      ingestValue(ensureChild(node, key, created), nested, timestamp, natsSubject, created);
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      setLeaf(node, value, timestamp, natsSubject);
      return;
    }
    value.forEach((item, index) => {
      ingestValue(ensureChild(node, String(index), created), item, timestamp, natsSubject, created);
    });
    return;
  }
  setLeaf(node, value, timestamp, natsSubject);
}

export function ingestMessage(
  root: TreeNode,
  subject: string,
  payload: unknown,
  timestamp: number,
): { changed: string[]; created: string[] } {
  const created: string[] = [];
  const parts = subject.split(".").filter(Boolean);
  let node = root;
  for (const part of parts) {
    node = ensureChild(node, part, created);
  }
  ingestValue(node, payload, timestamp, subject, created);
  const after = collectLeafPaths(node);
  const changed = after.length ? after : node.path ? [node.path] : [];
  return { changed: [...new Set(changed)], created };
}

export function collectLeafPaths(node: TreeNode): string[] {
  const leaves: string[] = [];
  if (node.hasValue) leaves.push(node.path);
  for (const child of node.children.values()) {
    leaves.push(...collectLeafPaths(child));
  }
  return leaves;
}

export function findNode(root: TreeNode, path: string): TreeNode | null {
  if (!path) return root;
  let node: TreeNode | undefined = root;
  for (const part of path.split(".")) {
    node = node.children.get(part);
    if (!node) return null;
  }
  return node;
}

export function countLeaves(node: TreeNode): number {
  let n = node.hasValue ? 1 : 0;
  for (const child of node.children.values()) n += countLeaves(child);
  return n;
}

export function collectBranchPaths(node: TreeNode, out: string[] = []): string[] {
  if (node.path && node.children.size > 0) out.push(node.path);
  for (const child of node.children.values()) collectBranchPaths(child, out);
  return out;
}

export function sortedChildren(node: TreeNode): TreeNode[] {
  return [...node.children.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
  );
}

export function isNumericValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return value.toPrecision(6).replace(/\.?0+$/, "");
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function nodeMatchesQuery(node: TreeNode, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (node.path.toLowerCase().includes(q)) return true;
  if (node.hasValue && formatValue(node.value).toLowerCase().includes(q)) return true;
  for (const child of node.children.values()) {
    if (nodeMatchesQuery(child, query)) return true;
  }
  return false;
}

export function pathIsLogged(path: string, selected: Set<string>): boolean {
  for (const prefix of selected) {
    if (path === prefix || path.startsWith(prefix + ".")) return true;
  }
  return false;
}

export function nodeMatchesSelection(node: TreeNode, selected: Set<string>): boolean {
  if (selected.size === 0) return false;
  if (pathIsLogged(node.path, selected)) return true;
  for (const sel of selected) {
    if (!node.path || sel.startsWith(node.path + ".")) return true;
  }
  return false;
}

export type ExportedNode = {
  name: string;
  path: string;
  value?: unknown;
  natsSubject?: string;
  hits?: number;
  lastUpdated?: string;
  children?: ExportedNode[];
};

export function exportTree(node: TreeNode): ExportedNode[] {
  return sortedChildren(node).map(exportOne);
}

function exportOne(node: TreeNode): ExportedNode {
  const out: ExportedNode = { name: node.name, path: node.path };
  if (node.hasValue) {
    out.value = node.value;
    out.natsSubject = node.natsSubject;
    out.hits = node.hits;
    if (node.lastUpdated) out.lastUpdated = new Date(node.lastUpdated).toISOString();
  }
  if (node.children.size) out.children = sortedChildren(node).map(exportOne);
  return out;
}

export function formatInterval(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(ms < 10 ? 2 : 0)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
  return `${(ms / 60_000).toFixed(2)} min`;
}

export function averageInterval(history: HistoryEntry[]): number | null {
  if (history.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < history.length; i++) sum += history[i].timestamp - history[i - 1].timestamp;
  return sum / (history.length - 1);
}
