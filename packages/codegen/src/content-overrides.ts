import type { ContentOverride, UINode, UIRoot } from "@sketch2ui/shared-types";
import { contentFieldsFor } from "@sketch2ui/shared-types";

// Per-node content overrides — plan §17.3 Content group, Appendix Q.
//
// Shape and lifecycle mirror style-overrides.ts intentionally: same detection-uuid
// keying (stable across UI-IR node id shifts), same fold-onto-matching-source model,
// same "ignore rather than error" defense-in-depth for overrides on a class the
// content field does not apply to.
//
// Applicability is enforced twice — the API validator refuses to store an override on
// a class that cannot use it (a user hitting `PUT` gets a 400), and this applier
// checks again before writing to the tree, so a persisted override left behind by a
// later detection-class change silently disappears rather than mis-labelling the wrong
// element type. See content-override.ts for the mapping.

export type ContentOverridesByDetection = Record<string, ContentOverride>;

export function applyContentOverrides(
  root: UIRoot,
  overrides: ContentOverridesByDetection
): void {
  if (!overrides) return;
  const walk = (node: UINode): void => {
    if (node.sourceDetectionId) {
      const override = overrides[node.sourceDetectionId];
      if (override) {
        const applicable = new Set(contentFieldsFor(node.type));
        if (applicable.has("text") && override.text !== undefined) {
          node.content = override.text;
        }
        if (applicable.has("altText") && override.altText !== undefined) {
          node.altText = override.altText;
        }
        if (applicable.has("href") && override.href !== undefined) {
          node.href = override.href;
        }
      }
    }
    for (const child of node.children) walk(child);
  };
  for (const child of root.children) walk(child);
}
