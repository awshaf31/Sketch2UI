import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/Badge.js";
import { Button } from "../../components/Button.js";
import { IconButton } from "../../components/IconButton.js";
import { Input } from "../../components/Input.js";
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
//
// SaaS phase S5 — Phase 4 of the brief ("rename if supported" — the API already did,
// per projects.routes.ts's PATCH handler). Click-to-edit on the project name, same
// interaction pattern PagesStrip.tsx already established for page rename, so the app
// doesn't grow a second rename convention.

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path
        d="M11.3 2.3a1 1 0 0 1 1.4 0l1 1a1 1 0 0 1 0 1.4l-7.2 7.2-3 .8.8-3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface WorkspaceToolbarProps {
  projectName: string;
  onRenameProject: (name: string) => void | Promise<void>;
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
  onRenameProject,
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
  const [editing, setEditing] = useState(false);
  const [editingValue, setEditingValue] = useState(projectName);

  function startRename() {
    setEditingValue(projectName);
    setEditing(true);
  }

  async function commitRename() {
    const name = editingValue.trim();
    setEditing(false);
    if (!name || name === projectName) return;
    await onRenameProject(name);
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-lg py-sm">
      <div className="flex items-center gap-md">
        <Link
          to="/app"
          className="text-sm text-text-muted transition-colors duration-fast hover:text-text-secondary"
        >
          ← Projects
        </Link>
        {editing ? (
          <Input
            autoFocus
            size="sm"
            aria-label="Project name"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={() => void commitRename()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-7 w-56"
          />
        ) : (
          <div className="group flex items-center gap-2xs">
            <h1 className="text-sm font-semibold text-text-primary">{projectName}</h1>
            <IconButton
              aria-label={`Rename "${projectName}"`}
              icon={<PencilIcon />}
              size="sm"
              onClick={startRename}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            />
          </div>
        )}
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
