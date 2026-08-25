import { useMemo, useState } from "react";
import { cn } from "../../components/cn.js";

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
  const styleTag = `<style>\n${css}\n</style>`;
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
            <p className="text-sm text-text-muted">Nothing to preview yet — add a component to the sketch.</p>
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
