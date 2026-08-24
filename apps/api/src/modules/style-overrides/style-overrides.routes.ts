import { Router } from "express";
import { db } from "../../db/jsonStore.js";
import { sendError } from "../../middleware/apiError.js";
import type { ProjectParams } from "../../types.js";

// Per-node style overrides — plan §6.7 / §17.3.
//
// The inspector edits a component's visual style (display, gap, padding, margin,
// font-size, alignment) and persists the change here; codegen.routes.ts reads the map
// and applies it before rendering the next CodeVersion. Keyed on detection uuid, which
// is stable across detection edits (see project.ts and style-overrides.ts for the
// reasoning) — a UI-IR node id shifts when the surrounding scene changes and would
// silently reattach an override to the wrong element.

export const styleOverridesRouter = Router({ mergeParams: true });

interface OverrideParams extends ProjectParams {
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

// GET /api/projects/:id/style-overrides — the full map for the project. Small enough
// to send at once and needed on workspace load, so no pagination.
styleOverridesRouter.get<ProjectParams>("/", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");
  res.json(project.styleOverrides ?? {});
});

// PUT /api/projects/:id/style-overrides/:detectionId — upsert the override for one
// component. Body is a { property: value } object; unknown properties are rejected so a
// typo cannot silently persist as a no-op rule.
styleOverridesRouter.put<OverrideParams>("/:detectionId", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  const detection = db.state.detections.find(
    (d) => d.id === req.params.detectionId && d.projectId === project.id
  );
  if (!detection) return sendError(res, 404, "NOT_FOUND", "Detection not found in this project.");

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

  project.styleOverrides = project.styleOverrides ?? {};
  if (Object.keys(cleaned).length === 0) {
    // Empty write is a delete — the inspector's Reset button uses this path so the
    // component reverts to the auto-inferred layout with no leftover keys.
    delete project.styleOverrides[detection.id];
  } else {
    project.styleOverrides[detection.id] = cleaned;
  }
  project.updatedAt = new Date().toISOString();
  db.save();

  res.json({ detectionId: detection.id, style: project.styleOverrides[detection.id] ?? null });
});

// DELETE /api/projects/:id/style-overrides/:detectionId — clear one component's tweaks.
styleOverridesRouter.delete<OverrideParams>("/:detectionId", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");
  if (project.styleOverrides) {
    delete project.styleOverrides[req.params.detectionId];
    project.updatedAt = new Date().toISOString();
    db.save();
  }
  res.status(204).send();
});
