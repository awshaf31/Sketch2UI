import type {
  AssetResolver,
  ContentOverridesByDetection,
  StyleOverridesByDetection,
} from "@sketch2ui/codegen";
import type { Detection } from "@sketch2ui/shared-types";
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
  contentOverrides?: ContentOverridesByDetection
) {
  const tree = buildUITree(detections, { name, viewport });
  if (contentOverrides) applyContentOverrides(tree, contentOverrides);
  if (styleOverrides) applyStyleOverrides(tree, styleOverrides);
  return {
    tree,
    html: generateHTML(tree, { resolveAsset }),
    css: generateCSS(tree),
  };
}
