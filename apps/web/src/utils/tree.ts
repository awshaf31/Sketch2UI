import type {
  AssetResolver,
  ContentOverridesByDetection,
  StyleOverridesByDetection,
} from "@sketch2ui/codegen";
import type { Detection, GeometryOverridesByDetection } from "@sketch2ui/shared-types";
import { applyGeometryOverrides } from "@sketch2ui/shared-types";
import {
  applyContentOverrides,
  applyStyleOverrides,
  buildUITree,
  generateCSS,
  generateHTML,
} from "@sketch2ui/codegen";

export function buildTreeAndCode(
  detections: Detection[],
  viewport: { width: number; height: number },
  name = "GeneratedPage",
  /** Supplies real crop URLs for drawn regions — see plan §15.5. */
  resolveAsset?: AssetResolver,
  /** Style-inspector tweaks (§6.7 / §17.3) folded into the tree before rendering. */
  styleOverrides?: StyleOverridesByDetection,
  /** Content-inspector tweaks (§17.3 Content, Appendix Q). */
  contentOverrides?: ContentOverridesByDetection,
  /**
   * Geometry-inspector tweaks (§17.3 Geometry) — applied to the detection bboxes
   * BEFORE the tree is built so containment and row grouping key off the
   * effective positions. Symmetrical with the server-side generateCode path.
   */
  geometryOverrides?: GeometryOverridesByDetection
) {
  const withGeometry = geometryOverrides
    ? applyGeometryOverrides(detections, geometryOverrides)
    : detections;
  const tree = buildUITree(withGeometry, { name, viewport });
  if (contentOverrides) applyContentOverrides(tree, contentOverrides);
  if (styleOverrides) applyStyleOverrides(tree, styleOverrides);
  return {
    tree,
    html: generateHTML(tree, { resolveAsset }),
    css: generateCSS(tree),
  };
}
