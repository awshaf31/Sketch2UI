import type {
  CodeVersion,
  ContentOverride,
  Detection,
  GeometryOverride,
  Job,
  Project,
  PageBoundary,
  ProjectAsset,
  ProjectExport,
} from "@sketch2ui/shared-types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/**
 * Every API route emits the plan's §7.6 shape:
 *   { error: { code, message, retryable } }
 *
 * The bare `{ error: "string" }` form no longer exists anywhere in apps/api, so the
 * compatibility shim that used to accept both was removed — this is a single-consumer
 * project and keeping a branch for a shape nothing produces just hides drift.
 */
export interface ApiErrorDetail {
  code: string;
  message: string;
  retryable: boolean;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const detail =
    typeof body === "object" && body !== null && "error" in body
      ? ((body as { error: unknown }).error as Partial<ApiErrorDetail>)
      : undefined;

  return new ApiError(
    status,
    detail?.code ?? "INTERNAL",
    detail?.message ?? `Request failed (${status}).`,
    detail?.retryable ?? false
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers:
      init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json", ...init.headers }
        : init?.headers,
  });
  if (!res.ok) {
    throw toApiError(res.status, await res.json().catch(() => null));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  assetUrl(storageKey: string): string {
    return `${API_URL}/uploads/${storageKey}`;
  },

  listProjects(): Promise<Project[]> {
    return request("/api/projects");
  },
  getProject(id: string): Promise<Project> {
    return request(`/api/projects/${id}`);
  },
  createProject(input: { name: string; description?: string }): Promise<Project> {
    return request("/api/projects", { method: "POST", body: JSON.stringify(input) });
  },
  deleteProject(id: string): Promise<void> {
    return request(`/api/projects/${id}`, { method: "DELETE" });
  },

  listAssets(projectId: string): Promise<ProjectAsset[]> {
    return request(`/api/projects/${projectId}/assets`);
  },
  uploadAsset(projectId: string, file: File): Promise<ProjectAsset> {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/api/projects/${projectId}/assets`, { method: "POST", body: formData });
  },

  listDetections(projectId: string): Promise<Detection[]> {
    return request(`/api/projects/${projectId}/detections`);
  },
  createDetection(
    projectId: string,
    input: { className: string; bbox: Detection["bbox"]; sourceAssetId: string }
  ): Promise<Detection> {
    return request(`/api/projects/${projectId}/detections`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateDetection(
    projectId: string,
    detectionId: string,
    input: Partial<{ className: string; x: number; y: number; width: number; height: number; status: string }>
  ): Promise<Detection> {
    return request(`/api/projects/${projectId}/detections/${detectionId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  deleteDetection(projectId: string, detectionId: string): Promise<void> {
    return request(`/api/projects/${projectId}/detections/${detectionId}`, { method: "DELETE" });
  },

  /** Build a downloadable ZIP from the project's latest saved code version (§18.8). */
  createExport(projectId: string): Promise<ProjectExport & { downloadUrl: string }> {
    return request(`/api/projects/${projectId}/exports`, { method: "POST", body: JSON.stringify({}) });
  },
  listExports(projectId: string): Promise<(ProjectExport & { downloadUrl: string })[]> {
    return request(`/api/projects/${projectId}/exports`);
  },
  /** The persisted page boundary for an asset, if any (§10.6). */
  getPageBoundary(
    projectId: string,
    assetId: string
  ): Promise<{ boundary: PageBoundary | null; source: "auto" | "manual" | null }> {
    return request(`/api/projects/${projectId}/assets/${assetId}/page-boundary`);
  },
  /** Persist a user adjustment — always wins over later auto-detection. */
  savePageBoundary(
    projectId: string,
    assetId: string,
    boundary: Pick<PageBoundary, "polygon"> & Partial<PageBoundary>
  ): Promise<{ boundary: PageBoundary; source: "auto" | "manual" }> {
    return request(`/api/projects/${projectId}/assets/${assetId}/page-boundary`, {
      method: "PUT",
      body: JSON.stringify(boundary),
    });
  },

  /** Absolute URL of a detection's crop of the source sketch (§15.5). */
  cropUrl(projectId: string, detectionId: string): string {
    return `${API_URL}/api/projects/${projectId}/detections/${detectionId}/crop.png`;
  },
  /** Absolute URL for a download route, for use as an <a href>. */
  absoluteUrl(pathname: string): string {
    return `${API_URL}${pathname}`;
  },

  /** Approve this asset's current active detections as training data (§36, FR-11). */
  approveTraining(
    projectId: string,
    assetId: string
  ): Promise<{ id: string; approved: boolean; datasetSplit: string; boxCount: number; replacedPrevious: boolean }> {
    return request(`/api/projects/${projectId}/assets/${assetId}/approve-training`, { method: "POST" });
  },
  getTrainingApproval(
    projectId: string,
    assetId: string
  ): Promise<{ approved: boolean; approvedAt?: string; datasetSplit?: string; boxCount?: number }> {
    return request(`/api/projects/${projectId}/assets/${assetId}/approve-training`);
  },

  /** Start a detection job — plan section 7.4. Returns immediately; poll getJob(). */
  startDetection(projectId: string, assetId: string): Promise<{ jobId: string; status: string }> {
    return request(`/api/projects/${projectId}/assets/${assetId}/detect`, { method: "POST" });
  },
  getJob(jobId: string): Promise<Job> {
    return request(`/api/jobs/${jobId}`);
  },

  generateCode(projectId: string): Promise<{ jobId: string; status: string; code: CodeVersion }> {
    return request(`/api/projects/${projectId}/code-generation-jobs`, { method: "POST" });
  },
  getLatestCode(projectId: string): Promise<CodeVersion> {
    return request(`/api/projects/${projectId}/code`);
  },

  // Code version history and hand-editing (§6.9, §39 V1).
  //
  // Listing returns a lightweight summary; getCodeVersion pulls the full html/css bytes
  // for the one the user actually wants to view or use as an edit starting point. The
  // split keeps the workspace load small when a project has many revisions.
  listCodeVersions(projectId: string): Promise<CodeVersionSummary> {
    return request(`/api/projects/${projectId}/code-versions`);
  },
  getCodeVersion(projectId: string, versionId: string): Promise<CodeVersion> {
    return request(`/api/projects/${projectId}/code-versions/${versionId}`);
  },
  /**
   * Persist a hand-edited page as a NEW immutable CodeVersion — never a mutation of an
   * existing one. `basedOnVersionId` lets the server carry the asset map forward so image
   * paths in the edited HTML still resolve to real crops at export time.
   */
  saveEditedCode(
    projectId: string,
    input: { html: string; css: string; basedOnVersionId?: string }
  ): Promise<CodeVersion> {
    return request(`/api/projects/${projectId}/code-versions`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  activateCodeVersion(projectId: string, versionId: string): Promise<{ activeVersionId: string }> {
    return request(`/api/projects/${projectId}/code-versions/${versionId}/activate`, {
      method: "PUT",
    });
  },

  // Per-node style overrides (§6.7 / §17.3). The map is keyed by detection uuid, not
  // UI-IR node id — see project.ts for why. Applying a change from the inspector is a
  // put-then-generate-code sequence so the change lands in a new "generated" CodeVersion
  // (not "edited") that the existing version/preview/export plumbing picks up for free.
  listStyleOverrides(projectId: string): Promise<Record<string, Record<string, string>>> {
    return request(`/api/projects/${projectId}/style-overrides`);
  },
  putStyleOverride(
    projectId: string,
    detectionId: string,
    style: Record<string, string>
  ): Promise<{ detectionId: string; style: Record<string, string> | null }> {
    return request(`/api/projects/${projectId}/style-overrides/${detectionId}`, {
      method: "PUT",
      body: JSON.stringify(style),
    });
  },
  clearStyleOverride(projectId: string, detectionId: string): Promise<void> {
    return request(`/api/projects/${projectId}/style-overrides/${detectionId}`, {
      method: "DELETE",
    });
  },

  // Per-node content overrides (§17.3 Content, Appendix Q). Same detection-uuid
  // keying as style overrides; the API enforces per-class applicability, so a Content
  // apply call must scope the body to fields the selected class actually accepts.
  listContentOverrides(projectId: string): Promise<Record<string, ContentOverride>> {
    return request(`/api/projects/${projectId}/content-overrides`);
  },
  putContentOverride(
    projectId: string,
    detectionId: string,
    input: { text?: string; altText?: string; href?: string }
  ): Promise<{ detectionId: string; override: ContentOverride | null }> {
    return request(`/api/projects/${projectId}/content-overrides/${detectionId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  clearContentOverride(projectId: string, detectionId: string): Promise<void> {
    return request(`/api/projects/${projectId}/content-overrides/${detectionId}`, {
      method: "DELETE",
    });
  },

  // Per-node geometry overrides (§17.3 Geometry). Same detection-uuid keying as
  // style/content overrides. Body is a partial { x?, y?, width?, height? } in
  // normalized [0,1] — the API validator enforces the strict-normalized rules.
  listGeometryOverrides(projectId: string): Promise<Record<string, GeometryOverride>> {
    return request(`/api/projects/${projectId}/geometry-overrides`);
  },
  putGeometryOverride(
    projectId: string,
    detectionId: string,
    input: GeometryOverride
  ): Promise<{ detectionId: string; geometry: GeometryOverride | null }> {
    return request(`/api/projects/${projectId}/geometry-overrides/${detectionId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  clearGeometryOverride(projectId: string, detectionId: string): Promise<void> {
    return request(`/api/projects/${projectId}/geometry-overrides/${detectionId}`, {
      method: "DELETE",
    });
  },
};

export interface CodeVersionSummaryEntry {
  id: string;
  versionNumber: number;
  source: "generated" | "edited";
  createdAt: string;
  htmlBytes: number;
  cssBytes: number;
  isActive: boolean;
}

export interface CodeVersionSummary {
  activeVersionId: string | null;
  versions: CodeVersionSummaryEntry[];
}
