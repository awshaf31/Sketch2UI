import { Link } from "react-router-dom";
import { Badge } from "../../components/Badge.js";
import { Button } from "../../components/Button.js";
import { Tooltip } from "../../components/Tooltip.js";

// docs/frontend/workspace-design.md — "Top toolbar". Extracted from
// ProjectWorkspace.tsx's inline <header>; every action calls the exact same handler
// the page already had — this is a presentation move, not new behavior. The Save
// button's label changes from "Save code version" to "Save version" per
// workspace-design.md's explicit rename call-out (there is no separate "Generate"
// step in this app — Save already generates and persists in one action, so the label
// change plus a tooltip explaining that is the fix, not a new control). This is a
// DELIBERATE, tracked e2e-breaking change — see
// docs/frontend/design-to-code-mapping.md's selector table; e2e/golden-path.spec.ts
// is updated in the same change that introduces this component.

interface WorkspaceToolbarProps {
  projectName: string;
  hasAsset: boolean;
  detecting: boolean;
  onDetect: () => void;
  approving: boolean;
  /** Precomputed "Approved · N boxes (split)" label, or null when not yet approved —
   * same formatting ProjectWorkspace.tsx already had, just handed down as a string. */
  approvedLabel: string | null;
  onApprove: () => void;
  exporting: boolean;
  onExport: () => void;
  saving: boolean;
  onSaveVersion: () => void;
}

export function WorkspaceToolbar({
  projectName,
  hasAsset,
  detecting,
  onDetect,
  approving,
  approvedLabel,
  onApprove,
  exporting,
  onExport,
  saving,
  onSaveVersion,
}: WorkspaceToolbarProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-lg py-sm">
      <div className="flex items-center gap-md">
        <Link
          to="/"
          className="text-sm text-text-muted transition-colors duration-fast hover:text-text-secondary"
        >
          ← Projects
        </Link>
        <h1 className="text-sm font-semibold text-text-primary">{projectName}</h1>
      </div>

      {hasAsset && (
        <div className="flex items-center gap-sm">
          <Tooltip content="Run the experimental component detector on this sketch">
            <Button variant="primary" size="sm" onClick={onDetect} disabled={detecting}>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-text-inverse/70" />
              {detecting ? "Detecting…" : "Detect"}
              <Badge tone="violet">Beta</Badge>
            </Button>
          </Tooltip>

          <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />

          <Tooltip content="Snapshot this sketch's current boxes as approved training data">
            <Button variant="tinted" tint="success" size="sm" onClick={onApprove} disabled={approving}>
              {approving ? "Approving…" : approvedLabel ?? "Approve for training"}
            </Button>
          </Tooltip>

          <Tooltip content="Download this project's generated HTML/CSS as a ZIP">
            <Button variant="tinted" tint="info" size="sm" onClick={onExport} disabled={exporting}>
              {exporting ? "Packaging…" : "Export ZIP"}
            </Button>
          </Tooltip>

          <Tooltip content="Save version — generates and saves the current code">
            <Button variant="secondary" size="sm" onClick={onSaveVersion} disabled={saving}>
              {saving ? "Saving…" : "Save version"}
            </Button>
          </Tooltip>
        </div>
      )}
    </header>
  );
}
