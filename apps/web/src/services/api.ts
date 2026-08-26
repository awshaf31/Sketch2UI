import type {
  CodeVersion,
  ContentOverride,
  CorrectionRecord,
  Detection,
  GeometryOverride,
  Job,
  Page,
  Project,
  PageBoundary,
  ProjectAsset,
  ProjectExport,
  PublicUser,
  StructureOverride,
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
// SaaS phase S6 — Admin Overview. Mirrors GET /api/admin/overview's response shape
// exactly (apps/api/src/modules/admin/admin.routes.ts).
export interface AdminOverview {
  totalUsers: number;
  totalProjects: number;
  generatedProjects: number;
}

// SaaS phase S7 — mirrors GET /api/admin/users's response shape exactly
// (admin.routes.ts). Deliberately has no `passwordHash` field — the API never sends
// one.
export interface AdminUserSummary {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  projectCount: number;
}

// SaaS phase S8 — mirrors GET /api/admin/projects and .../:id's response shapes
// exactly (admin.routes.ts).
export interface AdminProjectSummary {
  id: string;
  name: string;
  status: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminJobSummary {
  id: string;
  type: string;
  status: string;
  stage: string;
  createdAt: string;
  updatedAt: string;
  errorMessage: string | null;
}

export interface AdminProjectDetail extends AdminProjectSummary {
  jobs: AdminJobSummary[];
}

// SaaS phase S9 — mirrors GET /api/admin/jobs, /models, and /training exactly.
export interface AdminJobListEntry extends AdminJobSummary {
  projectId: string;
  projectName: string;
  ownerEmail: string;
}

export interface AdminModelSummary {
  family: string;
  version: string;
  architecture: string;
  status: string;
  datasetVersion: string;
  classCount: number;
  createdAt: string | null;
  active: boolean;
  metrics: { precision: number; recall: number; mAP50: number; mAP50_95: number } | null;
}

export interface AdminTrainingSampleSummary {
  id: string;
  projectId: string;
  projectName: string;
  datasetSplit: string;
  boxCount: number;
  classCount: number;
  approvedAt: string;
}

// SaaS phase S10 — mirrors GET /api/admin/audit-logs exactly.
export interface AdminAuditLogEntry {
  id: string;
  event: string;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

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
    // Required for the session cookie to be sent/stored: apps/web and apps/api are
    // different origins in dev (:5173 vs :4000), so credentials are never implied.
    credentials: "include",
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
  /** Absolute URL of an asset's source image (§18.2). Ownership-checked server-side
   *  — see DEF-008 in docs/qa/MASTER_DEFECT_REGISTER.md — so it needs the
   *  project/page context, not just the storage key. */
  assetUrl(projectId: string, pageId: string, assetId: string): string {
    return `${API_URL}/api/projects/${projectId}/pages/${pageId}/assets/${assetId}/image`;
  },

  register(email: string, password: string): Promise<PublicUser> {
    return request("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
  },
  login(email: string, password: string): Promise<PublicUser> {
    return request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  },
  logout(): Promise<void> {
    return request("/api/auth/logout", { method: "POST" });
  },
  me(): Promise<PublicUser> {
    return request("/api/auth/me");
  },

  // Admin (SaaS phase S6+). Server-side role-gated (requireAdmin.ts) — a non-admin
  // caller gets 403 regardless of what the frontend shows.
  adminOverview(): Promise<AdminOverview> {
    return request("/api/admin/overview");
  },
  adminListUsers(): Promise<AdminUserSummary[]> {
    return request("/api/admin/users");
  },
  adminListProjects(filters: { q?: string; status?: string } = {}): Promise<AdminProjectSummary[]> {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    const qs = params.toString();
    return request(`/api/admin/projects${qs ? `?${qs}` : ""}`);
  },
  adminGetProject(id: string): Promise<AdminProjectDetail> {
    return request(`/api/admin/projects/${id}`);
  },
  adminListJobs(filters: { status?: string } = {}): Promise<AdminJobListEntry[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    const qs = params.toString();
    return request(`/api/admin/jobs${qs ? `?${qs}` : ""}`);
  },
  adminListModels(): Promise<AdminModelSummary[]> {
    return request("/api/admin/models");
  },
  adminListTraining(): Promise<AdminTrainingSampleSummary[]> {
    return request("/api/admin/training");
  },
  adminListAuditLogs(limit = 200): Promise<AdminAuditLogEntry[]> {
    return request(`/api/admin/audit-logs?limit=${limit}`);
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
  // SaaS phase S5 — Phase 4 of the brief calls for project rename. projects.routes.ts
  // already accepts PATCH { name } (Phase D1 onward); this was just never exposed in
  // the frontend until now.
  renameProject(id: string, name: string): Promise<Project> {
    return request(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
  },

  // Pages (§6 D3). A project always has at least one page; pageId scopes every
  // resource below.
  listPages(projectId: string): Promise<Page[]> {
    return request(`/api/projects/${projectId}/pages`);
  },
  createPage(projectId: string, name?: string): Promise<Page> {
    return request(`/api/projects/${projectId}/pages`, {
      method: "POST",
      body: JSON.stringify(name ? { name } : {}),
    });
  },
  renamePage(projectId: string, pageId: string, name: string): Promise<Page> {
    return request(`/api/projects/${projectId}/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
  },
  deletePage(projectId: string, pageId: string): Promise<void> {
    return request(`/api/projects/${projectId}/pages/${pageId}`, { method: "DELETE" });
  },

  listAssets(projectId: string, pageId: string): Promise<ProjectAsset[]> {
    return request(`/api/projects/${projectId}/pages/${pageId}/assets`);
  },
  uploadAsset(projectId: string, pageId: string, file: File): Promise<ProjectAsset> {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/api/projects/${projectId}/pages/${pageId}/assets`, { method: "POST", body: formData });
  },

  listDetections(projectId: string, pageId: string): Promise<Detection[]> {
    return request(`/api/projects/${projectId}/pages/${pageId}/detections`);
  },
  createDetection(
    projectId: string,
    pageId: string,
    input: { className: string; bbox: Detection["bbox"]; sourceAssetId: string }
  ): Promise<Detection> {
    return request(`/api/projects/${projectId}/pages/${pageId}/detections`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateDetection(
    projectId: string,
    pageId: string,
    detectionId: string,
    input: Partial<{ className: string; x: number; y: number; width: number; height: number; status: string }>
  ): Promise<Detection> {
    return request(`/api/projects/${projectId}/pages/${pageId}/detections/${detectionId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  deleteDetection(projectId: string, pageId: string, detectionId: string): Promise<void> {
    return request(`/api/projects/${projectId}/pages/${pageId}/detections/${detectionId}`, { method: "DELETE" });
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
    pageId: string,
    assetId: string
  ): Promise<{ boundary: PageBoundary | null; source: "auto" | "manual" | null }> {
    return request(`/api/projects/${projectId}/pages/${pageId}/assets/${assetId}/page-boundary`);
  },
  /** Persist a user adjustment — always wins over later auto-detection. */
  savePageBoundary(
    projectId: string,
    pageId: string,
    assetId: string,
    boundary: Pick<PageBoundary, "polygon"> & Partial<PageBoundary>
  ): Promise<{ boundary: PageBoundary; source: "auto" | "manual" }> {
    return request(`/api/projects/${projectId}/pages/${pageId}/assets/${assetId}/page-boundary`, {
      method: "PUT",
      body: JSON.stringify(boundary),
    });
  },

  /** Absolute URL of a detection's crop of the source sketch (§15.5). */
  cropUrl(projectId: string, pageId: string, detectionId: string): string {
    return `${API_URL}/api/projects/${projectId}/pages/${pageId}/detections/${detectionId}/crop.png`;
  },
  /** Absolute URL for a download route, for use as an <a href>. */
  absoluteUrl(pathname: string): string {
    return `${API_URL}${pathname}`;
  },

  /** Approve this asset's current active detections as training data (§36, FR-11). */
  approveTraining(
    projectId: string,
    pageId: string,
    assetId: string
  ): Promise<{ id: string; approved: boolean; datasetSplit: string; boxCount: number; replacedPrevious: boolean }> {
    return request(`/api/projects/${projectId}/pages/${pageId}/assets/${assetId}/approve-training`, {
      method: "POST",
    });
  },
  getTrainingApproval(
    projectId: string,
    pageId: string,
    assetId: string
  ): Promise<{ approved: boolean; approvedAt?: string; datasetSplit?: string; boxCount?: number }> {
    return request(`/api/projects/${projectId}/pages/${pageId}/assets/${assetId}/approve-training`);
  },

  /** Start a detection job — plan section 7.4. Returns immediately; poll getJob(). */
  startDetection(projectId: string, pageId: string, assetId: string): Promise<{ jobId: string; status: string }> {
    return request(`/api/projects/${projectId}/pages/${pageId}/assets/${assetId}/detect`, { method: "POST" });
  },
  getJob(jobId: string): Promise<Job> {
    return request(`/api/jobs/${jobId}`);
  },

  generateCode(projectId: string, pageId: string): Promise<{ jobId: string; status: string; code: CodeVersion }> {
    return request(`/api/projects/${projectId}/pages/${pageId}/code-generation-jobs`, { method: "POST" });
  },
  getLatestCode(projectId: string, pageId: string): Promise<CodeVersion> {
    return request(`/api/projects/${projectId}/pages/${pageId}/code`);
  },

  // Code version history and hand-editing (§6.9, §39 V1).
  //
  // Listing returns a lightweight summary; getCodeVersion pulls the full html/css bytes
  // for the one the user actually wants to view or use as an edit starting point. The
  // split keeps the workspace load small when a project has many revisions.
  listCodeVersions(projectId: string, pageId: string): Promise<CodeVersionSummary> {
    return request(`/api/projects/${projectId}/pages/${pageId}/code-versions`);
  },
  getCodeVersion(projectId: string, pageId: string, versionId: string): Promise<CodeVersion> {
    return request(`/api/projects/${projectId}/pages/${pageId}/code-versions/${versionId}`);
  },
  /**
   * Persist a hand-edited page as a NEW immutable CodeVersion — never a mutation of an
   * existing one. `basedOnVersionId` lets the server carry the asset map forward so image
   * paths in the edited HTML still resolve to real crops at export time.
   */
  saveEditedCode(
    projectId: string,
    pageId: string,
    input: { html: string; css: string; basedOnVersionId?: string }
  ): Promise<CodeVersion> {
    return request(`/api/projects/${projectId}/pages/${pageId}/code-versions`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  activateCodeVersion(
    projectId: string,
    pageId: string,
    versionId: string
  ): Promise<{ activeVersionId: string }> {
    return request(`/api/projects/${projectId}/pages/${pageId}/code-versions/${versionId}/activate`, {
      method: "PUT",
    });
  },

  // Per-node style overrides (§6.7 / §17.3). The map is keyed by detection uuid, not
  // UI-IR node id — see project.ts for why. Applying a change from the inspector is a
  // put-then-generate-code sequence so the change lands in a new "generated" CodeVersion
  // (not "edited") that the existing version/preview/export plumbing picks up for free.
  listStyleOverrides(projectId: string, pageId: string): Promise<Record<string, Record<string, string>>> {
    return request(`/api/projects/${projectId}/pages/${pageId}/style-overrides`);
  },
  putStyleOverride(
    projectId: string,
    pageId: string,
    detectionId: string,
    style: Record<string, string>
  ): Promise<{ detectionId: string; style: Record<string, string> | null }> {
    return request(`/api/projects/${projectId}/pages/${pageId}/style-overrides/${detectionId}`, {
      method: "PUT",
      body: JSON.stringify(style),
    });
  },
  clearStyleOverride(projectId: string, pageId: string, detectionId: string): Promise<void> {
    return request(`/api/projects/${projectId}/pages/${pageId}/style-overrides/${detectionId}`, {
      method: "DELETE",
    });
  },

  // Per-node content overrides (§17.3 Content, Appendix Q). Same detection-uuid
  // keying as style overrides; the API enforces per-class applicability, so a Content
  // apply call must scope the body to fields the selected class actually accepts.
  listContentOverrides(projectId: string, pageId: string): Promise<Record<string, ContentOverride>> {
    return request(`/api/projects/${projectId}/pages/${pageId}/content-overrides`);
  },
  putContentOverride(
    projectId: string,
    pageId: string,
    detectionId: string,
    input: { text?: string; altText?: string; href?: string }
  ): Promise<{ detectionId: string; override: ContentOverride | null }> {
    return request(`/api/projects/${projectId}/pages/${pageId}/content-overrides/${detectionId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  clearContentOverride(projectId: string, pageId: string, detectionId: string): Promise<void> {
    return request(`/api/projects/${projectId}/pages/${pageId}/content-overrides/${detectionId}`, {
      method: "DELETE",
    });
  },

  // Per-node geometry overrides (§17.3 Geometry). Same detection-uuid keying as
  // style/content overrides. Body is a partial { x?, y?, width?, height? } in
  // normalized [0,1] — the API validator enforces the strict-normalized rules.
  listGeometryOverrides(projectId: string, pageId: string): Promise<Record<string, GeometryOverride>> {
    return request(`/api/projects/${projectId}/pages/${pageId}/geometry-overrides`);
  },
  putGeometryOverride(
    projectId: string,
    pageId: string,
    detectionId: string,
    input: GeometryOverride
  ): Promise<{ detectionId: string; geometry: GeometryOverride | null }> {
    return request(`/api/projects/${projectId}/pages/${pageId}/geometry-overrides/${detectionId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  clearGeometryOverride(projectId: string, pageId: string, detectionId: string): Promise<void> {
    return request(`/api/projects/${projectId}/pages/${pageId}/geometry-overrides/${detectionId}`, {
      method: "DELETE",
    });
  },

  // Per-node structure overrides (§17.3 Structure). Same detection-uuid keying;
  // the API validator rejects a self-parent, a parent that is not currently active,
  // and any edit that would create a parent cycle.
  listStructureOverrides(projectId: string, pageId: string): Promise<Record<string, StructureOverride>> {
    return request(`/api/projects/${projectId}/pages/${pageId}/structure-overrides`);
  },
  putStructureOverride(
    projectId: string,
    pageId: string,
    detectionId: string,
    input: StructureOverride
  ): Promise<{ detectionId: string; structure: StructureOverride | null }> {
    return request(`/api/projects/${projectId}/pages/${pageId}/structure-overrides/${detectionId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  clearStructureOverride(projectId: string, pageId: string, detectionId: string): Promise<void> {
    return request(`/api/projects/${projectId}/pages/${pageId}/structure-overrides/${detectionId}`, {
      method: "DELETE",
    });
  },

  // Correction history / audit trail (§4). Read-only from the client — records are
  // written server-side as a side effect of the detections/geometry/structure
  // routes above, never posted directly.
  listCorrections(projectId: string, pageId: string): Promise<CorrectionRecord[]> {
    return request(`/api/projects/${projectId}/pages/${pageId}/corrections`);
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
