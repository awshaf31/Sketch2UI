import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { v4 as uuid } from "uuid";
import type { Project } from "@sketch2ui/shared-types";
import { env } from "../../config/env.js";
import { db } from "../../db/jsonStore.js";
import { sendError } from "../../middleware/apiError.js";

export const projectsRouter = Router();

// POST /api/projects
projectsRouter.post("/", (req, res) => {
  const { name, description } = req.body ?? {};
  if (!name || typeof name !== "string") {
    return sendError(res, 400, "VALIDATION_FAILED", "A project name is required.");
  }

  const now = new Date().toISOString();
  const project: Project = {
    id: uuid(),
    name,
    description: typeof description === "string" ? description : undefined,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  db.state.projects.push(project);
  db.save();
  res.status(201).json(project);
});

// GET /api/projects
projectsRouter.get("/", (_req, res) => {
  res.json(db.state.projects);
});

// GET /api/projects/:id
projectsRouter.get("/:id", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");
  res.json(project);
});

// PATCH /api/projects/:id
projectsRouter.patch("/:id", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  const { name, description, status } = req.body ?? {};
  if (typeof name === "string") project.name = name;
  if (typeof description === "string") project.description = description;
  if (typeof status === "string") project.status = status as Project["status"];
  project.updatedAt = new Date().toISOString();

  db.save();
  res.json(project);
});

// DELETE /api/projects/:id
projectsRouter.delete("/:id", (req, res) => {
  const index = db.state.projects.findIndex((p) => p.id === req.params.id);
  if (index === -1) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  db.state.projects.splice(index, 1);

  const orphanedAssets = db.state.assets.filter((a) => a.projectId === req.params.id);
  const orphanedExports = db.state.exports.filter((e) => e.projectId === req.params.id);

  db.state.assets = db.state.assets.filter((a) => a.projectId !== req.params.id);
  db.state.detections = db.state.detections.filter((d) => d.projectId !== req.params.id);
  db.state.codeVersions = db.state.codeVersions.filter((c) => c.projectId !== req.params.id);
  // Jobs and approved training samples are project-scoped too; leaving them behind
  // would keep dead rows referencing a project that no longer exists.
  db.state.jobs = db.state.jobs.filter((j) => j.projectId !== req.params.id);
  db.state.trainingSamples = db.state.trainingSamples.filter(
    (t) => t.projectId !== req.params.id
  );
  db.state.exports = db.state.exports.filter((e) => e.projectId !== req.params.id);
  db.state.pageBoundaries = db.state.pageBoundaries.filter(
    (b) => b.projectId !== req.params.id
  );
  db.save();

  // Delete the files too, not just the records — same leak the uploaded-image cleanup
  // already fixes, now extended to export ZIPs.
  for (const asset of orphanedAssets) {
    fs.rmSync(path.join(env.uploadsDir, asset.storageKey), { force: true });
  }
  for (const record of orphanedExports) {
    fs.rmSync(path.join(env.exportsDir, record.storagePath), { force: true });
  }
  // Remove the now-empty projects/<id>/exports/ tree.
  fs.rmSync(path.join(env.exportsDir, "projects", req.params.id), {
    recursive: true,
    force: true,
  });

  res.status(204).send();
});
