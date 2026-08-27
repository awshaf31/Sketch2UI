import { Router } from "express";
import { sendError } from "../../middleware/apiError.js";
import type { PageParams } from "../../types.js";
import { getRepositories } from "../../repositories/index.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";
import { requirePageInProject } from "../../middleware/requirePageInProject.js";

// Per-node style overrides — plan §6.7 / §17.3.
//
// The inspector edits a component's visual style (display, gap, padding, margin,
// font-size, alignment) and persists the change here; codegen.routes.ts reads the map
// and applies it before rendering the next CodeVersion. Keyed on detection uuid, which
// is stable across detection edits (see project.ts and style-overrides.ts for the
// reasoning) — a UI-IR node id shifts when the surrounding scene changes and would
// silently reattach an override to the wrong element.

export const styleOverridesRouter = Router({ mergeParams: true });
styleOverridesRouter.use(requireProjectOwnership);
styleOverridesRouter.use(requirePageInProject);

interface OverrideParams extends PageParams {
  detectionId: string;
}

// The Style section of the inspector maps directly onto these CSS properties (plan
// §17.3). Restricting the write endpoint to this set keeps arbitrary user input from
// being persisted as CSS and later rendered inside every viewer's preview iframe.
const ALLOWED_PROPERTIES = new Set([
  "display",
  "gap",
  "padding",
  "margin",
  "font-size",
  "text-align",
  "align-items",
  "justify-content",
]);

// GET /api/projects/:id/pages/:pageId/style-overrides — the full map for the page.
// Small enough to send at once and needed on workspace load, so no pagination.
styleOverridesRouter.get<PageParams>(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getRepositories().styleOverrides.mapForPage(req.params.pageId));
  })
);

// PUT /api/projects/:id/pages/:pageId/style-overrides/:detectionId — upsert the
// override for one component. Body is a { property: value } object; unknown
// properties are rejected so a typo cannot silently persist as a no-op rule.
styleOverridesRouter.put<OverrideParams>(
  "/:detectionId",
  asyncHandler(async (req, res) => {
    const detection = await getRepositories().detections.findInPage(req.params.pageId, req.params.detectionId);
    if (!detection) return sendError(res, 404, "NOT_FOUND", "Detection not found on this page.");

    const body = (req.body ?? {}) as Record<string, unknown>;
    const cleaned: Record<string, string> = {};
    for (const [prop, value] of Object.entries(body)) {
      if (!ALLOWED_PROPERTIES.has(prop)) {
        return sendError(res, 400, "VALIDATION_FAILED", `Style property not allowed: ${prop}`);
      }
      if (value === "" || value === null || value === undefined) continue;
      if (typeof value !== "string") {
        return sendError(res, 400, "VALIDATION_FAILED", `Style value for ${prop} must be a string.`);
      }
      // A stray "}" or newline in a value would let a caller close the enclosing rule
      // and inject additional selectors when the override is emitted as CSS. The
      // inspector never produces those characters, so refusing them is safe.
      if (/[{};\n\r<>]/.test(value)) {
        return sendError(res, 400, "VALIDATION_FAILED", `Style value for ${prop} contains an illegal character.`);
      }
      cleaned[prop] = value;
    }

    // An empty write is a delete — the inspector's Reset button uses this path so the
    // component reverts to the auto-inferred layout with no leftover keys. The
    // repository detects this itself (put with an empty object).
    const stored = await getRepositories().styleOverrides.put(req.params.id, req.params.pageId, detection.id, cleaned);

    res.json({ detectionId: detection.id, style: stored });
  })
);

// DELETE /api/projects/:id/pages/:pageId/style-overrides/:detectionId — clear one
// component's tweaks.
styleOverridesRouter.delete<OverrideParams>(
  "/:detectionId",
  asyncHandler(async (req, res) => {
    await getRepositories().styleOverrides.remove(req.params.id, req.params.detectionId);
    res.status(204).send();
  })
);
