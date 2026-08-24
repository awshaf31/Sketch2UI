import type { BBox, Detection } from "@sketch2ui/shared-types";
import type { UINode, UIRoot } from "@sketch2ui/shared-types";
import type { StructureOverridesByDetection } from "@sketch2ui/shared-types";
import { isContainerClass } from "@sketch2ui/shared-types";

// Layout reconstruction engine — plan section 11.
// Input: flat detections with normalized bboxes. Output: a semantic UI-IR tree.

const ROW_TOLERANCE_RATIO = 0.03; // fraction of page height — plan section 11.6

function area(bbox: BBox): number {
  return bbox.width * bbox.height;
}

function centerY(bbox: BBox): number {
  return bbox.y + bbox.height / 2;
}

function centerX(bbox: BBox): number {
  return bbox.x + bbox.width / 2;
}

/**
 * Overlap resolution — NOT in the plan's section 11.
 *
 * Section 11 assumes each drawn element yields one detection. Real detector output
 * violates that: the model frequently fires two DIFFERENT classes on one drawn stroke,
 * because section 9.3's ambiguous classes (input/button/select/textarea, text/heading,
 * checkbox/radio_button) look identical hand-drawn. Per-class NMS inside the detector
 * cannot suppress these — it only deduplicates within a class.
 *
 * Left in, a duplicate does one of two harmful things:
 *   1. becomes a spurious parent — the marginally larger twin "contains" the other, so
 *      `select > textarea` or `heading > text` appears as real nesting;
 *   2. becomes a duplicate sibling, inflating row/grid counts.
 *
 * Measured across 9 real fixtures (5 sample sketches + 4 dense external images):
 *   IoU>=0.9 : 16 different-class pairs
 *   0.8-0.9  :  1
 *   0.7-0.8  :  2
 *   0.5-0.7  :  0   <- empty band
 *   0.3-0.5  :  2
 * Every pair at or above 0.727 was a genuine duplicate of one stroke (e.g.
 * `checkbox 0.67` vs `text 0.54` at IoU 0.966; `heading 0.71` vs `text 0.62` at 0.932).
 *
 * THRESHOLD 0.70 sits inside that empty band: it captures all 19 observed duplicates
 * while staying well clear of the 0.3-0.5 region where legitimately distinct elements
 * overlap. Anything in [0.5, 0.727] gives identical results on this data; 0.70 is chosen
 * as the conservative end of that range.
 *
 * Same-class overlaps are deliberately left alone — that is the detector's own NMS job,
 * and no same-class pair in the fixtures reached 0.70 anyway.
 */
const OVERLAP_IOU_THRESHOLD = 0.7;

function iou(a: BBox, b: BBox): number {
  const ix = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  );
  const iy = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  );
  const intersection = ix * iy;
  const union = area(a) + area(b) - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Drop lower-confidence duplicates of the same drawn element. Greedy by confidence
 * descending, so the surviving detection is always the model's most confident reading
 * and suppression is transitive-safe (a box suppressed by a stronger one cannot itself
 * suppress a third).
 */
export function resolveOverlappingDetections(
  detections: Detection[],
  threshold: number = OVERLAP_IOU_THRESHOLD
): Detection[] {
  const byConfidence = [...detections].sort((a, b) => b.confidence - a.confidence);
  const kept: Detection[] = [];

  for (const candidate of byConfidence) {
    const duplicate = kept.some(
      (k) =>
        k.className !== candidate.className &&
        iou(k.bbox, candidate.bbox) >= threshold
    );
    if (!duplicate) kept.push(candidate);
  }

  // Restore the input order so downstream ordering stays driven by geometry, not
  // confidence — reading order is computed later and must not depend on this pass.
  const keptIds = new Set(kept.map((d) => d.id));
  return detections.filter((d) => keptIds.has(d.id));
}

function contains(parent: BBox, child: BBox): boolean {
  const cx = centerX(child);
  const cy = centerY(child);
  return (
    cx >= parent.x &&
    cx <= parent.x + parent.width &&
    cy >= parent.y &&
    cy <= parent.y + parent.height &&
    area(child) < area(parent) * 0.98
  );
}

