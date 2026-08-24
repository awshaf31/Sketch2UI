import { useMemo, useState } from "react";

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

export default function PreviewPane({ html, css, resolveAssetPath }: PreviewPaneProps) {
  const [viewport, setViewport] = useState<ViewportKey>("desktop");
  const doc = useMemo(
    () => composeDocument(html, css, resolveAssetPath),
    [html, css, resolveAssetPath]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-gray-200 px-2 py-1.5">
        {(Object.keys(VIEWPORTS) as ViewportKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setViewport(key)}
            className={`rounded px-2 py-1 text-xs ${
              viewport === key ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {VIEWPORTS[key].label}
          </button>
        ))}
      </div>
      <div className="flex flex-1 justify-center overflow-auto bg-gray-100 p-4">
        <iframe
          title="Live preview"
          srcDoc={doc}
          sandbox=""
          className="h-full rounded border border-gray-200 bg-white shadow-sm"
          style={{ width: VIEWPORTS[viewport].width }}
        />
      </div>
    </div>
  );
}
