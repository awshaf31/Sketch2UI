import type { Detection, UIRoot } from "@sketch2ui/shared-types";
import type { AssetResolver } from "./html.js";
import { buildUITree } from "./layout.js";
import { generateHTML } from "./html.js";
import { generateCSS } from "./css.js";
import { applyStyleOverrides, type StyleOverridesByDetection } from "./style-overrides.js";
import { applyContentOverrides, type ContentOverridesByDetection } from "./content-overrides.js";

export { buildUITree, resolveOverlappingDetections } from "./layout.js";
export { generateHTML } from "./html.js";
export type { AssetResolver, GenerateHTMLOptions } from "./html.js";
export { generateCSS } from "./css.js";
export { applyStyleOverrides } from "./style-overrides.js";
export type { NodeStyle, StyleOverridesByDetection } from "./style-overrides.js";
export { applyContentOverrides } from "./content-overrides.js";
export type { ContentOverridesByDetection } from "./content-overrides.js";

export interface GeneratedCode {
  html: string;
  css: string;
  /** The UI-IR the code was generated from — callers need it to map nodes back to
   *  detections when writing crop bytes. */
  tree: UIRoot;
}

/** End-to-end: detections -> UI-IR -> HTML + CSS (plan sections 11-14). */
export function generateCode(
  detections: Detection[],
  options: {
    name?: string;
    viewport: { width: number; height: number };
    /** Supplies real crop srcs for drawn regions — see AssetResolver. */
    resolveAsset?: AssetResolver;
    /**
     * Manual per-node style tweaks from the inspector (§6.7 / §17.3), keyed on the
     * detection uuid of the node. Layered on top of the auto-inferred layout — see
     * style-overrides.ts and the trailing block ordering in css.ts.
     */
    styleOverrides?: StyleOverridesByDetection;
    /**
     * Manual per-node content tweaks from the inspector (§17.3 Content, Appendix Q):
     * text, alt text, href. Same detection-uuid keying as styleOverrides; codegen
     * only applies fields the class accepts (see CONTENT_APPLICABILITY).
     */
    contentOverrides?: ContentOverridesByDetection;
  }
): GeneratedCode {
  const tree = buildUITree(detections, options);
  // Content first, then style — content changes the text/alt/href, style changes the
  // layout; order does not actually matter because they touch disjoint fields, but
  // applying content first mirrors the read-order in a mental "what will this look
  // like" pass and keeps the two independent.
  if (options.contentOverrides) applyContentOverrides(tree, options.contentOverrides);
  if (options.styleOverrides) applyStyleOverrides(tree, options.styleOverrides);
  return {
    html: generateHTML(tree, { resolveAsset: options.resolveAsset }),
    css: generateCSS(tree),
    tree,
  };
}
