import { useMemo, useState } from "react";
import { cn } from "../../components/cn.js";
import { EmptyState } from "../../components/EmptyState.js";

// docs/frontend/code-preview-design.md (Phase 2I) — frame chrome, a loading progress
// line, and an empty state, all new. The iframe's `sandbox=""` attribute, its
// `srcDoc`/`title="Live preview"`, and `composeDocument()`'s asset-path rewrite logic
// are byte-for-byte unchanged below — this is the app's one deliberate security
// boundary (docs/frontend/README.md's non-negotiable constraints table), and this
// phase's diff must be reviewable as touching none of it.

interface PreviewPaneProps {
  html: string;
  css: string;
  /**
   * A stored CodeVersion's html uses relative `./assets/<id>.png` paths so an exported
   * ZIP works over file://; the sandboxed srcdoc iframe cannot resolve those against a
   * base URL (opaque origin, §15.4). When previewing such a version, supply this to
   * rewrite each referenced path to an absolute crop URL — returning null for a given
   * path drops the src and shows the browser's broken-image icon rather than the wrong
   * substitution.
   */
  resolveAssetPath?: (relPath: string) => string | null;
  /**
   * True while any Inspector Apply or code save is in flight — shows a thin progress
   * line so a regenerate-in-progress isn't silently invisible. The caller passes its
   * own existing busy signals; no new state lives in this component for it.
   */
  loading?: boolean;
}

const VIEWPORTS = {
  desktop: { label: "Desktop", width: "100%" },
  tablet: { label: "Tablet", width: "768px" },
  mobile: { label: "Mobile", width: "375px" },
} as const;

type ViewportKey = keyof typeof VIEWPORTS;

function composeDocument(
  html: string,
  css: string,
  resolveAssetPath?: (relPath: string) => string | null
): string {
  let out = html;
  if (resolveAssetPath) {
    out = out.replace(/(<img\b[^>]*\bsrc=")\.\/(assets\/[^"]+)(")/g, (match, prefix, relPath, suffix) => {
      const resolved = resolveAssetPath(relPath);
      return resolved ? `${prefix}${resolved}${suffix}` : match;
    });
  }
  // Preview-only fallback for an <img> that fails to load (an unresolved crop, or a
  // resolveAssetPath miss — see the doc comment above). Never shipped in the exported
  // ZIP's own styles.css: this string only ever reaches this in-app iframe's srcDoc.
  // A failed <img> renders its `alt` text using the element's own CSS box/font, so
  // giving it a neutral background/border/centered text turns the browser's native
  // broken-image icon into a plain placeholder chip instead of a jagged "this looks
  // like a bug" glyph. Harmless for images that DO load — an already-opaque image
  // fully covers its own background/border, and centering flex properties are inert
  // on an element with no child boxes to lay out.
  const previewOnlyStyle = `<style>
img {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  background-color: #eef0f4;
  border: 1px dashed #dde1e8;
  color: #848da0;
  font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
  font-size: 11px;
  text-align: center;
  object-fit: cover;
}
</style>`;
  const styleTag = `${previewOnlyStyle}\n<style>\n${css}\n</style>`;
  if (out.includes('<link rel="stylesheet" href="./styles.css" />')) {
    return out.replace('<link rel="stylesheet" href="./styles.css" />', styleTag);
  }
  return out.replace("</head>", `${styleTag}\n</head>`);
}

export default function PreviewPane({ html, css, resolveAssetPath, loading }: PreviewPaneProps) {
  const [viewport, setViewport] = useState<ViewportKey>("desktop");
  const doc = useMemo(
    () => composeDocument(html, css, resolveAssetPath),
    [html, css, resolveAssetPath]
  );
  const isEmpty = html.trim() === "";
  const widthLabel = VIEWPORTS[viewport].width === "100%" ? "Desktop" : VIEWPORTS[viewport].width;

  return (
    <div className="relative flex h-full flex-col">
      {loading && (
        <div aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-primary-subtle">
          <div className="h-full w-full animate-pulse bg-primary motion-reduce:animate-none" />
        </div>
      )}

      <div className="flex items-center gap-2xs border-b border-border px-sm py-xs">
        {(Object.keys(VIEWPORTS) as ViewportKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setViewport(key)}
            className={cn(
              "rounded-sm px-sm py-2xs text-xs transition-colors duration-fast",
              viewport === key ? "bg-primary text-text-inverse" : "text-text-muted hover:bg-surface-sunken"
            )}
          >
            {VIEWPORTS[key].label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-auto bg-surface-sunken p-lg">
        {isEmpty ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              title="Nothing to preview yet"
              description="Add a component to the sketch to see it here."
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center gap-2xs">
            <span className="shrink-0 font-mono text-2xs text-text-muted">{widthLabel}</span>
            <iframe
              title="Live preview"
              srcDoc={doc}
              sandbox=""
              className="min-h-0 flex-1 rounded-md border border-border bg-surface shadow-subtle"
              style={{ width: VIEWPORTS[viewport].width }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
