// Export package — plan §3.9 (FR-09), §18.8 (POST /api/projects/:id/exports),
// §8.1/§43 (exports table), §38 MVP item 13 ("download an HTML/CSS package").

export interface ProjectExport {
  id: string;
  projectId: string;
  /** The immutable CodeVersion this package was built from — exports are reproducible
   *  snapshots, not live regenerations. */
  codeVersionId: string;
  /** Per-project, starting at 1. Mirrors the plan's projects/{id}/exports/v{n}.zip. */
  versionNumber: number;
  /** Path relative to the exports root, following the data/uploads/ storage convention
   *  already established for assets. */
  storagePath: string;
  fileSize: number;
  createdAt: string;
}
