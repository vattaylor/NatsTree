import { memo, useMemo } from "react";
import { formatValue, nodeMatchesQuery, sortedChildren, type TreeNode } from "./tree";

type Props = {
  node: TreeNode;
  depth: number;
  query: string;
  version: number;
  selectedPath: string | null;
  logged: Set<string>;
  expanded: Set<string>;
  flashed: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelect: (path: string) => void;
  onToggleLog: (path: string) => void;
};

export const TreeBranch = memo(function TreeBranch({
  node,
  depth,
  query,
  version,
  selectedPath,
  logged,
  expanded,
  flashed,
  onToggleExpand,
  onSelect,
  onToggleLog,
}: Props) {
  const children = useMemo(() => {
    return sortedChildren(node).filter((child) => nodeMatchesQuery(child, query));
  }, [node, node.children.size, query, version]);

  const isRoot = node.path === "";
  const hasKids = node.children.size > 0;
  const open = isRoot || query.length > 0 || expanded.has(node.path);
  const checked = logged.has(node.path);
  const isSelected = selectedPath === node.path;

  return (
    <div className="tree-branch">
      {!isRoot && (
        <div
          className={`tree-row${isSelected ? " selected" : ""}${flashed.has(node.path) ? " flash" : ""}`}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <span
            className={`twisty${hasKids ? "" : " is-leaf"}`}
            onClick={(e) => {
              e.stopPropagation();
              if (hasKids) onToggleExpand(node.path);
            }}
            onKeyDown={(e) => {
              if (hasKids && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onToggleExpand(node.path);
              }
            }}
            role={hasKids ? "button" : undefined}
            tabIndex={hasKids ? 0 : -1}
            aria-label={hasKids ? (open ? "Collapse" : "Expand") : undefined}
          >
            {hasKids ? (open ? "▾" : "▸") : ""}
          </span>
          <input
            className="check"
            type="checkbox"
            checked={checked}
            onChange={() => onToggleLog(node.path)}
            onClick={(e) => e.stopPropagation()}
            title="Log this branch"
          />
          <span className="node-main" onClick={() => onSelect(node.path)}>
            <span className={`node-name${node.hasValue ? "" : " branch"}`}>{node.name}</span>
            {node.hasValue && <span className="node-val">{formatValue(node.value)}</span>}
          </span>
        </div>
      )}
      {(isRoot || open) &&
        children.map((child) => (
          <TreeBranch
            key={child.path}
            node={child}
            depth={isRoot ? 0 : depth + 1}
            query={query}
            version={version}
            selectedPath={selectedPath}
            logged={logged}
            expanded={expanded}
            flashed={flashed}
            onToggleExpand={onToggleExpand}
            onSelect={onSelect}
            onToggleLog={onToggleLog}
          />
        ))}
    </div>
  );
});
