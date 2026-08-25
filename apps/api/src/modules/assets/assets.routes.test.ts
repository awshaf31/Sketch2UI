import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../db/jsonStore.js";
import { errorHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { authRouter } from "../auth/auth.routes.js";
import { projectsRouter } from "../projects/projects.routes.js";
import { pagesRouter } from "../pages/pages.routes.js";
import { assetsRouter } from "./assets.routes.js";

/**
 * HTTP-integration regression coverage for DEF-004
 * (docs/qa/MASTER_DEFECT_REGISTER.md) — multer-level upload rejections (an oversized
 * file, or a file whose declared Content-Type isn't in the allowlist) used to fall
 * straight through to the catch-all error handler and come back as a generic
 * `500 INTERNAL "An unexpected server error occurred."`, misrepresenting an ordinary
 * client input-validation failure as a server crash. Both cases must now report as
 * `VALIDATION_FAILED` with the correct HTTP status (413 for oversized, 400 for
 * unsupported type) and a specific, actionable message.
 */

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use(requireAuth);
  app.use("/api/projects/:id/pages/:pageId/assets", assetsRouter);
  app.use("/api/projects/:id/pages", pagesRouter);
  app.use("/api/projects", projectsRouter);
  app.use(errorHandler);
  return app;
}

describe("assets routes — multer error normalization", () => {
  const app = makeApp();

  beforeEach(() => {
    db.reset();
  });

  async function setup(email: string) {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email, password: "correct-horse" });
    const project = await agent.post("/api/projects").send({ name: "Upload test" });
    const projectId = project.body.id as string;
    const pages = await agent.get(`/api/projects/${projectId}/pages`);
    const pageId = pages.body[0].id as string;
    return { agent, projectId, pageId };
  }

  it("reports an oversized file as 413 VALIDATION_FAILED, not 500", async () => {
    const { agent, projectId, pageId } = await setup("oversized@example.com");
    const oversized = Buffer.alloc(16 * 1024 * 1024, 0);
    const res = await agent
      .post(`/api/projects/${projectId}/pages/${pageId}/assets`)
      .attach("file", oversized, { filename: "big.png", contentType: "image/png" });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.message).toMatch(/too large/i);
  });

  it("reports an unsupported content type as 400 VALIDATION_FAILED, not 500", async () => {
    const { agent, projectId, pageId } = await setup("badtype@example.com");
    const res = await agent
      .post(`/api/projects/${projectId}/pages/${pageId}/assets`)
      .attach("file", Buffer.from("not an image"), { filename: "file.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.message).toMatch(/unsupported file type/i);
  });
});
