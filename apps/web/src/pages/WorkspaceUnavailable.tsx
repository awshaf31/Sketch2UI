import { useState } from "react";
import { Link } from "react-router-dom";
import type { Project, ProjectAsset } from "@sketch2ui/shared-types";
import { AppHeader } from "../components/AppHeader.js";
import { Button } from "../components/Button.js";
import PreviewPane from "../features/preview/PreviewPane.js";

// docs/frontend/responsive-design.md — below 768px, the workspace does not attempt
// the full editor (precise box-drawing on a phone screen isn't a workflow worth
// pretending to support). This is a deliberate product boundary, stated on screen
// instead of a silently-broken layout — rendered conditionally inside
// ProjectWorkspace based on viewport width, not a new route.

interface WorkspaceUnavailableProps {
  project: Project;
  asset: ProjectAsset | null;
  assetImageUrl: string | null;
  hasCodeVersion: boolean;
  html: string;
  css: string;
  resolveAssetPath?: (relPath: string) => string | null;
}

export function WorkspaceUnavailable({
  project,
  asset,
  assetImageUrl,
  hasCodeVersion,
  html,
  css,
  resolveAssetPath,
}: WorkspaceUnavailableProps) {
  const [showPreview, setShowPreview] = useState(false);

  if (showPreview) {
    return (
      <div className="flex h-screen flex-col bg-bg">
        <div className="flex items-center gap-sm border-b border-border px-lg py-sm">
          <Button variant="secondary" size="sm" onClick={() => setShowPreview(false)}>
            ← Back
          </Button>
          <span className="text-sm font-semibold text-text-primary">{project.name}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <PreviewPane html={html} css={css} resolveAssetPath={resolveAssetPath} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-bg">
      <AppHeader />
      <div className="mx-auto max-w-[420px] px-lg pb-3xl pt-3xl text-center">
        <h1 className="text-xl font-semibold text-text-primary">{project.name}</h1>
        <p className="mt-sm text-sm text-text-secondary">
          The project workspace needs a larger screen for precise annotation. Open this
          project on a tablet or desktop to continue.
        </p>

        <div className="mt-xl rounded-lg border border-border bg-surface p-lg text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Status</p>
          <p className="mt-2xs text-sm text-text-primary">{project.status}</p>

          {asset && assetImageUrl && (
            <>
              <p className="mt-md text-xs font-semibold uppercase tracking-wide text-text-muted">
                Sketch
              </p>
              <img
                src={assetImageUrl}
                alt="Sketch"
                className="mt-2xs w-full rounded-sm border border-border"
              />
            </>
          )}
        </div>

        {hasCodeVersion && (
          <Button variant="primary" size="lg" className="mt-xl w-full" onClick={() => setShowPreview(true)}>
            View live preview
          </Button>
        )}

        <Link
          to="/"
          className="mt-lg inline-block text-sm text-text-muted transition-colors duration-fast hover:text-text-secondary"
        >
          ← Back to projects
        </Link>
      </div>
    </div>
  );
}