/** Parent inference — plan section 11.3: child center inside parent bbox, smallest such parent wins. */
function findParent(detection: Detection, all: Detection[]): Detection | null {
  let best: Detection | null = null;
  for (const candidate of all) {
    if (candidate.id === detection.id) continue;
    if (!contains(candidate.bbox, detection.bbox)) continue;
    if (!best || area(candidate.bbox) < area(best.bbox)) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Resolve the effective parent for a detection, layering a manual structure override
 * onto the auto-inferred `findParent` result. §17.3 Structure group.
 *
 * - `parentDetectionId: null`   → force to root
 * - `parentDetectionId: "..."`  → force to that detection (must be in `all`)
 * - `undefined` (no override)   → fall through to findParent's containment result
 *
 * A stored override pointing at a detection no longer in `all` (e.g. it was
 * marked `deleted` or `rejected` since the override was written) is treated the
 * same as `null`: root. The API validator refuses to WRITE such a reference in the
 * first place, so this is a state-drift safety net rather than a common path.
 */
function resolveParent(
  detection: Detection,
  all: Detection[],
  overrides: StructureOverridesByDetection | undefined
): Detection | null {
  const override = overrides?.[detection.id];
  if (override?.parentDetectionId === null) return null;
  if (typeof override?.parentDetectionId === "string") {
    return all.find((d) => d.id === override.parentDetectionId) ?? null;
  }
  return findParent(detection, all);
}

/**
 * Sort a container's direct children by (structure override displayOrder, auto index).
 * Auto index preserves whatever `groupRepeatedSiblings` produced — reading order
 * across rows, or grouped rows — so an unset displayOrder keeps the current
 * behavior verbatim. A set displayOrder wins; ties resolve by auto index.
 *
 * Synthetic group nodes (`node.type === "group"`) have no `sourceDetectionId` and
 * therefore inherit their auto position — the user's addressable unit is the
 * detection, not the synthetic container.
 */
function reorderByStructureOverrides(
  children: UINode[],
  overrides: StructureOverridesByDetection | undefined
): UINode[] {
  if (!overrides) return children;
  return children
    .map((child, autoIndex) => {
      const explicit = child.sourceDetectionId
        ? overrides[child.sourceDetectionId]?.displayOrder
        : undefined;
      const hasExplicit = typeof explicit === "number";
      return {
        child,
        autoIndex,
        orderKey: hasExplicit ? explicit! : autoIndex,
        hasExplicit,
      };
    })
    .sort((a, b) => {
      if (a.orderKey !== b.orderKey) return a.orderKey - b.orderKey;
      // Tie on the numeric key: an explicit override outranks an implicit auto
      // index. This matches the user's mental model — "pin me to 0" means "put me
      // first" even if another sibling happens to already be there. Two explicits
      // at the same value, or two implicits at the same value, fall back to the
      // auto index so a Reset of any single node returns the tree to a stable
      // deterministic order.
      if (a.hasExplicit !== b.hasExplicit) return a.hasExplicit ? -1 : 1;
      return a.autoIndex - b.autoIndex;
    })
    .map((wrapped) => wrapped.child);
}

/** Row detection — plan section 11.6: sort by y, then split on vertical-center gaps. */
function groupIntoRows(nodes: UINode[]): UINode[][] {
  const sorted = [...nodes].sort((a, b) => centerY(a.bbox) - centerY(b.bbox));
  const rows: UINode[][] = [];

  for (const node of sorted) {
    const lastRow = rows[rows.length - 1];
    if (
      lastRow &&
      Math.abs(centerY(lastRow[0].bbox) - centerY(node.bbox)) < ROW_TOLERANCE_RATIO
    ) {
      lastRow.push(node);
    } else {
      rows.push([node]);
    }
  }

  for (const row of rows) {
    row.sort((a, b) => centerX(a.bbox) - centerX(b.bbox));
  }
  return rows;
}

/** Reading order — plan section 11.5: rows top-to-bottom, items left-to-right within a row. */
function orderByReadingOrder(nodes: UINode[]): UINode[] {
  return groupIntoRows(nodes).flat();
}

function boundingBoxOf(nodes: UINode[]): BBox {
  const x = Math.min(...nodes.map((n) => n.bbox.x));
  const y = Math.min(...nodes.map((n) => n.bbox.y));
  const right = Math.max(...nodes.map((n) => n.bbox.x + n.bbox.width));
  const bottom = Math.max(...nodes.map((n) => n.bbox.y + n.bbox.height));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Repeated-structure grouping — plan section 11.8 and Appendix R (pass 3).
 * A run of same-type siblings sharing a row (a card row, a nav item row) becomes a
 * synthetic group node so the generator can emit one grid/flex container for them,
 * matching the `.ui-grid` wrapper in the plan's Appendix A, instead of stacking them.
 */
function groupRepeatedSiblings(children: UINode[]): UINode[] {
  const rows = groupIntoRows(children);
  if (rows.length < 2) return rows.flat();

  return rows.flatMap((row) => {
    const sameType = row.length > 1 && row.every((n) => n.type === row[0].type);
    if (!sameType) return row;

    return [
      {
        id: nextId(`${row[0].type}-group`),
        type: "group",
        bbox: boundingBoxOf(row),
        layout: { display: "grid" as const, columns: row.length, gap: 24 },
        children: row,
      },
    ];
  });
}

/** Grid/flex/stack inference — plan sections 11.8-11.10. */
function inferLayout(children: UINode[]): UINode["layout"] {
  if (children.length < 2) return undefined;

  const rows = groupIntoRows(children);

  if (rows.length === 1) {
    // Single row of similarly-sized items -> horizontal flex.
    return { display: "flex", direction: "row", gap: 24 };
  }

  const rowLengths = new Set(rows.map((r) => r.length));
  if (rowLengths.size === 1 && rows[0].length > 1) {
    // Regular grid: same item count per row across multiple rows.
    return { display: "grid", columns: rows[0].length, gap: 24 };
  }

  // Irregular rows, or a single column -> vertical stack.
  return { display: "flex", direction: "column", gap: 16 };
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function toUINode(detection: Detection): UINode {
  return {
    id: nextId(detection.className),
    type: detection.className,
    bbox: detection.bbox,
    sourceDetectionId: detection.id,
    children: [],
  };
}

/**
 * Build a semantic UI-IR tree from a flat list of detections.
 * Containers (plan section 11.4) receive children whose bbox center falls inside them;
 * the smallest enclosing container wins. Un-contained nodes attach to the root.
 *
 * When `structureOverrides` is passed, they layer onto the auto-inferred result:
 * parent choice is deferred to `resolveParent`, and each container's direct children
 * are re-sorted by explicit `displayOrder` (§17.3 Structure group). Auto inference
 * still runs first — an override never disables it, only redirects it — so a Reset
 * on any single override returns that node to auto behavior without unsettling the
 * rest of the tree.
 */
export function buildUITree(
  detections: Detection[],
  options: {
    name?: string;
    viewport: { width: number; height: number };
    structureOverrides?: StructureOverridesByDetection;
  }
): UIRoot {
  idCounter = 0;
  // Rejected boxes (section 10.7) never reach layout; then collapse duplicate readings
  // of the same stroke before any structure is inferred from them.
  const active = resolveOverlappingDetections(
    detections.filter((d) => d.status === "active")
  );
  const nodesById = new Map<string, UINode>();
  const parentOf = new Map<string, Detection | null>();

  for (const d of active) {
    nodesById.set(d.id, toUINode(d));
    parentOf.set(d.id, resolveParent(d, active, options.structureOverrides));
  }

  const rootChildren: UINode[] = [];

  for (const d of active) {
    const node = nodesById.get(d.id)!;
    const parent = parentOf.get(d.id);
    if (parent) {
      nodesById.get(parent.id)!.children.push(node);
    } else {
      rootChildren.push(node);
    }
  }

  // Recursively order children by reading order and infer layout, containers-first bias
  // (plan section 11.4: structural classes act as containers even with few children).
  // Structure-inspector displayOrder wins over the auto sibling order emitted by
  // groupRepeatedSiblings.
  function finalize(node: UINode): UINode {
    const grouped = groupRepeatedSiblings(node.children.map(finalize));
    node.children = reorderByStructureOverrides(grouped, options.structureOverrides);
    if (isContainerClass(node.type) || node.children.length > 1) {
      node.layout = inferLayout(node.children);
    }
    return node;
  }

  const groupedRoot = groupRepeatedSiblings(rootChildren.map(finalize));
  const orderedRoot = reorderByStructureOverrides(groupedRoot, options.structureOverrides);

  return {
    schemaVersion: "1.0",
    type: "page",
    name: options.name ?? "GeneratedPage",
    viewport: options.viewport,
    layout: inferLayout(orderedRoot),
    children: orderedRoot,
  };
}
