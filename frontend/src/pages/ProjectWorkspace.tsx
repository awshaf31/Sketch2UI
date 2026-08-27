import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  BBox,
  CodeVersion,
  ContentOverride,
  CorrectionRecord,
  DetectionStatus,
  GeometryOverride,
  Page,
  PageBoundary,
  PagePolygon,
  Project,
  ProjectAsset,
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
import { CanvasPanel } from "../features/annotation/CanvasPanel.js";
import UITreePanel from "../features/tree/UITreePanel.js";
import CodePanel from "../features/code/CodePanel.js";
import PreviewPane from "../features/preview/PreviewPane.js";
import InspectorPanel from "../features/inspector/InspectorPanel.js";
import { useDetectionJob } from "../features/detection/useDetectionJob.js";
import { buildTreeAndCode } from "../utils/tree.js";
import { WorkspaceToolbar } from "../features/workspace/WorkspaceToolbar.js";
import { WorkspaceBody } from "../features/workspace/WorkspaceBody.js";
import { WorkspaceNavigator } from "../features/workspace/WorkspaceNavigator.js";
import { PagesPanel } from "../features/workspace/PagesPanel.js";
import { AssetsPanel } from "../features/workspace/AssetsPanel.js";
// Retained only for the narrow pre-asset window — see the render-site comment above
// its one remaining usage below.
import { PagesStrip } from "../features/workspace/PagesStrip.js";
import {
  ActiveVersionSegment,
  DetectJobSegment,
  ExportsPopover,
  PageBoundarySegment,
  StatusBar,
} from "../features/workspace/StatusBar.js";
import { useToast } from "../components/ToastStack.js";
import { cn } from "../components/cn.js";
import { IconButton } from "../components/IconButton.js";
import { useMediaQuery } from "../components/useMediaQuery.js";
import { WorkspaceUnavailable } from "./WorkspaceUnavailable.js";

// Phase 2D. The shell (toolbar, status bar, the 4-region body layout) is rebuilt on the new
// primitives; every piece of state, every handler, and every prop passed to
// AnnotationCanvas/UITreePanel/InspectorPanel/ PreviewPane/CodePanel below is
// byte-identical to before this phase — only WHERE those components render changed, not
// what they do or receive.

// Stable reference for "no style override" — InspectorPanel resets its style draft
// whenever this prop's identity changes (see its useEffect on [selected?.id,
// currentStyle]), so a fresh `{}` literal here would wipe an unsaved style draft on
// every unrelated re-render (e.g. every 1s detect-job poll tick).
const EMPTY_STYLE_OVERRIDE: Record<string, string> = {};

// Points down when the dock is expanded (its usual state — clicking collapses it),
// up when collapsed. Same construction as UITreePanel's ChevronIcon.
function DockChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 10 10"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("transition-transform duration-fast", collapsed && "rotate-180")}
    >
      <path d="M2.5 3.5L5 6.5L7.5 3.5" />
    </svg>
  );
}

