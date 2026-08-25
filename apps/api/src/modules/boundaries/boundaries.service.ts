import type { PageBoundary, PageBoundaryRecord } from "@sketch2ui/shared-types";

// Pure projection helper — persistence now lives in BoundaryRepository
// (repositories/json/boundary.repository.ts, repositories/prisma/boundary.repository.ts).
// Kept here because both boundaries.routes.ts and detect.job.ts need to turn a stored
// record back into the wire-shaped PageBoundary.

export function toPageBoundary(record: PageBoundaryRecord): PageBoundary {
  return {
    polygon: record.polygon,
    confidence: record.confidence,
    method: record.method,
    areaFraction: record.areaFraction,
    applied: record.applied,
    overlapThreshold: record.overlapThreshold,
  };
}
