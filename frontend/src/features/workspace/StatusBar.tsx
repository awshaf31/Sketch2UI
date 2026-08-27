import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PageBoundary, ProjectExport } from "@sketch2ui/shared-types";
import { IconButton } from "../../components/IconButton.js";
import { StatusIndicator } from "../../components/StatusIndicator.js";
import { cn } from "../../components/cn.js";

// "Status bar: consolidating four banners into one". A single fixed-height (h-10) row that
// scrolls horizontally rather than growing vertically as segments appear/disappear — the
// direct fix for the Phase 1 audit's §4/§22 finding that up to four stacked colored banners
// pushed the workspace down by an unpredictable amount depending on project state.
//
// The five segments are implemented here as named exports in one file rather than five
// separate files: each is small and only ever composed by this one StatusBar, so keeping
// them together avoids fragmenting for its own sake (a documented deviation from the
// roadmap's literal file list). The "RejectedCountSegment" is folded into
// PageBoundarySegment (a couple of words and a checkbox that are meaningless without
// boundary context, not a standalone segment).

export function StatusBar({ segments }: { segments: ReactNode[] }) {
  const visible = segments.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <div className="flex h-10 items-center gap-lg overflow-x-auto border-b border-border bg-surface-sunken px-lg text-xs">
      {visible.map((segment, i) => (
        <div key={i} className="flex shrink-0 items-center gap-lg">
          {i > 0 && <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />}
          {segment}
        </div>
      ))}
    </div>
  );
}

/** Short uppercase prefix ("AI"/"Page") distinguishing which segment a status
 * message belongs to — the fix for the model warning and boundary warning
 * otherwise reading as one undifferentiated stream of text. */
function SegmentLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mr-2xs font-mono text-2xs font-semibold uppercase tracking-wide text-text-muted">
      {children}
    </span>
  );
}

function DismissIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  );
}

interface DetectJobSegmentProps {
  running: boolean;
  error: string | null;
  stage?: string | null;
  progress?: number | null;
  retryable?: boolean;
  modelCount: number;
  onDismissError: () => void;
}

export function DetectJobSegment({
  running,
  error,
  stage,
  progress,
  retryable,
  modelCount,
  onDismissError,
}: DetectJobSegmentProps) {
  if (error) {
    return (
      <span className="flex shrink-0 items-center gap-sm whitespace-nowrap">
        <StatusIndicator tone="error">
          <SegmentLabel>AI</SegmentLabel>
          <strong className="font-semibold text-text-primary">Detection failed.</strong> {error}
          {retryable === false && " This will not succeed on retry."}
        </StatusIndicator>
        <IconButton aria-label="Dismiss detection error" size="sm" icon={<DismissIcon />} onClick={onDismissError} />
      </span>
    );
  }
  if (running) {
    return (
      <StatusIndicator tone="violet" className="shrink-0 whitespace-nowrap">
        <SegmentLabel>AI</SegmentLabel>
        Detecting components… {stage ? stage.replace(/_/g, " ") : "queued"}
        {typeof progress === "number" ? ` · ${progress}%` : ""}
      </StatusIndicator>
    );
  }
  if (modelCount > 0) {
    return (
      <StatusIndicator tone="violet" className="shrink-0 whitespace-nowrap">
        <SegmentLabel>AI</SegmentLabel>
        <strong className="font-semibold text-text-primary">{modelCount}</strong> box
        {modelCount === 1 ? "" : "es"} from the detector (dashed purple). This model is{" "}
        <strong className="font-semibold text-text-primary">experimental</strong> — accuracy varies a
        lot by component type, so check every box and correct it as you would your own.
      </StatusIndicator>
    );
  }
  return null;
}

interface PageBoundarySegmentProps {
  boundary: PageBoundary;
  editingBoundary: boolean;
  onToggleEditing: () => void;
  rejectedCount: number;
  showRejected: boolean;
  onToggleShowRejected: (value: boolean) => void;
}

export function PageBoundarySegment({
  boundary,
  editingBoundary,
  onToggleEditing,
  rejectedCount,
  showRejected,
  onToggleShowRejected,
}: PageBoundarySegmentProps) {
  return (
    <span className="flex shrink-0 items-center gap-sm whitespace-nowrap">
      <StatusIndicator tone="boundary">
        <SegmentLabel>Page</SegmentLabel>
        {boundary.applied ? (
          <>
            <strong className="font-semibold text-text-primary">Page detected</strong> — confidence:{" "}
            {Math.round(boundary.confidence * 100)}%
          </>
        ) : (
          <strong className="font-semibold text-text-primary">No page detected — using full image</strong>
        )}
      </StatusIndicator>

      <button
        onClick={onToggleEditing}
        className="rounded-sm border border-border px-xs py-2xs text-xs text-text-secondary transition-colors duration-fast hover:bg-surface"
      >
        {editingBoundary ? "Done adjusting" : "Adjust boundary"}
      </button>

      {rejectedCount > 0 && (
        <label className="flex items-center gap-2xs text-text-muted">
          <strong className="text-text-secondary">{rejectedCount}</strong> outside page
          <input
            type="checkbox"
            checked={showRejected}
            onChange={(e) => onToggleShowRejected(e.target.checked)}
          />
        </label>
      )}

      {!boundary.applied && (
        <span className="text-text-muted">Drag the boundary to set it manually.</span>
      )}
    </span>
  );
}

export function ActiveVersionSegment({ label }: { label: string }) {
  return (
    <StatusIndicator tone="brand" className="shrink-0 whitespace-nowrap">
      {label}
    </StatusIndicator>
  );
}

interface ExportsPopoverProps {
  exports: (ProjectExport & { downloadUrl: string })[];
  resolveDownloadUrl: (path: string) => string;
}

export function ExportsPopover({ exports, resolveDownloadUrl }: ExportsPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (exports.length === 0) return null;

  return (
    <span ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2xs whitespace-nowrap rounded-sm border px-xs py-2xs text-xs transition-colors duration-fast",
          open ? "border-info bg-info-subtle text-info" : "border-border text-text-secondary hover:bg-surface"
        )}
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-info" />
        Exports ({exports.length})
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2xs flex min-w-[160px] flex-col gap-2xs rounded-md border border-border bg-surface-raised p-sm shadow-elevated">
          {exports.map((e) => (
            <a
              key={e.id}
              href={resolveDownloadUrl(e.downloadUrl)}
              className="whitespace-nowrap rounded-sm px-xs py-2xs text-xs text-text-secondary transition-colors duration-fast hover:bg-surface-sunken hover:text-text-primary"
            >
              v{e.versionNumber} · {(e.fileSize / 1024).toFixed(0)} KB
            </a>
          ))}
        </div>
      )}
    </span>
  );
}