export default function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  // Phase 2J breakpoint tiers — plain media queries, not a JS-measured width, so there's no
  // drift from what CSS breakpoint classes elsewhere would show for the same viewport.
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  const [project, setProject] = useState<Project | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"preview" | "code">("preview");
  // Design audit 2026-08-26: the dock was a fixed 40%/32% of the viewport with no way to
  // reclaim that space for the canvas during Detect/Correct, where Preview/Code isn't
  // needed yet.
  const [dockCollapsed, setDockCollapsed] = useState(false);
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
  // Detection-inspector class change (§17.3 Detection group) — not an override map,
  // a direct PATCH on the detection (same route the canvas correction flow uses).
  const [applyingDetection, setApplyingDetection] = useState(false);
  // Correction history (§4) — the full project list; InspectorPanel is handed the
  // slice for whichever detection is selected. Read-only from this component too:
  // records are written server-side as a side effect of the mutation routes below.
  const [corrections, setCorrections] = useState<CorrectionRecord[]>([]);
  // the Assets tab needs the full per-page asset list; the Zustand store only ever tracked
  // the single most recent `asset` driving the canvas (by design — see its own comments).
  // This is a plain local list fed by the same listAssets()/uploadAsset() calls, kept in
  // sync alongside `asset` rather than replacing it.
  const [assetList, setAssetList] = useState<ProjectAsset[]>([]);

  const {
    currentPageId,
    asset,
    detections,
    selectedId,
    activeClass,
    setCurrentPageId,
    setAsset,
    setDetections,
    addDetection,
    updateDetection,
    removeDetection,
    select,
    setActiveClass,
  } = useProjectStore();

  // `currentPageId`/`asset`/`detections`/`selectedId` live in a MODULE-LEVEL Zustand
  // store (projectStore.ts) — unlike this component's own `useState` fields, they do
  // NOT reset when the route's `id` changes (a Zustand store is a singleton, not tied
  // to this component's lifecycle, and React Router reuses the same component
  // instance across a `/projects/:id` param change rather than remounting it). This
  // was a real, live-reproduced bug: navigating from project A to project B left
  // `currentPageId` holding A's page id for the render(s) before the `[id]` effect
  // further down resolves and corrects it — and every effect keyed on
  // `[id, currentPageId]` re-runs THAT SAME render (since `id` changed), so its own
  // `if (!id || !currentPageId) return` guard sees both as truthy and proceeds with
  // the WRONG pairing (new project id + old project's page id). That produced a 404
  // storm on every page-scoped route (assets, detections, code-versions, all four
  // override maps, corrections, approve-training, page-boundary) — confirmed live via
  // read_network_requests, twice, in two different sessions.
  //
  // Resetting the Zustand fields synchronously here does NOT fix this by itself:
  // `setCurrentPageId` is an external store's setter, not a React `useState` setter,
  // so calling it mid-render does not get React's "restart this render immediately
  // with the new value" treatment a local setState call gets — confirmed by testing:
  // the wrong-pairing requests still fired even with this reset in place. What DOES
  // reliably take effect within the same render — because `project`/`pages` ARE local
  // `useState`, declared above — is resetting THOSE synchronously the instant `id`
  // changes. `projectMatchesRoute` below is derived from that guaranteed-fresh
  // `project` state, so every downstream automatic effect gates on it instead of
  // trusting `currentPageId`'s mere truthiness.
  const [lastRenderedId, setLastRenderedId] = useState(id);
  if (id !== lastRenderedId) {
    setLastRenderedId(id);
    setProject(null);
    setPages([]);
    setCurrentPageId(null);
    setAsset(null);
    setDetections([]);
    select(null);
  }

  // True only once `project` has actually loaded AND matches the current route's
  // `id`. Every automatic (non-user-triggered) effect below that reads
  // `currentPageId` also requires this, so a stale-but-truthy `currentPageId` left
  // over from a previous project can never pair with a new project's `id` — see the
  // comment above.
  //
  // IMPORTANT: `projectMatchesRoute` must be listed in the dependency array of every
  // effect that guards on it, not just referenced in the guard condition. The `[id]`
  // effect below sets `project` (local `useState`) and `currentPageId` (the Zustand
  // store) together, synchronously, in the same `.then()` — but confirmed live via
  // console logging that they do NOT necessarily commit in the same React render:
  // Zustand's external-store subscription can notify on a different tick than React's
  // own batched `setState`. A `[id, currentPageId]`-only dependency array can
  // therefore reach a render where `currentPageId` already updated but `project`
  // hadn't yet — the effect's guard correctly blocks that render, but nothing then
  // re-invokes the effect once `project` catches up moments later, since `project`
  // isn't one of its dependencies. The result was a real, reproduced bug: a
  // newly-created project's own asset/detections never loaded — the guard was correct
  // but permanently starved of a re-run.
  const projectMatchesRoute = project?.id === id;

  // Reload detections from the API. Used after a detect job completes so model boxes
  // flow through the SAME rendering path as manual ones — canvas, tree, code, preview
  // all consume the store, and none of them know or care where a Detection came from.
  const refreshDetections = useCallback(async () => {
    if (!id || !currentPageId) return;
    setDetections(await api.listDetections(id, currentPageId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentPageId]);

  const detectJob = useDetectionJob(async (job) => {
    if (job.pageBoundary) setBoundary(job.pageBoundary);
    await refreshDetections();
  });

  // Refresh the version list and pull the full content of whichever version is now
  // active. Called after any save (generated or edited) and after an explicit activate.
  const refreshVersions = useCallback(async () => {
    if (!id || !currentPageId || !projectMatchesRoute) return;
    const summary = await api.listCodeVersions(id, currentPageId);
    setVersionList(summary.versions);
    if (summary.activeVersionId) {
      const active = summary.versions.find((v) => v.id === summary.activeVersionId);
      // Only refetch when the active version's id changed — otherwise a redundant fetch
      // clobbers the currently-loaded content with the same bytes.
      if (active && active.id !== activeVersion?.id) {
        setActiveVersion(await api.getCodeVersion(id, currentPageId, summary.activeVersionId));
      }
    } else {
      setActiveVersion(null);
    }
  }, [id, currentPageId, activeVersion?.id, projectMatchesRoute]);

  // Load the project and its pages once; default to the first page returned. Every
  // page-scoped effect below waits on currentPageId being set from here.
  //
  // `ignore` guards against a real, reproduced bug: navigating from project A to
  // project B before A's fetch resolves left this effect's stale `.then()` (still
  // holding A's pageList) free to fire AFTER the newer effect for B had already
  // started — there was nothing to stop it applying A's page id on top of B's
  // already-current id/project state. The result was exactly the kind of cross-
  // project 404 storm this produced live: every page-scoped call (assets,
  // detections, code-versions, all four override maps, corrections, approve-
  // training, page-boundary) 404ing at once, because `currentPageId` held a page
  // belonging to a DIFFERENT project than the one `id`/`project` actually named.
  // The standard fix is this ignore-flag: a fetch whose effect has since been
  // superseded (id changed, so the cleanup below already ran) must not apply its
  // result at all, matching the "cancel stale requests" pattern React's own docs
  // recommend for effects with async work.
  useEffect(() => {
    if (!id) return;
    let ignore = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([api.getProject(id), api.listPages(id)])
      .then(([proj, pageList]) => {
        if (ignore) return;
        setProject(proj);
        setPages(pageList);
        setCurrentPageId(pageList[0]?.id ?? null);
      })
      .catch((e) => {
        if (ignore) return;
        setProject(null);
        setLoadError((e as Error).message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  // Reload page-scoped data whenever the current page changes (initial load or a
  // switch via PagesStrip). Mirrors the previous project-mount effect, just re-keyed.
  useEffect(() => {
    if (!id || !currentPageId || !projectMatchesRoute) return;
    setAsset(null);
    setAssetList([]);
    setDetections([]);
    setActiveVersion(null);
    setVersionList([]);
    setBoundary(null);
    setApproval(null);
    Promise.all([api.listAssets(id, currentPageId), api.listDetections(id, currentPageId)])
      .then(([assets, dets]) => {
        setAsset(assets[assets.length - 1] ?? null);
        setAssetList(assets);
        setDetections(dets);
      })
      .catch((e) => setLoadError((e as Error).message));
    void refreshVersions().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentPageId, projectMatchesRoute]);

  useEffect(() => {
    if (!id || !currentPageId || !asset || !projectMatchesRoute) return;
    api.getTrainingApproval(id, currentPageId, asset.id).then(setApproval).catch(() => setApproval(null));
    api.listExports(id).then(setExports).catch(() => setExports([]));
    // Load the persisted boundary (§10.6) instead of recomputing a default. A manual
    // adjustment survives reloads and later re-detects — same sticky rule as detections.
    api
      .getPageBoundary(id, currentPageId, asset.id)
      .then((r) => { if (r.boundary) setBoundary(r.boundary); })
      .catch(() => {});
  }, [id, currentPageId, asset, projectMatchesRoute]);

  useEffect(() => {
    if (!id || !currentPageId || !projectMatchesRoute) return;
    api.listStyleOverrides(id, currentPageId).then(setStyleOverrides).catch(() => setStyleOverrides({}));
    api.listContentOverrides(id, currentPageId).then(setContentOverrides).catch(() => setContentOverrides({}));
    api.listGeometryOverrides(id, currentPageId).then(setGeometryOverrides).catch(() => setGeometryOverrides({}));
    api.listStructureOverrides(id, currentPageId).then(setStructureOverrides).catch(() => setStructureOverrides({}));
    api.listCorrections(id, currentPageId).then(setCorrections).catch(() => setCorrections([]));
  }, [id, currentPageId, projectMatchesRoute]);

  // Correction history (§4) is refreshed after every mutation that can produce a
  // new record — same "re-fetch after write" pattern the other override maps use.
  // Best-effort: if this fails the panel's History section just lags one refresh
  // behind, which is not worth surfacing as an error to the user.
  const refreshCorrections = useCallback(async () => {
    if (!id || !currentPageId) return;
    try {
      setCorrections(await api.listCorrections(id, currentPageId));
    } catch {
      // leave the previous list in place
    }
  }, [id, currentPageId]);

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
      asset && id && currentPageId
        ? buildTreeAndCode(
            // effectiveDetections already has geometry overrides folded in; passing
            // an empty geometry map to buildTreeAndCode avoids a double-apply pass.
            effectiveDetections,
            { width: asset.width, height: asset.height },
            project?.name,
            (node) =>
              node.sourceDetectionId ? api.cropUrl(id, currentPageId, node.sourceDetectionId) : null,
            styleOverrides,
            contentOverrides,
            // geometry already applied via effectiveDetections above; leave the
            // sixth arg unset so buildTreeAndCode does not double-apply.
            undefined,
            structureOverrides
          )
        : { tree: null, html: "", css: "" },
    [asset, effectiveDetections, project?.name, id, currentPageId, styleOverrides, contentOverrides, structureOverrides]
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
    if (!id || !currentPageId || !activeVersion?.metadata?.assets) return undefined;
    const assetMap = activeVersion.metadata.assets;
    return (relPath: string) => {
      const detectionId = assetMap[relPath];
      return detectionId ? api.cropUrl(id, currentPageId, detectionId) : null;
    };
  }, [id, currentPageId, activeVersion]);

  const activeVersionEntry = activeVersion
    ? versionList.find((v) => v.id === activeVersion.id)
    : undefined;
  const activeVersionLabel = activeVersionEntry
    ? `v${activeVersionEntry.versionNumber} · ${activeVersionEntry.source}`
    : versionList.length === 0
      ? "Live (unsaved)"
      : undefined;

  async function handleUpload(file: File) {
    if (!id || !currentPageId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await api.uploadAsset(id, currentPageId, file);
      setAsset(uploaded);
      setAssetList((prev) => [...prev, uploaded]);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleCreate(bbox: BBox) {
    if (!id || !currentPageId || !asset) return;
    try {
      const detection = await api.createDetection(id, currentPageId, {
        className: activeClass,
        bbox,
        sourceAssetId: asset.id,
      });
      addDetection(detection);
      void refreshCorrections();
    } catch (e) {
      // The box the user just drew has no local representation until this resolves
      // (unlike update/delete there's nothing optimistic to roll back) — surface why
      // it didn't appear rather than letting it silently vanish.
      window.alert(`Could not create the box: ${(e as Error).message}`);
    }
  }

  async function handleUpdate(detectionId: string, bbox: BBox) {
    if (!id || !currentPageId) return;
    const previous = detections.find((d) => d.id === detectionId);
    updateDetection(detectionId, { bbox }); // optimistic, keeps the drag responsive
    // Adopt the server's record: correcting a model detection flips it to source
    // "manual" (so a later Detect run cannot wipe the correction), and the canvas and
    // tree restyle off `source`. Without this the box would stay purple until reload.
    let saved;
    try {
      saved = await api.updateDetection(id, currentPageId, detectionId, bbox);
    } catch (e) {
      // Roll back the optimistic move/resize so the canvas doesn't disagree with
      // what the server actually has, and tell the user why the drag didn't stick.
      if (previous) updateDetection(detectionId, previous);
      window.alert(`Could not save the change: ${(e as Error).message}`);
      return;
    }
    updateDetection(detectionId, saved);
    void refreshCorrections();
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
        await api.clearGeometryOverride(id, currentPageId, detectionId);
      } catch {
        // Left in place: not worth surfacing — detection.bbox already reflects the drag.
      }
    }
  }

  async function handleDeleteSelected() {
    if (!id || !currentPageId || !selectedId) return;
    const target = selectedId;
    const previous = detections.find((d) => d.id === target);
    removeDetection(target);
    try {
      await api.deleteDetection(id, currentPageId, target);
      void refreshCorrections();
    } catch (e) {
      // Bring the box back rather than leaving the UI showing it gone when the
      // server still has it — a reload would otherwise "resurrect" it with no
      // explanation of why it came back.
      if (previous) addDetection(previous);
      window.alert(`Could not delete the box: ${(e as Error).message}`);
    }
  }

  /**
   * Detection-inspector class change (§17.3 Detection group). Unlike Style/
   * Content/Geometry/Structure this is not an override map — it PATCHes the
   * detection directly via the same route the canvas correction flow already
   * uses (handleUpdate). The server flips `source` to "manual" and records
   * `originalClassName` when the edited detection was model-sourced, exactly
   * as an in-canvas correction does — this is a second entry point onto the
   * same behavior, not a new one. Regenerates code afterward so preview/export
   * follow the same Apply pattern as the other Inspector groups.
   */
  async function handleChangeClass(detectionId: string, className: string) {
    if (!id || !currentPageId) return;
    setApplyingDetection(true);
    try {
      const saved = await api.updateDetection(id, currentPageId, detectionId, { className });
      updateDetection(detectionId, saved);
      await api.generateCode(id, currentPageId);
      await refreshVersions();
      void refreshCorrections();
    } finally {
      setApplyingDetection(false);
    }
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
    // Persist so it survives reload and is not clobbered by the next Detect run. The
    // in-memory boundary already reflects the user's drag either way; a failed save
    // only matters on reload, but silently swallowing it means that surprise is the
    // only way they'd ever find out, so warn instead.
    if (id && currentPageId && asset) {
      void api
        .savePageBoundary(id, currentPageId, asset.id, next)
        .catch((e) =>
          window.alert(`Boundary change is not saved and won't survive a reload: ${(e as Error).message}`)
        );
    }
  }

  async function handleApproveTraining() {
    if (!id || !currentPageId || !asset) return;
    setApproving(true);
    try {
      const r = await api.approveTraining(id, currentPageId, asset.id);
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
    if (!id || !currentPageId) return;
    setSaving(true);
    try {
      await api.generateCode(id, currentPageId);
      // Pull the newly-generated version and update the history strip. Without this the
      // preview would still show the previous active version and the new row would only
      // appear on a page reload.
      await refreshVersions();
    } catch (e) {
      window.alert(`Could not save version: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(input: { html: string; css: string }) {
    if (!id || !currentPageId) return;
    setSavingEdit(true);
    try {
      // basedOnVersionId carries the asset map forward so image paths in the edited
      // page still resolve to real crops at export time (§15.5). The server activates
      // the new version, so refreshVersions makes it the panels' new source of truth.
      await api.saveEditedCode(id, currentPageId, { ...input, basedOnVersionId: activeVersion?.id });
      await refreshVersions();
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleActivateVersion(versionId: string) {
    if (!id || !currentPageId) return;
    await api.activateCodeVersion(id, currentPageId, versionId);
    // The new active version's content may not be in memory yet; fetch it explicitly.
    setActiveVersion(await api.getCodeVersion(id, currentPageId, versionId));
    const summary = await api.listCodeVersions(id, currentPageId);
    setVersionList(summary.versions);
  }

  // Inspector Apply: persist the override, regenerate code (a NEW "generated"
  // CodeVersion — the source stays "generated" because this is still auto-emitted CSS,
  // just with an edited UI-IR — not the "edited" source value the code-editor uses),
  // then refresh history so preview and export follow through the existing active-
  // version pointer. Live preview already reflects the draft via styleOverrides state.
  async function handleApplyStyle(detectionId: string, style: Record<string, string>) {
    if (!id || !currentPageId) return;
    setApplyingStyle(true);
    try {
      const result = await api.putStyleOverride(id, currentPageId, detectionId, style);
      setStyleOverrides((prev) => {
        const next = { ...prev };
        if (result.style && Object.keys(result.style).length > 0) {
          next[detectionId] = result.style;
        } else {
          delete next[detectionId];
        }
        return next;
      });
      await api.generateCode(id, currentPageId);
      await refreshVersions();
    } finally {
      setApplyingStyle(false);
    }
  }

  async function handleResetStyle(detectionId: string) {
    if (!id || !currentPageId) return;
    setApplyingStyle(true);
    try {
      await api.clearStyleOverride(id, currentPageId, detectionId);
      setStyleOverrides((prev) => {
        const next = { ...prev };
        delete next[detectionId];
        return next;
      });
      await api.generateCode(id, currentPageId);
      await refreshVersions();
    } finally {
      setApplyingStyle(false);
    }
  }

  async function handleApplyContent(
    detectionId: string,
    content: { text?: string; altText?: string; href?: string }
  ) {
    if (!id || !currentPageId) return;
    setApplyingContent(true);
    try {
      const result = await api.putContentOverride(id, currentPageId, detectionId, content);
      setContentOverrides((prev) => {
        const next = { ...prev };
        if (result.override) {
          next[detectionId] = result.override;
        } else {
          delete next[detectionId];
        }
        return next;
      });
      await api.generateCode(id, currentPageId);
      await refreshVersions();
    } finally {
      setApplyingContent(false);
    }
  }

  async function handleResetContent(detectionId: string) {
    if (!id || !currentPageId) return;
    setApplyingContent(true);
    try {
      await api.clearContentOverride(id, currentPageId, detectionId);
      setContentOverrides((prev) => {
        const next = { ...prev };
        delete next[detectionId];
        return next;
      });
      await api.generateCode(id, currentPageId);
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
    if (!id || !currentPageId) return;
    setApplyingGeometry(true);
    try {
      const result = await api.putGeometryOverride(id, currentPageId, detectionId, geometry);
      setGeometryOverrides((prev) => {
        const next = { ...prev };
        if (result.geometry) {
          next[detectionId] = result.geometry;
        } else {
          delete next[detectionId];
        }
        return next;
      });
      await api.generateCode(id, currentPageId);
      await refreshVersions();
      void refreshCorrections();
    } finally {
      setApplyingGeometry(false);
    }
  }

  async function handleResetGeometry(detectionId: string) {
    if (!id || !currentPageId) return;
    setApplyingGeometry(true);
    try {
      await api.clearGeometryOverride(id, currentPageId, detectionId);
      setGeometryOverrides((prev) => {
        const next = { ...prev };
        delete next[detectionId];
        return next;
      });
      await api.generateCode(id, currentPageId);
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
    if (!id || !currentPageId) return;
    setApplyingStructure(true);
    try {
      const result = await api.putStructureOverride(id, currentPageId, detectionId, structure);
      setStructureOverrides((prev) => {
        const next = { ...prev };
        if (result.structure) {
          next[detectionId] = result.structure;
        } else {
          delete next[detectionId];
        }
        return next;
      });
      await api.generateCode(id, currentPageId);
      await refreshVersions();
      void refreshCorrections();
    } finally {
      setApplyingStructure(false);
    }
  }

  async function handleResetStructure(detectionId: string) {
    if (!id || !currentPageId) return;
    setApplyingStructure(true);
    try {
      await api.clearStructureOverride(id, currentPageId, detectionId);
      setStructureOverrides((prev) => {
        const next = { ...prev };
        delete next[detectionId];
        return next;
      });
      await api.generateCode(id, currentPageId);
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

  // Correction history scoped to the selected node — see InspectorPanel's History
  // section (§4.3).
  const selectedHistory = useMemo(
    () => (selectedId ? corrections.filter((c) => c.detectionId === selectedId) : []),
    [selectedId, corrections]
  );

  if (loading) {
    return <p className="p-6 text-sm text-text-muted">Loading project…</p>;
  }
  if (loadError) {
    return <p className="p-6 text-sm text-error">Failed to load project: {loadError}</p>;
  }
  if (!project) {
    return <p className="p-6 text-sm text-error">Project not found.</p>;
  }

  // below 768px the full editor is not attempted (including upload, per that doc's explicit
  // "Upload is NOT offered on mobile") — a dedicated screen instead of a silently-broken
  // cramped layout. Checked after the loading/error/not-found guards above so it always has
  // a real `project` to show.
  if (isMobile) {
    return (
      <WorkspaceUnavailable
        project={project}
        asset={asset}
        assetImageUrl={asset && id && currentPageId ? api.assetUrl(id, currentPageId, asset.id) : null}
        hasCodeVersion={versionList.length > 0}
        html={html}
        css={css}
        resolveAssetPath={resolveAssetPath}
      />
    );
  }

  const approvedLabel = approval?.approved
    ? `Approved · ${approval.boxCount} boxes (${approval.datasetSplit})`
    : null;

  return (
    <div className="flex h-screen flex-col bg-bg">
      <WorkspaceToolbar
        projectName={project.name}
        onRenameProject={async (name) => {
          if (!id || name === project.name) return;
          const updated = await api.renameProject(id, name);
          setProject(updated);
        }}
        hasAsset={!!asset}
        detecting={detectJob.running}
        onDetect={() => {
          if (id && currentPageId && asset) void detectJob.start(id, currentPageId, asset.id);
        }}
        approving={approving}
        approvedLabel={approvedLabel}
        onApprove={handleApproveTraining}
        exporting={exporting}
        onExport={handleExport}
        saving={saving}
        onSaveVersion={handleSaveVersion}
      />

      {/* Pages moved into the
          Navigator's "Pages" tab (below, once an asset exists and WorkspaceBody is
          showing). Before any asset is uploaded there is no Navigator to hold it yet
          (WorkspaceBody's whole 4-region shell mounts only post-upload — see the
          `!asset` branch below), so page switching stays reachable here as a plain
          top strip in exactly that one window. This is a narrower change than
          replacing PagesStrip outright: it keeps a real, working "switch to a page
          that already has its own asset before this one does" path intact without
          touching the canvas/inspector/dock pre-asset states, which are out of scope
          for this pass (§1 — all three are PRESERVE). */}
      {id && !asset && (
        <PagesStrip
          projectId={id}
          pages={pages}
          currentPageId={currentPageId}
          onPagesChange={setPages}
          onSelectPage={setCurrentPageId}
        />
      )}

      <StatusBar
        segments={[
          asset && (detectJob.running || detectJob.error || modelCount > 0) ? (
            <DetectJobSegment
              running={detectJob.running}
              error={detectJob.error}
              stage={detectJob.job?.stage}
              progress={detectJob.job?.progress}
              retryable={detectJob.job?.retryable}
              modelCount={modelCount}
              onDismissError={detectJob.dismissError}
            />
          ) : null,
          asset && boundary ? (
            <PageBoundarySegment
              boundary={boundary}
              editingBoundary={editingBoundary}
              onToggleEditing={() => setEditingBoundary((v) => !v)}
              rejectedCount={rejectedCount}
              showRejected={showRejected}
              onToggleShowRejected={setShowRejected}
            />
          ) : null,
          asset && versionList.length > 0 && activeVersionEntry ? (
            <ActiveVersionSegment
              label={`v${activeVersionEntry.versionNumber} · ${activeVersionEntry.source}${
                activeVersionEntry.isActive ? " · active" : ""
              }`}
            />
          ) : null,
          asset && exports.length > 0 ? (
            <ExportsPopover exports={exports} resolveDownloadUrl={(path) => api.absoluteUrl(path)} />
          ) : null,
        ]}
      />

      {!asset ? (
        <div className="flex-1 p-xl">
          <UploadDropzone onFile={handleUpload} uploading={uploading} error={uploadError} />
        </div>
      ) : (
        <WorkspaceBody
          isTablet={isTablet}
          dockCollapsed={dockCollapsed}
          navigator={
            id && (
              <WorkspaceNavigator
                pages={
                  <PagesPanel
                    projectId={id}
                    pages={pages}
                    currentPageId={currentPageId}
                    onPagesChange={setPages}
                    onSelectPage={setCurrentPageId}
                  />
                }
                layers={
                  tree && (
                    <UITreePanel
                      root={tree}
                      selectedDetectionId={selectedId}
                      onSelect={select}
                      modelDetectionIds={modelDetectionIds}
                    />
                  )
                }
                assets={
                  <AssetsPanel
                    projectId={id}
                    pageId={currentPageId}
                    assets={assetList}
                    activeAssetId={asset?.id ?? null}
                  />
                }
              />
            )
          }
          canvas={
            <CanvasPanel
              asset={asset}
              // id/currentPageId are non-null here: this branch only renders once
              // `asset` is set, and every effect that sets `asset` is itself gated
              // on both already being non-null (e.g. the `listAssets`/`uploadAsset`
              // effects above) — TS just can't see that cross-effect invariant.
              imageUrl={api.assetUrl(id!, currentPageId!, asset.id)}
              detections={visibleDetections}
              selectedId={selectedId}
              activeClass={activeClass}
              onActiveClassChange={setActiveClass}
              onSelect={select}
              onCreate={handleCreate}
              onUpdate={handleUpdate}
              onDeleteSelected={handleDeleteSelected}
              pageBoundary={boundary?.polygon ?? null}
              boundaryEditable={editingBoundary}
              onBoundaryChange={handleBoundaryChange}
            />
          }
          inspector={
            <InspectorPanel
              selected={selectedDetection}
              currentStyle={
                selectedDetection
                  ? styleOverrides[selectedDetection.id] ?? EMPTY_STYLE_OVERRIDE
                  : EMPTY_STYLE_OVERRIDE
              }
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
              onChangeClass={handleChangeClass}
              history={selectedHistory}
              busy={
                applyingStyle ||
                applyingContent ||
                applyingGeometry ||
                applyingStructure ||
                applyingDetection
              }
            />
          }
          dock={
            <div className="flex h-full flex-col">
              {/* Interactive version switcher — relocated here from its old standalone
                  banner, next to the Preview/Code content it controls (matches
                  the dock-header placement). The compact
                  ActiveVersionSegment above stays a read-only summary; this row is the
                  full clickable list, same handleActivateVersion call as before. */}
              {!dockCollapsed && versionList.length > 0 && (
                <div className="flex flex-wrap items-center gap-xs border-b border-border bg-surface-sunken px-md py-2xs">
                  <span className="text-2xs font-medium uppercase tracking-wide text-text-muted">
                    Versions:
                  </span>
                  {versionList.map((v) => (
                    <button
                      key={v.id}
                      onClick={() =>
                        void handleActivateVersion(v.id).catch((e) =>
                          showToast("error", (e as Error).message)
                        )
                      }
                      disabled={v.isActive}
                      title={
                        v.isActive
                          ? "Active — preview and export use this version"
                          : "Activate this version for preview and export"
                      }
                      className={cn(
                        "rounded-sm border px-xs py-2xs text-2xs transition-colors duration-fast",
                        v.isActive
                          ? "border-primary bg-primary text-text-inverse"
                          : "border-border text-text-secondary hover:bg-surface",
                        v.source === "edited" && "italic"
                      )}
                    >
                      v{v.versionNumber} · {v.source}
                      {v.isActive ? " · active" : ""}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center border-b border-border bg-surface-sunken">
                {(["preview", "code"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setRightTab(t)}
                    className={cn(
                      "px-md py-sm text-xs font-medium uppercase tracking-wide transition-colors duration-fast",
                      rightTab === t
                        ? "border-b-2 border-primary bg-surface text-text-primary"
                        : "text-text-muted hover:text-text-secondary"
                    )}
                  >
                    {t}
                  </button>
                ))}
                <IconButton
                  aria-label={dockCollapsed ? "Expand preview/code panel" : "Collapse preview/code panel"}
                  size="sm"
                  className="ml-auto mr-xs"
                  onClick={() => setDockCollapsed((c) => !c)}
                  icon={<DockChevronIcon collapsed={dockCollapsed} />}
                />
              </div>
              <div className={cn("flex-1 overflow-hidden", dockCollapsed && "hidden")}>
                {rightTab === "preview" ? (
                  <PreviewPane
                    html={html}
                    css={css}
                    resolveAssetPath={resolveAssetPath}
                    // Reuses the same busy signals InspectorPanel's `busy` prop already
                    // combines, plus the two code-save flags — no new state (Phase 2I).
                    loading={
                      applyingStyle ||
                      applyingContent ||
                      applyingGeometry ||
                      applyingStructure ||
                      applyingDetection ||
                      saving ||
                      savingEdit
                    }
                  />
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
          }
        />
      )}
    </div>
  );
}
