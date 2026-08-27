import { v4 as uuid } from "uuid";
import type { Job, JobStage, JobStatus } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { CreateJobInput, JobRepository } from "../types.js";

/**
 * JSON-backed JobRepository — Phase 8 compatibility adapter.
 *
 * `failOrphaned` — plan §27's in-process job semantics: a restart abandons anything
 * mid-flight, so a client polling such a job would otherwise wait forever on
 * "processing". Called once at server startup.
 */

function detach<T>(value: T): T {
  return structuredClone(value);
}

export class JsonJobRepository implements JobRepository {
  async findById(id: string): Promise<Job | null> {
    const found = db.state.jobs.find((j) => j.id === id);
    return found ? detach(found) : null;
  }

  async listByProject(projectId: string): Promise<Job[]> {
    return db.state.jobs.filter((j) => j.projectId === projectId).map(detach);
  }

  async listAll(): Promise<Job[]> {
    return db.state.jobs.map(detach);
  }

  async create(input: CreateJobInput): Promise<Job> {
    const now = new Date().toISOString();
    const job: Job = {
      id: uuid(),
      projectId: input.projectId,
      type: input.type,
      status: "queued",
      stage: "queued",
      progress: 0,
      ...(input.pageId ? { pageId: input.pageId } : {}),
      ...(input.sourceAssetId ? { sourceAssetId: input.sourceAssetId } : {}),
      createdAt: now,
      updatedAt: now,
    };
    db.state.jobs.push(job);
    db.save();
    return detach(job);
  }

  async update(id: string, patch: Partial<Omit<Job, "id" | "createdAt">>): Promise<Job | null> {
    const job = db.state.jobs.find((j) => j.id === id);
    if (!job) return null;
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    db.save();
    return detach(job);
  }

  async failOrphaned(): Promise<number> {
    const orphans = db.state.jobs.filter((j) => j.status === "queued" || j.status === "processing");
    for (const job of orphans) {
      Object.assign(job, {
        status: "failed" as JobStatus,
        stage: "failed" as JobStage,
        errorCode: "INTERNAL",
        errorMessage: "The API restarted while this job was running. Start a new one.",
        retryable: true,
        updatedAt: new Date().toISOString(),
      });
    }
    if (orphans.length > 0) db.save();
    return orphans.length;
  }
}
