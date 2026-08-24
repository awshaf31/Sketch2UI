import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import type { Project } from "@sketch2ui/shared-types";
import { env } from "../../config/env.js";
import { sendError } from "../../middleware/apiError.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { getRepositories } from "../../repositories/index.js";

// Project CRUD — MIGRATED to the repository layer (Phase 8 amendment, step 1 of the
// module-by-module conversion).
//
// This module no longer imports `jsonStore`. Persistence goes through
// `getRepositories().projects`, so which backend serves it is a configuration decision
// (PERSISTENCE_DRIVER) rather than something this file knows about.
//
// ROUTE CONTRACTS ARE UNCHANGED: same methods, same URLs, same request bodies, same
// response shapes, same status codes. What changed is internal — reads are now detached
// copies and writes are explicit calls, instead of mutating a live object out of
// `db.state` and calling `db.save()` (amendment §2.3).

export const projectsRouter = Router();

// POST /api/projects
projectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, description } = req.body ?? {};
    if (!name || typeof name !== "string") {
      return sendError(res, 400, "VALIDATION_FAILED", "A project name is required.");
    }

    const project = await getRepositories().projects.create({
      name,
      description: typeof description === "string" ? description : undefined,
    });
    res.status(201).json(project);
  })
);

// GET /api/projects
projectsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await getRepositories().projects.list());
  })
);

// GET /api/projects/:id
projectsRouter.get<{ id: string }>(
  "/:id",
  asyncHandler(async (req, res) => {
    const project = await getRepositories().projects.findById(req.params.id);
    if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");
    res.json(project);
  })
);

// PATCH /api/projects/:id
projectsRouter.patch<{ id: string }>(
  "/:id",
  asyncHandler(async (req, res) => {
    const { name, description, status } = req.body ?? {};

    // Only forward fields the caller actually supplied, so an absent key means "leave
    // alone" rather than "set to undefined" — matching the previous behaviour, where
    // each field was guarded by its own typeof check before assignment.
    const updated = await getRepositories().projects.update(req.params.id, {
      ...(typeof name === "string" ? { name } : {}),
      ...(typeof description === "string" ? { description } : {}),
      ...(typeof status === "string" ? { status: status as Project["status"] } : {}),
    });

    if (!updated) return sendError(res, 404, "NOT_FOUND", "Project not found.");
    res.json(updated);
  })
);

// DELETE /api/projects/:id
projectsRouter.delete<{ id: string }>(
  "/:id",
  asyncHandler(async (req, res) => {
    // The repository cascades the database side and hands back the rows that own files,
    // because after the cascade those rows are gone and the paths with them.
    const removed = await getRepositories().projects.delete(req.params.id);
    if (!removed) return sendError(res, 404, "NOT_FOUND", "Project not found.");

    // File cleanup stays here: it is filesystem work, not persistence, and the
    // repository has no business knowing about upload/export directories.
    for (const asset of removed.assets) {
      fs.rmSync(path.join(env.uploadsDir, asset.storageKey), { force: true });
    }
    for (const record of removed.exports) {
      fs.rmSync(path.join(env.exportsDir, record.storagePath), { force: true });
    }
    fs.rmSync(path.join(env.exportsDir, "projects", req.params.id), {
      recursive: true,
      force: true,
    });

    res.status(204).send();
  })
);
