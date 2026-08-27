export type ProjectStatus = "draft" | "annotated" | "generated" | "archived";

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  /** The account that owns this project. Every project-scoped resource is authorized
   * by resolving back to this field. */
  ownerId: string;
  /**
   * Which CodeVersion preview and export use. Unset means "the latest", which is the
   * behaviour that existed before hand-editing — so old projects keep working.
   */
  activeCodeVersionId?: string;
  /**
   * Style-inspector tweaks (§6.7 / §17.3), keyed on the detection uuid of the node
   * they apply to. Keyed on detection id rather than UI-IR node id because
   * layout.ts assigns node ids from a per-run counter that shifts when detections
   * change — the detection uuid is stable, so an override survives edits to the
   * surrounding scene.
   */
  styleOverrides?: Record<string, Record<string, string>>;
  /**
   * Content-inspector tweaks (§17.3 Content group, Appendix Q). Same keying as
   * styleOverrides. See content-override.ts for the field set and per-class
   * applicability, and the CONTENT_APPLICABILITY table for which combinations the
   * API validator accepts.
   */
  contentOverrides?: Record<string, import("./content-override.js").ContentOverride>;
  /**
   * Geometry-inspector tweaks (§17.3 Geometry group). Same detection-uuid keying as
   * styleOverrides/contentOverrides. Applied BEFORE buildUITree so containment and
   * row grouping key off the overridden bboxes — see
   * geometry-override.ts's applyGeometryOverrides and its call site in generateCode.
   */
  geometryOverrides?: Record<string, import("./geometry-override.js").GeometryOverride>;
  /**
   * Structure-inspector tweaks (§17.3 Structure group). Same detection-uuid keying.
   * Applied WITHIN buildUITree (see layout.ts): parent override changes the
   * containment result, displayOrder changes the sibling ordering. Auto inference
   * still runs — overrides layer on top rather than replacing it, so a Reset returns
   * the node to whatever bbox containment and reading-order say.
   */
  structureOverrides?: Record<string, import("./structure-override.js").StructureOverride>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAsset {
  id: string;
  projectId: string;
  pageId: string;
  storageKey: string;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  createdAt: string;
}

export interface CodeVersion {
  id: string;
  projectId: string;
  pageId: string;
  versionNumber: number;
  /**
   * How this version came to exist. Both kinds are immutable rows in the same table — a
   * hand-edit creates a NEW version rather than mutating one, so export and the evaluation
   * baseline keep their guarantee that a version never changes underneath them.
   */
  source: "generated" | "edited";
  html: string;
  css: string;
  javascript?: string;
  /**
   * §8.7 metadata_json. Carries `assets`: a map of the relative image paths the
   * generated HTML references to the detection each one crops, so an export built from
   * this immutable version can regenerate exactly the right crop bytes later.
   */
  metadata?: { assets?: Record<string, string> };
  createdAt: string;
}
