import { Router } from "express";
import { v4 as uuid } from "uuid";
import type { CodeVersion } from "@sketch2ui/shared-types";
import { validateGeneratedCode } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import { sendError } from "../../middleware/apiError.js";
import type { ProjectParams } from "../../types.js";

// Code version history and hand-editing — plan §6.9 ("read-only mode initially, then
// add editable mode"), §39 V1 tier.
//
// IMMUTABILITY IS PRESERVED. A hand-edit never mutates an existing CodeVersion; it
// appends a new one with source "edited". Export (§18.8) and the evaluation baseline
// both depend on a version's contents never changing underneath them, and a
// mutate-in-place edit would quietly break both.

export const codeVersionsRouter = Router({ mergeParams: true });

interface VersionParams extends ProjectParams {
  versionId: string;
}

function listVersions(projectId: string): CodeVersion[] {
  return db.state.codeVersions
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

/** The version preview and export use: the explicit choice, else the latest. */
export function resolveActiveVersion(projectId: string): CodeVersion | undefined {
  const project = db.state.projects.find((p) => p.id === projectId);
  const versions = listVersions(projectId);
  if (project?.activeCodeVersionId) {
    const pinned = versions.find((v) => v.id === project.activeCodeVersionId);
    if (pinned) return pinned;
  }
  return versions[0];
}

// GET /api/projects/:id/code-versions — full history.
codeVersionsRouter.get<ProjectParams>("/", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  const active = resolveActiveVersion(project.id);
  res.json({
    activeVersionId: active?.id ?? null,
    versions: listVersions(project.id).map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      source: v.source,
      createdAt: v.createdAt,
      htmlBytes: v.html.length,
      cssBytes: v.css.length,
      isActive: v.id === active?.id,
    })),
  });
});

// GET /api/projects/:id/code-versions/:versionId — one version's full content.
codeVersionsRouter.get<VersionParams>("/:versionId", (req, res) => {
  const version = db.state.codeVersions.find(
    (c) => c.id === req.params.versionId && c.projectId === req.params.id
  );
  if (!version) return sendError(res, 404, "NOT_FOUND", "Code version not found.");
  res.json(version);
});

/**
 * POST /api/projects/:id/code-versions — save a hand-edited page as a NEW version.
 *
 * The generator endpoint (POST /code-generation-jobs) takes no body and always renders
 * from the UI-IR; this is its counterpart for user-authored content.
 */
codeVersionsRouter.post<ProjectParams>("/", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  const { html, css, basedOnVersionId } = (req.body ?? {}) as {
    html?: unknown;
    css?: unknown;
    basedOnVersionId?: unknown;
  };

  if (typeof html !== "string" || typeof css !== "string") {
    return sendError(res, 400, "VALIDATION_FAILED", "Both html and css are required.");
  }

  // §21.4 checks, via the shared validator the evaluation harness also uses. Broken
  // code is never persisted — a saved version that does not parse would poison export
  // and the preview alike.
  const validation = validateGeneratedCode(html, css);
  if (!validation.ok) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_FAILED",
        message: validation.issues.map((i) => i.message).join(" "),
        retryable: false,
        issues: validation.issues,
      },
    });
  }

  // Carry the asset map forward from whatever version the edit started from, so image
  // paths in a hand-edited page still resolve to real crops at export time.
  const basis =
    typeof basedOnVersionId === "string"
      ? db.state.codeVersions.find((c) => c.id === basedOnVersionId && c.projectId === project.id)
      : resolveActiveVersion(project.id);

  const existing = db.state.codeVersions.filter((c) => c.projectId === project.id);
  const version: CodeVersion = {
    id: uuid(),
    projectId: project.id,
    versionNumber: existing.length + 1,
    source: "edited",
    html,
    css,
    metadata: basis?.metadata ? { ...basis.metadata } : undefined,
    createdAt: new Date().toISOString(),
  };

  db.state.codeVersions.push(version);
  // A freshly saved edit becomes what you are looking at — otherwise the preview would
  // keep showing the old version and the save would appear to have done nothing.
  project.activeCodeVersionId = version.id;
  project.updatedAt = version.createdAt;
  db.save();

  res.status(201).json(version);
});

// PUT /api/projects/:id/code-versions/:versionId/activate — choose which version
// preview and export use. This is how a user reverts to a generated version after an
// edit, without anything being deleted.
codeVersionsRouter.put<VersionParams>("/:versionId/activate", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  const version = db.state.codeVersions.find(
    (c) => c.id === req.params.versionId && c.projectId === project.id
  );
  if (!version) return sendError(res, 404, "NOT_FOUND", "Code version not found.");

  project.activeCodeVersionId = version.id;
  project.updatedAt = new Date().toISOString();
  db.save();

  res.json({ activeVersionId: version.id });
});
