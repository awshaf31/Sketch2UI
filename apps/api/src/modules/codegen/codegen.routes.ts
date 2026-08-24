import { Router } from "express";
import { v4 as uuid } from "uuid";
import type { CodeVersion } from "@sketch2ui/shared-types";
import { generateCode } from "@sketch2ui/codegen";
import { exportAssetResolver } from "./asset-resolvers.js";
import { resolveActiveVersion } from "./code-versions.routes.js";
import { db } from "../../db/jsonStore.js";
import type { ProjectParams } from "../../types.js";
import { sendError } from "../../middleware/apiError.js";

export const codegenRouter = Router({ mergeParams: true });

// POST /api/projects/:id/code-generation-jobs — plan section 18.6.
// Runs synchronously for the skeleton phase; a queue (BullMQ/Redis, section 27) can wrap
// this same generateCode() call later without changing the UI-IR/codegen contract.
codegenRouter.post<ProjectParams>("/", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  const asset = db.state.assets.find((a) => a.projectId === project.id);
  const detections = db.state.detections.filter(
    (d) => d.projectId === project.id && d.status === "active"
  );

  // The STORED code version is export-flavoured (relative ./assets/ paths), because an
  // export must work over file://. The live preview does not read this record — it
  // regenerates client-side with the preview resolver — so there is no conflict.
  const assetMap = new Map<string, string>();
  const { html, css } = generateCode(detections, {
    name: project.name,
    viewport: { width: asset?.width ?? 1440, height: asset?.height ?? 2400 },
    resolveAsset: exportAssetResolver(assetMap),
    // Style-inspector tweaks (§6.7 / §17.3) are folded in at generation time so every
    // saved version — the one preview shows, the one export packages — reflects them.
    styleOverrides: project.styleOverrides,
    // Content-inspector tweaks (§17.3 Content, Appendix Q). Same fold-in strategy —
    // one CodeVersion contains everything, so preview and export stay in step.
    contentOverrides: project.contentOverrides,
    // Geometry-inspector tweaks (§17.3 Geometry). Applied at the DETECTION layer
    // before layout inference — see packages/shared-types/src/geometry-override.ts
    // and generateCode() in packages/codegen for the ordering rationale.
    geometryOverrides: project.geometryOverrides,
    // Structure-inspector tweaks (§17.3 Structure). Applied INSIDE buildUITree —
    // resolveParent / reorderByStructureOverrides. Auto containment still runs
    // first; overrides layer on top.
    structureOverrides: project.structureOverrides,
  });

  const existing = db.state.codeVersions.filter((c) => c.projectId === project.id);
  const codeVersion: CodeVersion = {
    id: uuid(),
    projectId: project.id,
    versionNumber: existing.length + 1,
    source: "generated",
    html,
    css,
    metadata: { assets: Object.fromEntries(assetMap) },
    createdAt: new Date().toISOString(),
  };

  db.state.codeVersions.push(codeVersion);
  project.status = "generated";
  // The just-saved version becomes what preview and export see — symmetric with a
  // hand-edit save, so "Save code version" and "Save edit" behave the same way from
  // the user's point of view. A user who wants an older version back can activate it
  // through the version history; the immutability guarantee is untouched either way.
  project.activeCodeVersionId = codeVersion.id;
  project.updatedAt = new Date().toISOString();
  db.save();

  res.status(201).json({ jobId: codeVersion.id, status: "completed", code: codeVersion });
});

// GET /api/projects/:id/code — plan section 18.7. Returns the ACTIVE version (a
// user-pinned one if set, otherwise the latest), so a hand-edited version is what a
// consumer sees here without needing a separate route.
export const latestCodeRouter = Router({ mergeParams: true });
latestCodeRouter.get<ProjectParams>("/", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  const active = resolveActiveVersion(project.id);
  if (!active) return sendError(res, 404, "NOT_FOUND", "No generated code yet — save a code version first.");
  res.json(active);
});
