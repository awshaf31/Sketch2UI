import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Dialog } from "../../components/Dialog.js";
import { Button } from "../../components/Button.js";
import { StatusIndicator } from "../../components/StatusIndicator.js";
import type { StatusTone } from "../../components/StatusIndicator.js";
import type { SystemStatus } from "../../services/api.js";

// Persistent bottom status bar — new capability (the reference design's footer), not
// present before this redesign pass. Every value here is real: "AI Service" reflects
// whether useSystemStatus.ts's poll of GET /api/system/status resolves at all, "CV
// Worker" is that same response's field (backed by cv-service's own real /health, see
// backend/src/modules/system/status.routes.ts), and "Autosaved" is a real timestamp the
// caller bumps at every persisted save this app already makes — there is no separate
// autosave mechanism being invented here.

function formatRelativeTime(from: Date, now: number): string {
  const seconds = Math.max(0, Math.round((now - from.getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

const CV_WORKER_LABEL: Record<NonNullable<SystemStatus["cvWorker"]>, string> = {
  connected: "Connected",
  degraded: "Degraded (model not loaded)",
  unreachable: "Unreachable",
};

const CV_WORKER_TONE: Record<NonNullable<SystemStatus["cvWorker"]>, StatusTone> = {
  connected: "success",
  degraded: "warning",
  unreachable: "error",
};

function FooterButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-sm px-xs py-2xs text-xs text-text-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-text-secondary"
    >
      {children}
    </button>
  );
}

const SHORTCUTS: Array<[string, string]> = [
  ["Ctrl/Cmd + Z", "Undo the last box create/move/resize/delete/class change"],
  ["Ctrl/Cmd + Shift + Z", "Redo"],
  ["Ctrl/Cmd + / − / 0", "Zoom canvas in / out / reset"],
  ["Delete / Backspace", "Remove the selected box"],
  ["Arrow keys", "Nudge the selected box by 1px (hold Shift for 10px)"],
  ["Tab, then Enter", "Focus a box on the canvas, then select it"],
];

interface SystemStatusBarProps {
  cvWorker: SystemStatus["cvWorker"] | null;
  apiReachable: boolean;
  lastSavedAt: Date | null;
}

export function SystemStatusBar({ cvWorker, apiReachable, lastSavedAt }: SystemStatusBarProps) {
  const [now, setNow] = useState(() => Date.now());
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Only ticks while there's a timestamp to keep fresh — no timer running before the
  // first save of the session.
  useEffect(() => {
    if (!lastSavedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lastSavedAt]);

  return (
    <>
      <div className="flex h-8 shrink-0 items-center gap-lg overflow-x-auto border-t border-border bg-surface-sunken px-lg text-xs">
        <StatusIndicator tone={apiReachable ? "success" : "error"} className="shrink-0 whitespace-nowrap">
          AI Service <span className="ml-2xs text-text-muted">{apiReachable ? "Connected" : "Unreachable"}</span>
        </StatusIndicator>
        <StatusIndicator
          tone={cvWorker ? CV_WORKER_TONE[cvWorker] : "neutral"}
          className="shrink-0 whitespace-nowrap"
        >
          CV Worker <span className="ml-2xs text-text-muted">{cvWorker ? CV_WORKER_LABEL[cvWorker] : "Checking…"}</span>
        </StatusIndicator>
        {lastSavedAt && (
          // Deliberately NOT "Saved"/"Autosaved" — InspectorPanel.tsx's Detection
          // section already renders the exact string "Saved", asserted verbatim by
          // e2e/golden-path.spec.ts's `getByText("Saved")` (case-insensitive substring
          // match); this footer text must not collide with that.
          <span className="shrink-0 whitespace-nowrap text-text-muted">
            Synced {formatRelativeTime(lastSavedAt, now)}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2xs">
          <FooterButton onClick={() => setShortcutsOpen(true)}>Keyboard shortcuts</FooterButton>
          <FooterButton onClick={() => setHelpOpen(true)}>Help</FooterButton>
        </span>
      </div>

      <Dialog
        open={shortcutsOpen}
        onDismiss={() => setShortcutsOpen(false)}
        title="Keyboard shortcuts"
        actions={
          <Button variant="secondary" size="sm" onClick={() => setShortcutsOpen(false)}>
            Close
          </Button>
        }
      >
        <dl className="space-y-xs">
          {SHORTCUTS.map(([key, description]) => (
            <div key={key} className="flex items-baseline justify-between gap-md">
              <dt className="shrink-0 rounded-sm border border-border bg-surface-sunken px-xs py-2xs font-mono text-2xs text-text-secondary">
                {key}
              </dt>
              <dd className="text-right text-xs text-text-secondary">{description}</dd>
            </div>
          ))}
        </dl>
      </Dialog>

      <Dialog
        open={helpOpen}
        onDismiss={() => setHelpOpen(false)}
        title="How Sketch2UI works"
        actions={
          <Button variant="secondary" size="sm" onClick={() => setHelpOpen(false)}>
            Close
          </Button>
        }
      >
        <ol className="list-decimal space-y-xs pl-lg text-xs text-text-secondary">
          <li>Upload a sketch to start this page.</li>
          <li>Click Detect to find components automatically, or draw boxes by hand.</li>
          <li>Select a box — on the canvas or in Layers — to inspect and correct it.</li>
          <li>Save a version to generate HTML/CSS from the current boxes.</li>
          <li>Export the ZIP once the generated page looks right.</li>
        </ol>
      </Dialog>
    </>
  );
}
