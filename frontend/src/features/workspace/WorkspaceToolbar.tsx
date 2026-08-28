import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "../../components/Badge.js";
import { Button } from "../../components/Button.js";
import { IconButton } from "../../components/IconButton.js";
import { Input } from "../../components/Input.js";
import { Tooltip } from "../../components/Tooltip.js";
import { StatusIndicator } from "../../components/StatusIndicator.js";
import { cn } from "../../components/cn.js";
import { useAuth } from "../../context/AuthContext.js";

// "Top toolbar". Extracted from ProjectWorkspace.tsx's inline <header>; every action calls
// the exact same handler the page already had — this is a presentation move, not new
// behavior. The Save button's label changes from "Save code version" to "Save version" per
// an explicit rename call-out (there is no separate "Generate" step in this app — Save
// already generates and persists in one action, so the label change plus a tooltip
// explaining that is the fix, not a new control). This is a DELIBERATE, tracked
// e2e-breaking change: e2e/golden-path.spec.ts is updated in the same change that
// introduces this component.
//
// SaaS phase S5 — Phase 4 of the brief ("rename if supported" — the API already did,
// per projects.routes.ts's PATCH handler). Click-to-edit on the project name, same
// interaction pattern PagesStrip.tsx already established for page rename, so the app
// doesn't grow a second rename convention.
//
// Redesign gap-closing pass — breadcrumb (was a plain "← Projects" link), a version
// badge + save-state indicator next to the project name, three compact center status
// pills (AI model / detection / page-detection), and an avatar/account menu. Every one
// of these reads state ProjectWorkspace.tsx already computes for something else (busy
// flags, the active version entry, the detect job, the boundary) — nothing here
// invents a new signal.

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

type PillTone = "neutral" | "violet" | "success" | "error";

const PILL_DOT_CLASS: Record<PillTone, string> = {
  neutral: "bg-text-muted",
  violet: "bg-detection-model",
  success: "bg-success",
  error: "bg-error",
};

/** One compact "label value" pill for the header's center status cluster. A lighter,
 * denser sibling of StatusIndicator/Badge — those are either prose-sized or
 * single-word tags, neither fits a "AI Model · YOLOv8n" pair at header density. */
function HeaderStatusPill({
  label,
  children,
  tone = "neutral",
}: {
  label: string;
  children: ReactNode;
  tone?: PillTone;
}) {
  return (
    <span className="flex shrink-0 items-center gap-2xs whitespace-nowrap rounded-pill border border-border bg-surface-sunken px-sm py-2xs text-xs">
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PILL_DOT_CLASS[tone])} />
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-secondary">{children}</span>
    </span>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M2.5 3.5L5 6.5L7.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Small initials-avatar button opening a minimal account menu. Same outside-click-to-
 * close pattern as StatusBar.tsx's ExportsPopover — this app has no dropdown-menu
 * primitive yet, and one more two-item menu doesn't justify inventing one. */
function AvatarMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!user) return null;
  const initial = user.email.trim().charAt(0).toUpperCase() || "?";

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate("/login");
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Account menu for ${user.email}`}
        className={cn(
          "flex h-7 items-center gap-2xs rounded-pill bg-primary-subtle pl-1.5 pr-1 text-xs font-semibold text-primary-active transition-colors duration-fast",
          "hover:bg-accent-soft",
          open && "ring-2 ring-primary/40"
        )}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-pill bg-primary/15">{initial}</span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2xs flex min-w-[180px] flex-col gap-2xs rounded-md border border-border bg-surface-raised p-sm shadow-elevated">
          <span className="truncate px-xs py-2xs text-xs text-text-muted">{user.email}</span>
          <Link
            to="/app/account"
            onClick={() => setOpen(false)}
            className="rounded-sm px-xs py-2xs text-left text-xs text-text-secondary transition-colors duration-fast hover:bg-surface-sunken hover:text-text-primary"
          >
            Account
          </Link>
          <button
            onClick={() => void handleLogout()}
            className="rounded-sm px-xs py-2xs text-left text-xs text-text-secondary transition-colors duration-fast hover:bg-surface-sunken hover:text-text-primary"
          >
            Log out
          </button>
        </div>
      )}
    </div>
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
  /** e.g. "v3" — the active saved version's number, absent until one exists. */
  versionLabel?: string | null;
  /** Derived from the same busy-flag union already driving the Inspector/Preview. */
  saveState: "saved" | "saving";
  /** cv-service's reported model version, once the new health check has resolved. */
  aiModel?: string | null;
  detectionState: "idle" | "active" | "error";
  /** 0-1 page-boundary confidence, absent until a boundary has been computed. */
  pageDetectionConfidence?: number | null;
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
  versionLabel,
  saveState,
  aiModel,
  detectionState,
  pageDetectionConfidence,
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
    <header className="flex items-center justify-between gap-md border-b border-border bg-surface px-lg py-sm">
      <div className="flex min-w-0 shrink-0 items-center gap-xs">
        <Link
          to="/app"
          className="shrink-0 text-sm text-text-muted transition-colors duration-fast hover:text-text-secondary"
          aria-label="Back to projects"
        >
          ←
        </Link>
        <Link
          to="/app"
          className="shrink-0 text-sm text-text-muted transition-colors duration-fast hover:text-text-secondary"
        >
          Projects
        </Link>
        <span aria-hidden="true" className="shrink-0 text-text-disabled">
          ›
        </span>
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
          <div className="group flex min-w-0 items-center gap-2xs">
            <h1 className="truncate text-sm font-semibold text-text-primary">{projectName}</h1>
            <IconButton
              aria-label={`Rename "${projectName}"`}
              icon={<PencilIcon />}
              size="sm"
              onClick={startRename}
              className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            />
          </div>
        )}
        {versionLabel && (
          <Badge tone="neutral" className="shrink-0">
            {versionLabel}
          </Badge>
        )}
        {hasAsset && (
          <StatusIndicator
            tone={saveState === "saving" ? "brand" : "success"}
            className="shrink-0 whitespace-nowrap"
          >
            {/* Deliberately NOT the word "Saved" — InspectorPanel.tsx's Detection
                section already uses that exact string, asserted verbatim by
                e2e/golden-path.spec.ts's `getByText("Saved")`; a second match anywhere
                on the page would make that a strict-mode violation. */}
            {saveState === "saving" ? "Saving…" : "Up to date"}
          </StatusIndicator>
        )}
      </div>

      {hasAsset && (
        <div className="flex min-w-0 flex-1 items-center justify-center gap-xs overflow-x-auto">
          {aiModel && <HeaderStatusPill label="AI Model">{aiModel}</HeaderStatusPill>}
          <HeaderStatusPill
            label="Detection"
            tone={detectionState === "error" ? "error" : detectionState === "active" ? "violet" : "neutral"}
          >
            {detectionState === "error" ? "Failed" : detectionState === "active" ? "Active" : "Idle"}
          </HeaderStatusPill>
          {typeof pageDetectionConfidence === "number" && (
            <HeaderStatusPill label="Page Detection">
              {Math.round(pageDetectionConfidence * 100)}%
            </HeaderStatusPill>
          )}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-sm">
        {hasAsset && (
          <>
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

            <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
          </>
        )}
        <AvatarMenu />
      </div>
    </header>
  );
}
