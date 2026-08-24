import type { UINode, UIRoot } from "@sketch2ui/shared-types";

interface UITreePanelProps {
  root: UIRoot;
  selectedDetectionId: string | null;
  onSelect: (detectionId: string | null) => void;
  /** Ids of detections produced by the detector, marked so model-derived nodes are
   *  visually distinct from hand-drawn ones (same convention as the canvas). */
  modelDetectionIds: ReadonlySet<string>;
}

function TreeNode({
  node,
  depth,
  selectedDetectionId,
  onSelect,
  modelDetectionIds,
}: {
  node: UINode;
  depth: number;
  selectedDetectionId: string | null;
  onSelect: (id: string | null) => void;
  modelDetectionIds: ReadonlySet<string>;
}) {
  const selected = node.sourceDetectionId === selectedDetectionId;
  const fromModel = node.sourceDetectionId !== undefined && modelDetectionIds.has(node.sourceDetectionId);
  return (
    <li>
      <button
        onClick={() => onSelect(node.sourceDetectionId ?? null)}
        style={{ paddingLeft: depth * 14 }}
        className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs hover:bg-gray-100 ${
          selected ? "bg-orange-50 text-orange-700" : fromModel ? "text-purple-700" : "text-gray-700"
        }`}
      >
        {fromModel && (
          <span
            title="Detected by the model"
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500"
          />
        )}
        <span className="font-mono text-[10px] text-gray-400">{node.type}</span>
        {node.layout && (
          <span className="rounded bg-gray-100 px-1 text-[9px] uppercase text-gray-400">
            {node.layout.display}
            {node.layout.display === "grid" ? ` ${node.layout.columns}` : ""}
          </span>
        )}
      </button>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedDetectionId={selectedDetectionId}
              onSelect={onSelect}
              modelDetectionIds={modelDetectionIds}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function UITreePanel({
  root,
  selectedDetectionId,
  onSelect,
  modelDetectionIds,
}: UITreePanelProps) {
  if (root.children.length === 0) {
    return <p className="p-3 text-xs text-gray-400">Draw boxes on the sketch to build the UI tree.</p>;
  }

  return (
    <ul className="p-2">
      {root.children.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={0}
          selectedDetectionId={selectedDetectionId}
          onSelect={onSelect}
          modelDetectionIds={modelDetectionIds}
        />
      ))}
    </ul>
  );
}
