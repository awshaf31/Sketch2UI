import type { UINode, UIRoot } from "@sketch2ui/shared-types";

// Per-node style overrides — plan §6.7 / §17.3.
//
// The inspector lets a user tweak a component's style visually (display / gap /
// padding / margin / font-size / alignment); those tweaks are stored per detection
// (not per node.id) because layout.ts assigns node ids from a per-run counter that
// shifts when detections are added or removed, but detection uuids are stable — an
// override keyed on the detection survives edits to the surrounding scene.
//
// Group nodes (created by groupRepeatedSiblings) have no sourceDetectionId and are
// deliberately not addressable by this map: the inspector edits user-drawn components,
// not synthetic containers.

export type NodeStyle = Record<string, string>;

export type StyleOverridesByDetection = Record<string, NodeStyle>;

/**
 * Copy any override with a matching sourceDetectionId onto the node's `style` field.
 * Mutates in place — the tree is already a fresh product of buildUITree, and every
 * caller wants the applied version. A missing/empty override leaves node.style
 * untouched, so this composes cleanly with a codegen path that ignores overrides.
 */
export function applyStyleOverrides(root: UIRoot, overrides: StyleOverridesByDetection): void {
  if (!overrides) return;
  const walk = (node: UINode): void => {
    if (node.sourceDetectionId) {
      const override = overrides[node.sourceDetectionId];
      if (override && Object.keys(override).length > 0) {
        node.style = { ...(node.style ?? {}), ...override };
      }
    }
    for (const child of node.children) walk(child);
  };
  for (const child of root.children) walk(child);
}
