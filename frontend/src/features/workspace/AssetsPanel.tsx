import type { ProjectAsset } from "@sketch2ui/shared-types";
import { EmptyState } from "../../components/EmptyState.js";
import { api } from "../../services/api.js";
import { cn } from "../../components/cn.js";

// the Navigator's "Assets" tab. Read-only by design: upload stays the first-run dropzone,
// because this product's story is one sketch per page, not a media library (§11.3).
//
// Every field rendered here is already on ProjectAsset — mimeType, width, height,
// fileSize, createdAt. Nothing is computed, estimated, or invented (§11.6).
//
// One naming note: `storageKey` is a generated "<uuid>.png", not the name the user's
// file had on disk (the API doesn't persist the original filename), so showing it as
// a "filename" would be noise dressed up as information. The row is labelled by the
// asset's real position in this page's list instead, with the storage key available
// on hover via title= for anyone who needs to correlate it with the uploads dir.

function ImageIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="5.75" cy="6.25" r="1" />
      <path d="M3 11.5l3.2-3a1 1 0 0 1 1.35-.05L13 13" strokeLinejoin="round" />
    </svg>
  );
}

/** Bytes -> a short human string. Binary units, one decimal above KB. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** "image/png" -> "PNG". Falls back to the raw subtype for anything unexpected. */
function formatType(mimeType: string): string {
  const subtype = mimeType.split("/")[1] ?? mimeType;
  return subtype.toUpperCase();
}

interface AssetsPanelProps {
  projectId: string;
  pageId: string | null;
  assets: ProjectAsset[];
  /** The asset currently driving the canvas, so the list can mark which one is live. */
  activeAssetId: string | null;
}

export function AssetsPanel({ projectId, pageId, assets, activeAssetId }: AssetsPanelProps) {
  if (!pageId || assets.length === 0) {
    return (
      <div className="p-lg">
        <EmptyState
          icon={<ImageIcon />}
          title="No assets on this page yet"
          description="Upload a wireframe sketch to get started."
        />
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2xs overflow-y-auto p-xs">
      {assets.map((asset, index) => {
        const active = asset.id === activeAssetId;
        const label = `Sketch ${index + 1}`;
        return (
          <li
            key={asset.id}
            title={asset.storageKey}
            className={cn(
              "flex items-center gap-sm rounded-sm p-2xs",
              active ? "bg-primary-subtle" : "hover:bg-surface-sunken"
            )}
          >
            <img
              src={api.assetUrl(projectId, pageId, asset.id)}
              alt={label}
              // object-contain, light ground: a sketch is dark-on-white line art, so
              // cropping it (object-cover) would routinely cut the drawing in half.
              className="h-9 w-9 shrink-0 rounded-sm border border-border bg-surface object-contain"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span
                className={cn(
                  "truncate text-xs font-medium",
                  active ? "text-primary" : "text-text-primary"
                )}
              >
                {label}
                {/* Not color-only (§3.6): the live asset says so in words. */}
                {active && <span className="ml-xs font-normal text-2xs text-primary">· on canvas</span>}
              </span>
              <span className="truncate font-mono text-2xs text-text-muted">
                {asset.width} × {asset.height} · {formatType(asset.mimeType)} · {formatSize(asset.fileSize)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
