import { Router } from "express";
import { generateCode } from "@sketch2ui/codegen";
import { exportAssetResolver } from "./asset-resolvers.js";
import { resolveActiveVersion } from "./code-versions.routes.js";
import type { ProjectParams } from "../../types.js";
import { sendError } from "../../middleware/apiError.js";
import { getRepositories } from "../../repositories/index.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";

export const codegenRouter = Router({ mergeParams: true });

// POST /api/projects/:id/code-generation-jobs — plan section 18.6.
// Runs synchronously for the skeleton phase; a queue (BullMQ/Redis, section 27) can wrap
// this same generateCode() call later without changing the UI-IR/codegen contract.
codegenRouter.post<ProjectParams>(
  "/",
  asyncHandler(async (req, res) => {
    const project = await getRepositories().projects.findById(req.params.id);
    if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

    const [assets, detections, styleOverrides, contentOverrides, geometryOverrides, structureOverrides] =
      await Promise.all([
        getRepositories().assets.listByProject(project.id),
        getRepositories().detections.listActiveByProject(project.id),
        getRepositories().styleOverrides.mapForProject(project.id),
        getRepositories().contentOverrides.mapForProject(project.id),
        getRepositories().geometryOverrides.mapForProject(project.id),
        getRepositories().structureOverrides.mapForProject(project.id),
      ]);
    // First asset in insertion order — matches the pre-migration db.state.assets.find()
    // semantics exactly (listByProject is documented/tested to preserve insertion order).
    const asset = assets[0];

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
      styleOverrides,
      // Content-inspector tweaks (§17.3 Content, Appendix Q). Same fold-in strategy —
      // one CodeVersion contains everything, so preview and export stay in step.
      contentOverrides,
      // Geometry-inspector tweaks (§17.3 Geometry). Applied at the DETECTION layer
      // before layout inference — see packages/shared-types/src/geometry-override.ts
      // and generateCode() in packages/codegen for the ordering rationale.
      geometryOverrides,
      // Structure-inspector tweaks (§17.3 Structure). Applied INSIDE buildUITree —
      // resolveParent / reorderByStructureOverrides. Auto containment still runs
      // first; overrides layer on top.
      structureOverrides,
    });

    const codeVersion = await getRepositories().codeVersions.create({
      projectId: project.id,
      source: "generated",
      html,
      css,
      metadata: { assets: Object.fromEntries(assetMap) },
    });

    // The just-saved version becomes what preview and export see — symmetric with a
    // hand-edit save, so "Save code version" and "Save edit" behave the same way from
    // the user's point of view. A user who wants an older version back can activate it
    // through the version history; the immutability guarantee is untouched either way.
    await Promise.all([
      getRepositories().projects.setStatus(project.id, "generated"),
      getRepositories().projects.setActiveCodeVersion(project.id, codeVersion.id),
    ]);

    res.status(201).json({ jobId: codeVersion.id, status: "completed", code: codeVersion });
  })
);

// GET /api/projects/:id/code — plan section 18.7. Returns the ACTIVE version (a
// user-pinned one if set, otherwise the latest), so a hand-edited version is what a
// consumer sees here without needing a separate route.
export const latestCodeRouter = Router({ mergeParams: true });
latestCodeRouter.get<ProjectParams>(
  "/",
  asyncHandler(async (req, res) => {
    const project = await getRepositories().projects.findById(req.params.id);
    if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

    const active = await resolveActiveVersion(project.id);
    if (!active) return sendError(res, 404, "NOT_FOUND", "No generated code yet — save a code version first.");
    res.json(active);
  })
);
