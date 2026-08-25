import type { AssetResolver } from "@sketch2ui/codegen";
import type { UINode } from "@sketch2ui/shared-types";

// The two asset-resolution policies (plan §15.5). codegen itself stays free of any
// API/storage knowledge; these supply it from the outside.

/**
 * Live preview: point at the crop route, which the browser can fetch from the running
 * API. Absolute so it resolves inside the sandboxed srcdoc iframe, which has an opaque
 * origin and therefore no base URL to resolve a relative path against — the exact reason
 * the old `./assets/<id>.png` paths rendered as broken images.
 */
export function previewAssetResolver(apiBaseUrl: string, projectId: string, pageId: string): AssetResolver {
  return (node: UINode) =>
    node.sourceDetectionId
      ? `${apiBaseUrl}/api/projects/${projectId}/pages/${pageId}/detections/${node.sourceDetectionId}/crop.png`
      : null;
}

/**
 * Export: relative paths matching what gets written into the ZIP, so the package works
 * over file:// with no server. Records node -> detection so the ZIP builder knows which
 * crop bytes to place at which path.
 */
export function exportAssetResolver(collect: Map<string, string>): AssetResolver {
  return (node: UINode) => {
    if (!node.sourceDetectionId) return null;
    const relPath = `assets/${node.id}.png`;
    collect.set(relPath, node.sourceDetectionId);
    return `./${relPath}`;
  };
}
