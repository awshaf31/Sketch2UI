import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  BBox,
  CodeVersion,
  ContentOverride,
  DetectionStatus,
  GeometryOverride,
  PageBoundary,
  PagePolygon,
  Project,
  ProjectExport,
  StructureOverride,
} from "@sketch2ui/shared-types";
import {
  DEFAULT_OVERLAP_THRESHOLD,
  applyGeometryOverrides,
  shouldAccept,
} from "@sketch2ui/shared-types";
import type { CodeVersionSummaryEntry } from "../services/api.js";
import { api } from "../services/api.js";
import { useProjectStore } from "../stores/projectStore.js";
import UploadDropzone from "../features/upload/UploadDropzone.js";
import ClassPicker from "../features/annotation/ClassPicker.js";
import AnnotationCanvas from "../features/annotation/AnnotationCanvas.js";
import UITreePanel from "../features/tree/UITreePanel.js";
import CodePanel from "../features/code/CodePanel.js";
import PreviewPane from "../features/preview/PreviewPane.js";
import InspectorPanel from "../features/inspector/InspectorPanel.js";
import { useDetectionJob } from "../features/detection/useDetectionJob.js";
import { buildTreeAndCode } from "../utils/tree.js";

export default function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [rightTab, setRightTab] = useState<"preview" | "code">("preview");
  const [saving, setSaving] = useState(false);
  // Section 10: the page boundary for the current asset, plus UI toggles.
  const [boundary, setBoundary] = useState<PageBoundary | null>(null);
  const [showRejected, setShowRejected] = useState(true);
  const [editingBoundary, setEditingBoundary] = useState(false);
  // Section 36 / FR-11: explicit human approval before detections become training data.
  const [approval, setApproval] = useState<{ approved: boolean; datasetSplit?: string; boxCount?: number } | null>(null);
  const [approving, setApproving] = useState(false);
  const [exports, setExports] = useState<(ProjectExport & { downloadUrl: string })[]>([]);
  const [exporting, setExporting] = useState(false);
  // Code version history (§8.7, §39 V1) — one summary list plus the full content of
  // whichever version is currently active. Full bytes are lazy so switching between
  // versions never blocks on the largest ones in the list.
  const [versionList, setVersionList] = useState<CodeVersionSummaryEntry[]>([]);
  const [activeVersion, setActiveVersion] = useState<CodeVersion | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  // Style-inspector overrides (§6.7 / §17.3) — keyed on detection uuid, applied client-
  // side so the live preview reflects the current selection before Apply, then persisted
  // and folded into the next server-generated CodeVersion on Apply.
  const [styleOverrides, setStyleOverrides] = useState<Record<string, Record<string, string>>>({});
  const [applyingStyle, setApplyingStyle] = useState(false);
  // Content-inspector overrides (§17.3 Content, Appendix Q) — same detection-uuid
  // keying as style overrides, same persist-then-regenerate Apply flow. `busy` in the
  // inspector is shared with style: only one codegen round-trip in flight at a time.
  const [contentOverrides, setContentOverrides] = useState<Record<string, ContentOverride>>({});
  const [applyingContent, setApplyingContent] = useState(false);
  // Geometry-inspector overrides (§17.3 Geometry) — same detection-uuid keying and
  // same persist-then-regenerate Apply flow. Applied to the detection bboxes BEFORE
  // layout inference (see applyGeometryOverrides), so containment and row grouping
  // key off the overridden positions.
  const [geometryOverrides, setGeometryOverrides] = useState<Record<string, GeometryOverride>>({});
  const [applyingGeometry, setApplyingGeometry] = useState(false);
  // Structure-inspector overrides (§17.3 Structure) — parent + displayOrder, same
  // detection-uuid keying. Applied WITHIN buildUITree so auto containment inference
  // still runs first. The Inspector's parent dropdown reads its candidate list from
  // the current detections in this page.
  const [structureOverrides, setStructureOverrides] = useState<Record<string, StructureOverride>>({});
  const [applyingStructure, setApplyingStructure] = useState(false);

  const {
    asset,
    detections,
    selectedId,
    activeClass,
    setAsset,
    setDetections,
    addDetection,
    updateDetection,
    removeDetection,
    select,
    setActiveClass,
  } = useProjectStore();

  // Reload detections from the API. Used after a detect job completes so model boxes
  // flow through the SAME rendering path as manual ones — canvas, tree, code, preview
  // all consume the store, and none of them know or care where a Detection came from.
  const refreshDetections = useCallback(async () => {
    if (!id) return;
    setDetections(await api.listDetections(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const detectJob = useDetectionJob(async (job) => {
    if (job.pageBoundary) setBoundary(job.pageBoundary);
    await refreshDetections();
  });

  // Refresh the version list and pull the full content of whichever version is now
  // active. Called after any save (generated or edited) and after an explicit activate.
  const refreshVersions = useCallback(async () => {
    if (!id) return;
    const summary = await api.listCodeVersions(id);
    setVersionList(summary.versions);
    if (summary.activeVersionId) {
      const active = summary.versions.find((v) => v.id === summary.activeVersionId);
      // Only refetch when the active version's id changed — otherwise a redundant fetch
      // clobbers the currently-loaded content with the same bytes.
      if (active && active.id !== activeVersion?.id) {
        setActiveVersion(await api.getCodeVersion(id, summary.activeVersionId));
      }
    } else {
      setActiveVersion(null);
    }
  }, [id, activeVersion?.id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.getProject(id), api.listAssets(id), api.listDetections(id)])
      .then(([proj, assets, dets]) => {
        setProject(proj);
        setAsset(assets[assets.length - 1] ?? null);
        setDetections(dets);
      })
      .finally(() => setLoading(false));
    void refreshVersions().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id || !asset) return;
    api.getTrainingApproval(id, asset.id).then(setApproval).catch(() => setApproval(null));
    api.listExports(id).then(setExports).catch(() => setExports([]));
    // Load the persisted boundary (§10.6) instead of recomputing a default. A manual
    // adjustment survives reloads and later re-detects — same sticky rule as detections.
    api
      .getPageBoundary(id, asset.id)
      .then((r) => { if (r.boundary) setBoundary(r.boundary); })
      .catch(() => {});
  }, [id, asset]);

  useEffect(() => {
    if (!id) return;
    api.listStyleOverrides(id).then(setStyleOverrides).catch(() => setStyleOverrides({}));
    api.listContentOverrides(id).then(setContentOverrides).catch(() => setContentOverrides({}));
    api.listGeometryOverrides(id).then(setGeometryOverrides).catch(() => setGeometryOverrides({}));
    api.listStructureOverrides(id).then(setStructureOverrides).catch(() => setStructureOverrides({}));
  }, [id]);

  /**
   * Section 10.4 re-applied CLIENT-SIDE. The polygon and every bbox live in the same
   * normalized space, so moving the boundary re-partitions accepted/rejected with no
   * round trip — dragging it over a rejected box makes that box active again instantly.
   *
   * Manual detections are never re-filtered: the user drew them deliberately, and
   * silently rejecting their own work because a detected quad clipped it would be wrong.
   */
  const effectiveDetections = useMemo(() => {
    // Geometry overrides come first: an override changes the effective bbox, which
    // both the boundary check and the layout engine key off. Applying it here means
    // the canvas overlay, tree, code and preview all see the same positions.
    const withGeometry = applyGeometryOverrides(detections, geometryOverrides);
    const polygon = boundary?.polygon;
    if (!polygon || !boundary?.applied) return withGeometry;

    return withGeometry.map((d) => {
      if (d.source !== "model") return d;
      const { accepted } = shouldAccept(d.bbox, polygon, DEFAULT_OVERLAP_THRESHOLD);
      const status: DetectionStatus = accepted ? "active" : "rejected";
      return status === d.status ? d : { ...d, status };
    });
  }, [detections, boundary, geometryOverrides]);

  const visibleDetections = useMemo(
    () => (showRejected ? effectiveDetections : effectiveDetections.filter((d) => d.status !== "rejected")),
    [effectiveDetections, showRejected]
  );

  const rejectedCount = useMemo(
    () => effectiveDetections.filter((d) => d.status === "rejected").length,
    [effectiveDetections]
  );

  const modelDetectionIds = useMemo(
    () => new Set(detections.filter((d) => d.source === "model").map((d) => d.id)),
    [detections]
  );
  const modelCount = modelDetectionIds.size;

  // Codegen consumes the re-filtered set so dragging the boundary updates the preview.
  // buildUITree already ignores anything not status "active" — no change was needed
  // in packages/codegen for rejected detections to fall out of the generated page.
  // Live preview resolves image srcs to the API's crop route. Absolute URLs are
  // required: the preview iframe uses srcdoc + sandbox="", which gives it an opaque
  // origin with no base URL, so a relative path resolves to nothing.
  const { tree, html: liveHtml, css: liveCss } = useMemo(
    () =>
      asset && id
        ? buildTreeAndCode(
            // effectiveDetections already has geometry overrides folded in; passing
            // an empty geometry map to buildTreeAndCode avoids a double-apply pass.
            effectiveDetections,
            { width: asset.width, height: asset.height },
            project?.name,
            (node) =>
              node.sourceDetectionId ? api.cropUrl(id, node.sourceDetectionId) : null,
            styleOverrides,
            contentOverrides,
            // geometry already applied via effectiveDetections above; leave the
            // sixth arg unset so buildTreeAndCode does not double-apply.
            undefined,
            structureOverrides
          )
        : { tree: null, html: "", css: "" },
    [asset, effectiveDetections, project?.name, id, styleOverrides, contentOverrides, structureOverrides]
  );

  // What the code panel and preview reflect: the active saved version if one is set,
  // otherwise the live client-side regeneration. This is the "an edit only takes effect
  // once saved" contract — before Save, the draft lives only in the CodePanel; after
  // Save it becomes the active version and both panels switch to it here.
  const html = activeVersion?.html ?? liveHtml;
  const css = activeVersion?.css ?? liveCss;

  // A stored version's html uses `./assets/<node-id>.png` (relative, so exports work).
  // The preview iframe cannot resolve those, so rewrite each to the crop route using the
  // map that was captured at generation time. Live regen already emits absolute URLs, so
  // no rewriting is needed there and the resolver stays undefined.
  const resolveAssetPath = useMemo(() => {
    if (!id || !activeVersion?.metadata?.assets) return undefined;
    const assetMap = activeVersion.metadata.assets;
    return (relPath: string) => {
      const detectionId = assetMap[relPath];
      return detectionId ? api.cropUrl(id, detectionId) : null;
    };
  }, [id, activeVersion]);

  const activeVersionEntry = activeVersion
    ? versionList.find((v) => v.id === activeVersion.id)
    : undefined;
  const activeVersionLabel = activeVersionEntry
    ? `v${activeVersionEntry.versionNumber} · ${activeVersionEntry.source}`
    : versionList.length === 0
      ? "Live (unsaved)"
      : undefined;

  async function handleUpload(file: File) {
    if (!id) return;
    setUploading(true);
    try {
      const uploaded = await api.uploadAsset(id, file);
      setAsset(uploaded);
    } finally {
      setUploading(false);
    }
  }

  async function handleCreate(bbox: BBox) {
    if (!id || !asset) return;
    const detection = await api.createDetection(id, { className: activeClass, bbox, sourceAssetId: asset.id });
    addDetection(detection);
  }

  async function handleUpdate(detectionId: string, bbox: BBox) {
    if (!id) return;
    updateDetection(detectionId, { bbox }); // optimistic, keeps the drag responsive
    // Adopt the server's record: correcting a model detection flips it to source
    // "manual" (so a later Detect run cannot wipe the correction), and the canvas and
    // tree restyle off `source`. Without this the box would stay purple until reload.
    const saved = await api.updateDetection(id, detectionId, bbox);
    updateDetection(detectionId, saved);
    // A canvas drag is the user committing a concrete new geometry directly to the
    // detection. Any prior inspector-authored geometry override would then win over
    // the drag on next render — visually the drag would silently revert. Clear the
    // override so the drag lands. Best-effort: a network hiccup here still leaves
    // detection.bbox correct; the next Apply/Reset from the inspector reconciles.
    if (geometryOverrides[detectionId]) {
      setGeometryOverrides((prev) => {
        const next = { ...prev };
        delete next[detectionId];
        return next;
      });
      try {
        await api.clearGeometryOverride(id, detectionId);
      } catch {
        // Left in place: not worth surfacing — detection.bbox already reflects the drag.
      }
    }
  }

  async function handleDeleteSelected() {
    if (!id || !selectedId) return;
    const target = selectedId;
    removeDetection(target);
    await api.deleteDetection(id, target);
  }

  /**
   * Section 10.3 Strategy C — the manual fallback. A user-adjusted boundary becomes
   * method "manual" with full confidence and is always applied, including when auto
   * detection found nothing. Purely client-side: re-filtering needs no round trip.
   */
  function handleBoundaryChange(polygon: PagePolygon) {
    const next: PageBoundary = {
      polygon,
      confidence: 1,
      method: "manual",
      areaFraction: boundary?.areaFraction ?? 1,
      applied: true,
      overlapThreshold: DEFAULT_OVERLAP_THRESHOLD,
    };
    setBoundary(next); // optimistic — the drag stays responsive
    // Persist so it survives reload and is not clobbered by the next Detect run.
    if (id && asset) {
      void api.savePageBoundary(id, asset.id, next).catch(() => {});
    }
  }

  async function handleApproveTraining() {
    if (!id || !asset) return;
    setApproving(true);
    try {
      const r = await api.approveTraining(id, asset.id);
      setApproval({ approved: r.approved, datasetSplit: r.datasetSplit, boxCount: r.boxCount });
    } catch (e) {
      setApproval(null);
      // Surfaced through the same detect-error strip rather than a new pattern.
      window.alert(`Could not approve: ${(e as Error).message}`);
    } finally {
      setApproving(false);
    }
  }

  async function handleExport() {
    if (!id) return;
    setExporting(true);
    try {
      const created = await api.createExport(id);
      setExports(await api.listExports(id));
      // Navigating to the download route lets the browser handle it as a real file
      // download (Content-Disposition from res.download), rather than a blob shim.
      window.location.href = api.absoluteUrl(created.downloadUrl);
    } catch (e) {
      window.alert(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  async function handleSaveVersion() {
    if (!id) return;
    setSaving(true);
    try {
      await api.generateCode(id);
      // Pull the newly-generated version and update the history strip. Without this the
      // preview would still show the previous active version and the new row would only
      // appear on a page reload.
      await refreshVersions();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(input: { html: string; css: string }) {
    if (!id) return;
    setSavingEdit(true);
    try {
      // basedOnVersionId carries the asset map forward so image paths in the edited
      // page still resolve to real crops at export time (§15.5). The server activates
      // the new version, so refreshVersions makes it the panels' new source of truth.
      await api.saveEditedCode(id, { ...input, basedOnVersionId: activeVersion?.id });
      await refreshVersions();
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleActivateVersion(versionId: string) {
    if (!id) return;
    await api.activateCodeVersion(id, versionId);
    // The new active version's content may not be in memory yet; fetch it explicitly.
    setActiveVersion(await api.getCodeVersion(id, versionId));
    const summary = await api.listCodeVersions(id);
    setVersionList(summary.versions);
  }

  // Inspector Apply: persist the override, regenerate code (a NEW "generated"
  // CodeVersion — the source stays "generated" because this is still auto-emitted CSS,
  // just with an edited UI-IR — not the "edited" source value the code-editor uses),
  // then refresh history so preview and export follow through the existing active-
  // version pointer. Live preview already reflects the draft via styleOverrides state.
  async function handleApplyStyle(detectionId: string, style: Record<string, string>) {
    if (!id) return;
    setApplyingStyle(true);
    try {
      const result = await api.putStyleOverride(id, detectionId, style);
      setStyleOverrides((prev) => {
        const next = { ...prev };
        if (result.style && Object.keys(result.style).length > 0) {
          next[detectionId] = result.style;
        } else {
          delete next[detectionId];
        }
        return next;
      });
      await api.generateCode(id);
      await refreshVersions();
    } finally {
      setApplyingStyle(false);
    }
  }

  async function handleResetStyle(detectionId: string) {
    if (!id) return;
    setApplyingStyle(true);
    try {
      await api.clearStyleOverride(id, detectionId);
      setStyleOverrides((prev) => {
        const next = { ...prev };
        delete next[detectionId];
        return next;
      });
      await api.generateCode(id);
      await refreshVersions();
    } finally {
      setApplyingStyle(false);
    }
  }

  async function handleApplyContent(
    detectionId: string,
    content: { text?: string; altText?: string; href?: string }
  ) {
    if (!id) return;
    setApplyingContent(true);
    try {
      const result = await api.putContentOverride(id, detectionId, content);
      setContentOverrides((prev) => {
        const next = { ...prev };
        if (result.override) {
          next[detectionId] = result.override;
        } else {
          delete next[detectionId];
        }
        return next;
      });
      await api.generateCode(id);
      await refreshVersions();
    } finally {
      setApplyingContent(false);
    }
  }

  async function handleResetContent(detectionId: string) {
    if (!id) return;
    setApplyingContent(true);
    try {
      await api.clearContentOverride(id, detectionId);
      setContentOverrides((prev) => {
        const next = { ...prev };
        delete next[detectionId];
        return next;
      });
      await api.generateCode(id);
      await refreshVersions();
    } finally {
      setApplyingContent(false);
    }
  }

  // Geometry Apply/Reset — identical persist-then-regenerate shape as Style and
  // Content. The result body carries the server-normalized override so a
  // client-side value that only differed by rounding matches whatever the server
  // stored.
  async function handleApplyGeometry(
    detectionId: string,
    geometry: GeometryOverride
  ) {
    if (!id) return;
    setApplyingGeometry(true);
    try {
      const result = await api.putGeometryOverride(id, detectionId, geometry);
      setGeometryOverrides((prev) => {
        const next = { ...prev };
        if (result.geometry) {
          next[detectionId] = result.geometry;
        } else {
          delete next[detectionId];
        }
        return next;
      });
      await api.generateCode(id);
      await refreshVersions();
    } finally {
      setApplyingGeometry(false);
    }
  }

  async function handleResetGeometry(detectionId: string) {
    if (!id) return;
    setApplyingGeometry(true);
    try {
      await api.clearGeometryOverride(id, detectionId);
      setGeometryOverrides((prev) => {
        const next = { ...prev };
        delete next[detectionId];
        return next;
      });
      await api.generateCode(id);
      await refreshVersions();
    } finally {
      setApplyingGeometry(false);
    }
  }

  // Structure Apply/Reset — same persist-then-regenerate shape as the other
  // Inspector groups. The server validates parent existence, self-parent and
  // cycles; a rejected PUT propagates as an ApiError and the Inspector surfaces
  // the message.
  async function handleApplyStructure(
    detectionId: string,
    structure: StructureOverride
  ) {
    if (!id) return;
    setApplyingStructure(true);
    try {
      const result = await api.putStructureOverride(id, detectionId, structure);
      setStructureOverrides((prev) => {
        const next = { ...prev };
        if (result.structure) {
          next[detectionId] = result.structure;
        } else {
          delete next[detectionId];
        }
        return next;
      });
      await api.generateCode(id);
      await refreshVersions();
    } finally {
      setApplyingStructure(false);
    }
  }

  async function handleResetStructure(detectionId: string) {
    if (!id) return;
    setApplyingStructure(true);
    try {
      await api.clearStructureOverride(id, detectionId);
      setStructureOverrides((prev) => {
        const next = { ...prev };
        delete next[detectionId];
        return next;
      });
      await api.generateCode(id);
      await refreshVersions();
    } finally {
      setApplyingStructure(false);
    }
  }

  /**
   * Candidate parents for the Structure section's dropdown: every ACTIVE detection
   * in this page except the selected node itself and every downstream descendant.
   * Excluding descendants here is UX polish — the server also refuses a cycle-
   * creating PUT (see structure-overrides.routes.ts), so this is defence-in-depth
   * plus a less confusing list.
   */
  const parentCandidates = useMemo(() => {
    if (!selectedId) return [] as Array<{ id: string; className: string }>;

    // Build a "who currently points at whom" map from the persisted overrides so a
    // node whose structure override already parents it under this selection is a
    // descendant, not a candidate.
    const childrenOf = new Map<string, string[]>();
    for (const [childId, override] of Object.entries(structureOverrides)) {
      if (typeof override.parentDetectionId === "string") {
        const list = childrenOf.get(override.parentDetectionId) ?? [];
        list.push(childId);
        childrenOf.set(override.parentDetectionId, list);
      }
    }
    const excluded = new Set<string>([selectedId]);
    const stack = [selectedId];
    while (stack.length) {
      const cursor = stack.pop()!;
      for (const child of childrenOf.get(cursor) ?? []) {
        if (!excluded.has(child)) {
          excluded.add(child);
          stack.push(child);
        }
      }
    }
    return effectiveDetections
      .filter((d) => d.status === "active" && !excluded.has(d.id))
      .map((d) => ({ id: d.id, className: d.className }));
  }, [selectedId, effectiveDetections, structureOverrides]);

  const selectedDetection = selectedId
    ? detections.find((d) => d.id === selectedId) ?? null
    : null;

  if (loading) {
    return <p className="p-6 text-sm text-gray-500">Loading project…</p>;
  }
  if (!project) {
    return <p className="p-6 text-sm text-red-600">Project not found.</p>;
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-600">
            ← Projects
          </Link>
          <h1 className="text-sm font-semibold text-gray-900">{project.name}</h1>
        </div>
        {asset && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => id && void detectJob.start(id, asset.id)}
              disabled={detectJob.running}
              title="Run the experimental component detector on this sketch"
              className="flex items-center gap-1.5 rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-800 hover:bg-purple-100 disabled:opacity-60"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-500" />
              {detectJob.running ? "Detecting…" : "Detect"}
              <span className="rounded bg-purple-200 px-1 text-[9px] font-semibold uppercase tracking-wide text-purple-900">
                Beta
              </span>
            </button>
            <button
              onClick={handleApproveTraining}
              disabled={approving}
              title="Snapshot this sketch's current boxes as approved training data (§36)"
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
            >
              {approving
                ? "Approving…"
                : approval?.approved
                  ? `Approved · ${approval.boxCount} boxes (${approval.datasetSplit})`
                  : "Approve for training"}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              title="Download this project's generated HTML/CSS as a ZIP"
              className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-60"
            >
              {exporting ? "Packaging…" : "Export ZIP"}
            </button>
            <button
              onClick={handleSaveVersion}
              disabled={saving}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save code version"}
            </button>
          </div>
        )}
      </header>

      {/* Job progress / outcome. The stage names come straight from the section 7.4-7.5
          job contract, so the user sees the same vocabulary the API reports. */}
      {asset && (detectJob.running || detectJob.error || modelCount > 0) && (
        <div
          className={`flex items-center justify-between gap-3 border-b px-4 py-1.5 text-xs ${
            detectJob.error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-purple-200 bg-purple-50 text-purple-900"
          }`}
        >
          {detectJob.error ? (
            <>
              <span>
                <strong>Detection failed.</strong> {detectJob.error}
                {detectJob.job?.retryable === false && " This will not succeed on retry."}
              </span>
              <button
                onClick={detectJob.dismissError}
                className="shrink-0 rounded px-2 py-0.5 text-red-700 hover:bg-red-100"
              >
                Dismiss
              </button>
            </>
          ) : detectJob.running ? (
            <span>
              Detecting components…{" "}
              <span className="text-purple-700">
                {detectJob.job?.stage?.replace(/_/g, " ") ?? "queued"}
                {typeof detectJob.job?.progress === "number" ? ` · ${detectJob.job.progress}%` : ""}
              </span>
            </span>
          ) : (
            <span>
              <strong>{modelCount}</strong> box{modelCount === 1 ? "" : "es"} from the detector
              (dashed purple). This model is <strong>experimental</strong> — accuracy varies a lot
              by component type, so check every box and correct it as you would your own.
            </span>
          )}
        </div>
      )}

      {/* Section 10.6: page boundary indicator, in the boundary's own distinct colour. */}
      {asset && boundary && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rose-200 bg-rose-50 px-4 py-1.5 text-xs text-rose-900">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-rose-600" />
            {boundary.applied ? (
              <>
                <strong>Page detected</strong> — confidence:{" "}
                {Math.round(boundary.confidence * 100)}%
              </>
            ) : (
              <>
                <strong>No page detected</strong> — using full image
              </>
            )}
          </span>

          <button
            onClick={() => setEditingBoundary((v) => !v)}
            className="rounded border border-rose-300 px-2 py-0.5 hover:bg-rose-100"
          >
            {editingBoundary ? "Done adjusting" : "Adjust boundary"}
          </button>

          {rejectedCount > 0 && (
            <>
              <span>
                <strong>{rejectedCount}</strong> box{rejectedCount === 1 ? "" : "es"} outside the
                page (kept, excluded from the generated page)
              </span>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={showRejected}
                  onChange={(e) => setShowRejected(e.target.checked)}
                />
                Show them
              </label>
            </>
          )}

          {!boundary.applied && (
            <span className="text-rose-700">
              Drag the boundary to set it manually — detections re-filter as you move it.
            </span>
          )}
        </div>
      )}

      {asset && exports.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-sky-200 bg-sky-50 px-4 py-1.5 text-xs text-sky-900">
          <span className="font-medium">Exports:</span>
          {exports.map((e) => (
            <a
              key={e.id}
              href={api.absoluteUrl(e.downloadUrl)}
              className="rounded border border-sky-300 px-2 py-0.5 hover:bg-sky-100"
            >
              v{e.versionNumber} · {(e.fileSize / 1024).toFixed(0)} KB
            </a>
          ))}
        </div>
      )}

      {/* §6.9 / §39 V1: code version history. Every Save (generated or edited) is a new
          immutable row here; clicking one activates it, which is what preview and export
          use. The active row is highlighted so it is always clear which version the
          panels are reflecting. */}
      {asset && versionList.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-xs text-slate-800">
          <span className="font-medium">Code versions:</span>
          {versionList.map((v) => (
            <button
              key={v.id}
              onClick={() => void handleActivateVersion(v.id).catch((e) => window.alert((e as Error).message))}
              disabled={v.isActive}
              title={
                v.isActive
                  ? "Active — preview and export use this version"
                  : "Activate this version for preview and export"
              }
              className={`rounded border px-2 py-0.5 ${
                v.isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 hover:bg-slate-100"
              } ${v.source === "edited" ? "italic" : ""}`}
            >
              v{v.versionNumber} · {v.source}
              {v.isActive ? " · active" : ""}
            </button>
          ))}
          <span className="text-slate-500">
            Edits create a new version; nothing above is ever mutated.
          </span>
        </div>
      )}

      {!asset ? (
        <div className="flex-1 p-8">
          <UploadDropzone onFile={handleUpload} uploading={uploading} />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-hidden border-r border-gray-200">
            <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
              <span className="text-xs text-gray-400">New box class:</span>
              <ClassPicker value={activeClass} onChange={setActiveClass} />
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 p-4">
              <AnnotationCanvas
                asset={asset}
                imageUrl={api.assetUrl(asset.storageKey)}
                detections={visibleDetections}
                selectedId={selectedId}
                activeClass={activeClass}
                onSelect={select}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
                onDeleteSelected={handleDeleteSelected}
                pageBoundary={boundary?.polygon ?? null}
                boundaryEditable={editingBoundary}
                onBoundaryChange={handleBoundaryChange}
              />
            </div>
          </div>

          <div className="flex w-64 flex-col overflow-hidden border-r border-gray-200">
            <div className="border-b border-gray-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              UI tree
            </div>
            <div className="flex-1 overflow-auto">
              {tree && (
                <UITreePanel
                  root={tree}
                  selectedDetectionId={selectedId}
                  onSelect={select}
                  modelDetectionIds={modelDetectionIds}
                />
              )}
            </div>
            {/* §17.1 splits Layers and Inspector into separate columns; the workspace is
                already dense so the inspector stacks under the tree in the same column. */}
            <div className="min-h-72 flex-1 border-t border-gray-200 overflow-auto">
              <InspectorPanel
                selected={selectedDetection}
                currentStyle={selectedDetection ? styleOverrides[selectedDetection.id] ?? {} : {}}
                currentContent={selectedDetection ? contentOverrides[selectedDetection.id] ?? null : null}
                currentGeometry={
                  selectedDetection ? geometryOverrides[selectedDetection.id] ?? null : null
                }
                currentStructure={
                  selectedDetection ? structureOverrides[selectedDetection.id] ?? null : null
                }
                parentCandidates={parentCandidates}
                onApplyStyle={handleApplyStyle}
                onResetStyle={handleResetStyle}
                onApplyContent={handleApplyContent}
                onResetContent={handleResetContent}
                onApplyGeometry={handleApplyGeometry}
                onResetGeometry={handleResetGeometry}
                onApplyStructure={handleApplyStructure}
                onResetStructure={handleResetStructure}
                busy={applyingStyle || applyingContent || applyingGeometry || applyingStructure}
              />
            </div>
          </div>

          <div className="flex w-[480px] flex-col overflow-hidden">
            <div className="flex border-b border-gray-200">
              {(["preview", "code"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setRightTab(t)}
                  className={`px-3 py-2 text-xs font-medium uppercase tracking-wide ${
                    rightTab === t ? "border-b-2 border-orange-500 text-gray-900" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {rightTab === "preview" ? (
                <PreviewPane html={html} css={css} resolveAssetPath={resolveAssetPath} />
              ) : (
                <CodePanel
                  html={html}
                  css={css}
                  onSave={handleSaveEdit}
                  saving={savingEdit}
                  activeVersionLabel={activeVersionLabel}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
