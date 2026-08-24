import { useEffect, useMemo, useState } from "react";
import type {
  ContentOverride,
  Detection,
  GeometryOverride,
  StructureOverride,
} from "@sketch2ui/shared-types";
import { contentFieldsFor, validateGeometryOverride } from "@sketch2ui/shared-types";

// Style + Content + Geometry inspector — plan §6.7 / §17.3. Field set matches the
// plan's grouping exactly: Style is display/gap/padding/margin/font-size/alignment
// (§17.3); Content is text/altText/href (§17.3 Content group, Appendix Q); Geometry
// is x/y/width/height (§17.3 Geometry group). Debounce-then-apply (§6.12): drafts
// live locally in this panel and are pushed to the API only when the user hits
// Apply, so typing a value never triggers a codegen round-trip.

export type StyleOverride = Record<string, string>;

export interface ContentDraft {
  text?: string;
  altText?: string;
  href?: string;
}

interface InspectorPanelProps {
  /**
   * The currently-selected detection. All three sections are disabled without one —
   * an override needs a node to attach to, so Apply has nothing to save.
   */
  selected: Detection | null;
  /** Current persisted style override for the selected detection (empty if none). */
  currentStyle: StyleOverride;
  /** Current persisted content override for the selected detection (null if none). */
  currentContent: ContentOverride | null;
  /** Current persisted geometry override for the selected detection (null if none). */
  currentGeometry: GeometryOverride | null;
  /** Current persisted structure override for the selected detection (null if none). */
  currentStructure: StructureOverride | null;
  /**
   * The candidate parents the dropdown offers — all active detections in the project
   * EXCEPT the selected node itself and anything downstream of it (which would create
   * a cycle). ProjectWorkspace builds this list; the panel just renders it.
   */
  parentCandidates: Array<Pick<Detection, "id" | "className">>;
  /**
   * Apply the style draft: persist and regenerate. Rejecting propagates so the panel
   * can surface the error rather than silently swallowing a failed save.
   */
  onApplyStyle: (detectionId: string, style: StyleOverride) => Promise<void>;
  /** Clear all style overrides for this component and regenerate. */
  onResetStyle: (detectionId: string) => Promise<void>;
  /**
   * Apply the content draft: persist and regenerate. Only the fields applicable to
   * the selected class are sent — the API rejects unknown/inapplicable combinations.
   */
  onApplyContent: (detectionId: string, content: ContentDraft) => Promise<void>;
  /** Clear the content override for this component. */
  onResetContent: (detectionId: string) => Promise<void>;
  /**
   * Apply the geometry draft: persist and regenerate. Only fields the user actually
   * touched are sent — undefined dimensions inherit the detection's stored bbox.
   */
  onApplyGeometry: (detectionId: string, geometry: GeometryOverride) => Promise<void>;
  /** Clear the geometry override for this component. */
  onResetGeometry: (detectionId: string) => Promise<void>;
  /**
   * Apply the structure draft: persist and regenerate. Body is `parentDetectionId`
   * (string | null | undefined) and/or `displayOrder`. Auto containment inference
   * still runs — the override redirects it rather than replacing it.
   */
  onApplyStructure: (detectionId: string, structure: StructureOverride) => Promise<void>;
  /** Clear the structure override for this component (revert to auto). */
  onResetStructure: (detectionId: string) => Promise<void>;
  /** Whether an Apply/Reset (any group) is currently in flight. */
  busy?: boolean;
}

const DISPLAY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Auto (from layout)" },
  { value: "block", label: "block" },
  { value: "flex", label: "flex" },
  { value: "grid", label: "grid" },
  { value: "inline-block", label: "inline-block" },
];

const ALIGN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Auto" },
  { value: "left", label: "left" },
  { value: "center", label: "center" },
  { value: "right", label: "right" },
];

type StyleFieldKey = "display" | "gap" | "padding" | "margin" | "font-size" | "text-align";

// Everything the panel writes ships through this list — the ALLOWED_PROPERTIES set on
// the server rejects anything else, so keeping this frozen means a UI regression cannot
// silently start writing unrecognised properties.
const STYLE_FIELDS: StyleFieldKey[] = [
  "display",
  "gap",
  "padding",
  "margin",
  "font-size",
  "text-align",
];

function emptyStyleDraft(): Record<StyleFieldKey, string> {
  return { display: "", gap: "", padding: "", margin: "", "font-size": "", "text-align": "" };
}

function toStyleDraft(override: StyleOverride): Record<StyleFieldKey, string> {
  const draft = emptyStyleDraft();
  for (const key of STYLE_FIELDS) draft[key] = override[key] ?? "";
  return draft;
}

function nonEmptyStyle(draft: Record<StyleFieldKey, string>): StyleOverride {
  const out: StyleOverride = {};
  for (const key of STYLE_FIELDS) {
    const value = draft[key].trim();
    if (value) out[key] = value;
  }
  return out;
}

function styleDraftsEqual(
  a: Record<StyleFieldKey, string>,
  b: Record<StyleFieldKey, string>
): boolean {
  return STYLE_FIELDS.every((k) => a[k].trim() === b[k].trim());
}

// Content draft mirrors the API body shape 1:1. Empty strings are treated as "no
// value" and dropped on Apply so a user clearing a field reverts to the placeholder,
// matching the server's "empty PUT is a delete" convention.
function toContentDraft(override: ContentOverride | null): Required<ContentDraft> {
  return {
    text: override?.text ?? "",
    altText: override?.altText ?? "",
    href: override?.href ?? "",
  };
}

function nonEmptyContent(
  draft: Required<ContentDraft>,
  applicable: ReadonlySet<"text" | "altText" | "href">
): ContentDraft {
  const out: ContentDraft = {};
  if (applicable.has("text") && draft.text.trim()) out.text = draft.text;
  if (applicable.has("altText") && draft.altText.trim()) out.altText = draft.altText;
  if (applicable.has("href") && draft.href.trim()) out.href = draft.href;
  return out;
}

function contentDraftsEqual(
  a: Required<ContentDraft>,
  b: Required<ContentDraft>,
  applicable: ReadonlySet<"text" | "altText" | "href">
): boolean {
  for (const key of ["text", "altText", "href"] as const) {
    if (!applicable.has(key)) continue;
    if ((a[key] ?? "") !== (b[key] ?? "")) return false;
  }
  return true;
}

// Geometry draft is a string map so partial input (empty = "inherit the detection
// bbox for this field") round-trips cleanly through the DOM value model. Numbers
// go over the wire; only non-empty fields are sent so a user editing width alone
// does not have to restate x/y/height.
type GeometryFieldKey = "x" | "y" | "width" | "height";
const GEOMETRY_FIELDS: GeometryFieldKey[] = ["x", "y", "width", "height"];

function emptyGeometryDraft(): Record<GeometryFieldKey, string> {
  return { x: "", y: "", width: "", height: "" };
}

function toGeometryDraft(
  override: GeometryOverride | null
): Record<GeometryFieldKey, string> {
  const draft = emptyGeometryDraft();
  if (!override) return draft;
  for (const key of GEOMETRY_FIELDS) {
    const value = override[key];
    if (typeof value === "number") draft[key] = String(value);
  }
  return draft;
}

function geometryDraftsEqual(
  a: Record<GeometryFieldKey, string>,
  b: Record<GeometryFieldKey, string>
): boolean {
  return GEOMETRY_FIELDS.every((k) => a[k].trim() === b[k].trim());
}

function parseGeometryDraft(
  draft: Record<GeometryFieldKey, string>
): { ok: true; override: GeometryOverride } | { ok: false; error: string } {
  const parsed: GeometryOverride = {};
  for (const key of GEOMETRY_FIELDS) {
    const raw = draft[key].trim();
    if (raw === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return { ok: false, error: `${key} must be a number.` };
    }
    parsed[key] = n;
  }
  return { ok: true, override: parsed };
}

// Structure draft — parent as a string ("" = "auto", "__root__" = force to root,
// anything else = detection id) and displayOrder as a string. Neutral empty state
// means "no override", matching the "leave blank to inherit" convention the
// Geometry section already established. The sentinel makes explicit-root
// distinguishable from unset in a select value.
interface StructureDraft {
  parent: string;
  displayOrder: string;
}

const STRUCTURE_ROOT_SENTINEL = "__root__";

function toStructureDraft(override: StructureOverride | null): StructureDraft {
  if (!override) return { parent: "", displayOrder: "" };
  return {
    parent:
      override.parentDetectionId === undefined
        ? ""
        : override.parentDetectionId === null
          ? STRUCTURE_ROOT_SENTINEL
          : override.parentDetectionId,
    displayOrder:
      typeof override.displayOrder === "number" ? String(override.displayOrder) : "",
  };
}

function structureDraftsEqual(a: StructureDraft, b: StructureDraft): boolean {
  return a.parent === b.parent && a.displayOrder.trim() === b.displayOrder.trim();
}

function parseStructureDraft(
  draft: StructureDraft
): { ok: true; override: StructureOverride } | { ok: false; error: string } {
  const override: StructureOverride = {};
  if (draft.parent === STRUCTURE_ROOT_SENTINEL) {
    override.parentDetectionId = null;
  } else if (draft.parent !== "") {
    override.parentDetectionId = draft.parent;
  }
  const orderRaw = draft.displayOrder.trim();
  if (orderRaw !== "") {
    const n = Number(orderRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      return { ok: false, error: "displayOrder must be a non-negative integer." };
    }
    override.displayOrder = n;
  }
  return { ok: true, override };
}

export default function InspectorPanel({
  selected,
  currentStyle,
  currentContent,
  currentGeometry,
  currentStructure,
  parentCandidates,
  onApplyStyle,
  onResetStyle,
  onApplyContent,
  onResetContent,
  onApplyGeometry,
  onResetGeometry,
  onApplyStructure,
  onResetStructure,
  busy,
}: InspectorPanelProps) {
  const [styleDraft, setStyleDraft] = useState<Record<StyleFieldKey, string>>(() =>
    toStyleDraft(currentStyle)
  );
  const [contentDraft, setContentDraft] = useState<Required<ContentDraft>>(() =>
    toContentDraft(currentContent)
  );
  const [geometryDraft, setGeometryDraft] = useState<Record<GeometryFieldKey, string>>(
    () => toGeometryDraft(currentGeometry)
  );
  const [structureDraft, setStructureDraft] = useState<StructureDraft>(() =>
    toStructureDraft(currentStructure)
  );
  const [styleError, setStyleError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [geometryError, setGeometryError] = useState<string | null>(null);
  const [structureError, setStructureError] = useState<string | null>(null);

  // Applicability is class-driven (Appendix P): a text field on an image would be
  // silently ignored server-side, so the panel does not offer it at all. This is the
  // "show/hide fields based on the selected node's class" behavior the plan calls for.
  const applicableFields = useMemo(
    () => new Set(selected ? contentFieldsFor(selected.className) : []),
    [selected]
  );

  useEffect(() => {
    setStyleDraft(toStyleDraft(currentStyle));
    setStyleError(null);
  }, [selected?.id, currentStyle]);

  useEffect(() => {
    setContentDraft(toContentDraft(currentContent));
    setContentError(null);
  }, [selected?.id, currentContent]);

  useEffect(() => {
    setGeometryDraft(toGeometryDraft(currentGeometry));
    setGeometryError(null);
  }, [selected?.id, currentGeometry]);

  useEffect(() => {
    setStructureDraft(toStructureDraft(currentStructure));
    setStructureError(null);
  }, [selected?.id, currentStructure]);

  const styleDirty = !styleDraftsEqual(styleDraft, toStyleDraft(currentStyle));
  const contentDirty = !contentDraftsEqual(
    contentDraft,
    toContentDraft(currentContent),
    applicableFields
  );
  const geometryDirty = !geometryDraftsEqual(geometryDraft, toGeometryDraft(currentGeometry));
  const structureDirty = !structureDraftsEqual(structureDraft, toStructureDraft(currentStructure));
  const hasStyleOverride = Object.keys(currentStyle).length > 0;
  const hasContentOverride =
    !!currentContent &&
    (!!currentContent.text || !!currentContent.altText || !!currentContent.href);
  const hasGeometryOverride =
    !!currentGeometry &&
    (currentGeometry.x !== undefined ||
      currentGeometry.y !== undefined ||
      currentGeometry.width !== undefined ||
      currentGeometry.height !== undefined);
  const hasStructureOverride =
    !!currentStructure &&
    (currentStructure.parentDetectionId !== undefined ||
      currentStructure.displayOrder !== undefined);

  async function handleApplyStyle() {
    if (!selected) return;
    setStyleError(null);
    try {
      await onApplyStyle(selected.id, nonEmptyStyle(styleDraft));
    } catch (err) {
      setStyleError((err as Error).message);
    }
  }

  async function handleResetStyle() {
    if (!selected) return;
    setStyleError(null);
    try {
      await onResetStyle(selected.id);
    } catch (err) {
      setStyleError((err as Error).message);
    }
  }

  async function handleApplyContent() {
    if (!selected) return;
    setContentError(null);
    try {
      await onApplyContent(selected.id, nonEmptyContent(contentDraft, applicableFields));
    } catch (err) {
      setContentError((err as Error).message);
    }
  }

  async function handleResetContent() {
    if (!selected) return;
    setContentError(null);
    try {
      await onResetContent(selected.id);
    } catch (err) {
      setContentError((err as Error).message);
    }
  }

  async function handleApplyGeometry() {
    if (!selected) return;
    setGeometryError(null);

    const parsed = parseGeometryDraft(geometryDraft);
    if (!parsed.ok) {
      setGeometryError(parsed.error);
      return;
    }
    // Client-side validation runs the SAME rules the server enforces, so a caught
    // rejection here matches an API 400 verbatim — no divergent error messages.
    const validated = validateGeometryOverride(parsed.override, selected.bbox);
    if (!validated.ok) {
      setGeometryError(validated.error);
      return;
    }

    try {
      await onApplyGeometry(selected.id, validated.override);
    } catch (err) {
      setGeometryError((err as Error).message);
    }
  }

  async function handleResetGeometry() {
    if (!selected) return;
    setGeometryError(null);
    try {
      await onResetGeometry(selected.id);
    } catch (err) {
      setGeometryError((err as Error).message);
    }
  }

  async function handleApplyStructure() {
    if (!selected) return;
    setStructureError(null);
    const parsed = parseStructureDraft(structureDraft);
    if (!parsed.ok) {
      setStructureError(parsed.error);
      return;
    }
    try {
      await onApplyStructure(selected.id, parsed.override);
    } catch (err) {
      setStructureError((err as Error).message);
    }
  }

  async function handleResetStructure() {
    if (!selected) return;
    setStructureError(null);
    try {
      await onResetStructure(selected.id);
    } catch (err) {
      setStructureError((err as Error).message);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        Inspector
      </div>

      {!selected ? (
        <div className="px-3 py-4 text-xs text-gray-500">
          Select a component on the canvas or in the tree to edit its style, geometry, structure and content.
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-auto">
          <div className="px-3 py-2 text-xs text-gray-600">
            <div className="font-medium text-gray-900">{selected.className}</div>
            <div className="text-gray-400">
              Confidence: {Math.round(selected.confidence * 100)}% · {selected.source}
            </div>
          </div>

          {/* -------- Style section -------- */}

          <div className="border-t border-gray-100 px-3 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Style
          </div>

          <div className="grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-2 px-3 pb-3 text-xs">
            <label className="text-gray-500" htmlFor="style-display">display</label>
            <select
              id="style-display"
              value={styleDraft.display}
              onChange={(e) => setStyleDraft({ ...styleDraft, display: e.target.value })}
              disabled={busy}
              className="rounded border border-gray-300 px-1.5 py-1"
            >
              {DISPLAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <label className="text-gray-500" htmlFor="style-gap">gap</label>
            <input
              id="style-gap"
              value={styleDraft.gap}
              placeholder="e.g. 12px"
              onChange={(e) => setStyleDraft({ ...styleDraft, gap: e.target.value })}
              disabled={busy}
              className="rounded border border-gray-300 px-1.5 py-1"
            />

            <label className="text-gray-500" htmlFor="style-padding">padding</label>
            <input
              id="style-padding"
              value={styleDraft.padding}
              placeholder="e.g. 16px or 8px 12px"
              onChange={(e) => setStyleDraft({ ...styleDraft, padding: e.target.value })}
              disabled={busy}
              className="rounded border border-gray-300 px-1.5 py-1"
            />

            <label className="text-gray-500" htmlFor="style-margin">margin</label>
            <input
              id="style-margin"
              value={styleDraft.margin}
              placeholder="e.g. 0 0 16px 0"
              onChange={(e) => setStyleDraft({ ...styleDraft, margin: e.target.value })}
              disabled={busy}
              className="rounded border border-gray-300 px-1.5 py-1"
            />

            <label className="text-gray-500" htmlFor="style-font-size">font-size</label>
            <input
              id="style-font-size"
              value={styleDraft["font-size"]}
              placeholder="e.g. 16px"
              onChange={(e) => setStyleDraft({ ...styleDraft, "font-size": e.target.value })}
              disabled={busy}
              className="rounded border border-gray-300 px-1.5 py-1"
            />

            <label className="text-gray-500" htmlFor="style-text-align">alignment</label>
            <select
              id="style-text-align"
              value={styleDraft["text-align"]}
              onChange={(e) => setStyleDraft({ ...styleDraft, "text-align": e.target.value })}
              disabled={busy}
              className="rounded border border-gray-300 px-1.5 py-1"
            >
              {ALIGN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {styleError && (
            <div className="mx-3 mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">
              {styleError}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">
              {busy
                ? "Working…"
                : styleDirty
                  ? "Unapplied"
                  : hasStyleOverride
                    ? "Applied"
                    : "No style overrides"}
            </span>
            <div className="flex gap-1">
              <button
                onClick={handleResetStyle}
                disabled={busy || !hasStyleOverride}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                title="Clear this component's style overrides and revert to the auto-inferred layout"
              >
                Reset
              </button>
              <button
                onClick={handleApplyStyle}
                disabled={busy || !styleDirty}
                className="rounded bg-gray-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                title="Save these style tweaks and regenerate the code"
              >
                Apply
              </button>
            </div>
          </div>

          {/* -------- Geometry section (§17.3 Geometry) -------- */}

          <div className="border-t border-gray-100 px-3 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Geometry
          </div>

          <div className="px-3 pb-1 text-[10px] text-gray-400">
            Normalized [0..1] relative to the sketch. Leave a field blank to inherit the
            detection's stored value.
          </div>

          <div className="grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-2 px-3 pb-3 text-xs">
            <label className="text-gray-500" htmlFor="geo-x">x</label>
            <input
              id="geo-x"
              type="number"
              step="0.001"
              min={0}
              max={1}
              value={geometryDraft.x}
              placeholder={selected.bbox.x.toFixed(4)}
              onChange={(e) => setGeometryDraft({ ...geometryDraft, x: e.target.value })}
              disabled={busy}
              className="rounded border border-gray-300 px-1.5 py-1"
            />

            <label className="text-gray-500" htmlFor="geo-y">y</label>
            <input
              id="geo-y"
              type="number"
              step="0.001"
              min={0}
              max={1}
              value={geometryDraft.y}
              placeholder={selected.bbox.y.toFixed(4)}
              onChange={(e) => setGeometryDraft({ ...geometryDraft, y: e.target.value })}
              disabled={busy}
              className="rounded border border-gray-300 px-1.5 py-1"
            />

            <label className="text-gray-500" htmlFor="geo-width">width</label>
            <input
              id="geo-width"
              type="number"
              step="0.001"
              min={0}
              max={1}
              value={geometryDraft.width}
              placeholder={selected.bbox.width.toFixed(4)}
              onChange={(e) => setGeometryDraft({ ...geometryDraft, width: e.target.value })}
              disabled={busy}
              className="rounded border border-gray-300 px-1.5 py-1"
            />

            <label className="text-gray-500" htmlFor="geo-height">height</label>
            <input
              id="geo-height"
              type="number"
              step="0.001"
              min={0}
              max={1}
              value={geometryDraft.height}
              placeholder={selected.bbox.height.toFixed(4)}
              onChange={(e) => setGeometryDraft({ ...geometryDraft, height: e.target.value })}
              disabled={busy}
              className="rounded border border-gray-300 px-1.5 py-1"
            />
          </div>

          {geometryError && (
            <div className="mx-3 mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">
              {geometryError}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">
              {busy
                ? "Working…"
                : geometryDirty
                  ? "Unapplied"
                  : hasGeometryOverride
                    ? "Applied"
                    : "No geometry override"}
            </span>
            <div className="flex gap-1">
              <button
                onClick={handleResetGeometry}
                disabled={busy || !hasGeometryOverride}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                title="Clear this component's geometry override and revert to the raw detection bbox"
              >
                Reset
              </button>
              <button
                onClick={handleApplyGeometry}
                disabled={busy || !geometryDirty}
                className="rounded bg-gray-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                title="Save this position/size and regenerate the code"
              >
                Apply
              </button>
            </div>
          </div>

          {/* -------- Structure section (§17.3 Structure) -------- */}

          <div className="border-t border-gray-100 px-3 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Structure
          </div>

          <div className="px-3 pb-1 text-[10px] text-gray-400">
            Reparent this node or pin its position among its siblings. Leave a field
            blank to keep auto-inferred behaviour.
          </div>

          <div className="grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-2 px-3 pb-3 text-xs">
            <label className="text-gray-500" htmlFor="structure-parent">parent</label>
            <select
              id="structure-parent"
              value={structureDraft.parent}
              onChange={(e) =>
                setStructureDraft({ ...structureDraft, parent: e.target.value })
              }
              disabled={busy}
              className="rounded border border-gray-300 px-1.5 py-1"
            >
              <option value="">Auto (from containment)</option>
              <option value={STRUCTURE_ROOT_SENTINEL}>Root (page)</option>
              {parentCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.className} · {candidate.id.slice(0, 8)}
                </option>
              ))}
            </select>

            <label className="text-gray-500" htmlFor="structure-order">order</label>
            <input
              id="structure-order"
              type="number"
              min={0}
              step={1}
              value={structureDraft.displayOrder}
              placeholder="Auto"
              onChange={(e) =>
                setStructureDraft({ ...structureDraft, displayOrder: e.target.value })
              }
              disabled={busy}
              className="rounded border border-gray-300 px-1.5 py-1"
            />
          </div>

          {structureError && (
            <div className="mx-3 mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">
              {structureError}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">
              {busy
                ? "Working…"
                : structureDirty
                  ? "Unapplied"
                  : hasStructureOverride
                    ? "Applied"
                    : "No structure override"}
            </span>
            <div className="flex gap-1">
              <button
                onClick={handleResetStructure}
                disabled={busy || !hasStructureOverride}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                title="Clear parent/order overrides and let auto containment inference decide"
              >
                Reset
              </button>
              <button
                onClick={handleApplyStructure}
                disabled={busy || !structureDirty}
                className="rounded bg-gray-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                title="Save this parent/order and regenerate the code"
              >
                Apply
              </button>
            </div>
          </div>

          {/* -------- Content section (§17.3 Content, Appendix Q) -------- */}

          <div className="border-t border-gray-100 px-3 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Content
          </div>

          {applicableFields.size === 0 ? (
            <div className="px-3 pb-3 text-xs text-gray-500">
              Content editing does not apply to <span className="font-mono">{selected.className}</span>.
              This is a container class in the plan's content mapping (Appendix P).
            </div>
          ) : (
            <div className="grid grid-cols-[80px_1fr] items-start gap-x-2 gap-y-2 px-3 pb-3 text-xs">
              {applicableFields.has("text") && (
                <>
                  <label className="pt-1 text-gray-500" htmlFor="content-text">text</label>
                  <textarea
                    id="content-text"
                    value={contentDraft.text}
                    placeholder="Placeholder used if left blank"
                    onChange={(e) => setContentDraft({ ...contentDraft, text: e.target.value })}
                    disabled={busy}
                    rows={3}
                    className="rounded border border-gray-300 px-1.5 py-1 font-sans"
                  />
                </>
              )}

              {applicableFields.has("altText") && (
                <>
                  <label className="text-gray-500" htmlFor="content-alt">alt text</label>
                  <input
                    id="content-alt"
                    value={contentDraft.altText}
                    placeholder="e.g. Portrait of the founder"
                    onChange={(e) =>
                      setContentDraft({ ...contentDraft, altText: e.target.value })
                    }
                    disabled={busy}
                    className="rounded border border-gray-300 px-1.5 py-1"
                  />
                </>
              )}

              {applicableFields.has("href") && (
                <>
                  <label className="text-gray-500" htmlFor="content-href">link</label>
                  <input
                    id="content-href"
                    value={contentDraft.href}
                    placeholder="/about or https://example.com"
                    onChange={(e) => setContentDraft({ ...contentDraft, href: e.target.value })}
                    disabled={busy}
                    className="rounded border border-gray-300 px-1.5 py-1"
                  />
                </>
              )}
            </div>
          )}

          {contentError && (
            <div className="mx-3 mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">
              {contentError}
            </div>
          )}

          {applicableFields.size > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
              <span className="text-[10px] uppercase tracking-wide text-gray-400">
                {busy
                  ? "Working…"
                  : contentDirty
                    ? "Unapplied"
                    : hasContentOverride
                      ? `Applied · ${currentContent?.contentState}`
                      : "Unknown (placeholder)"}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={handleResetContent}
                  disabled={busy || !hasContentOverride}
                  className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  title="Clear this component's content override and revert to the placeholder"
                >
                  Reset
                </button>
                <button
                  onClick={handleApplyContent}
                  disabled={busy || !contentDirty}
                  className="rounded bg-gray-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                  title="Save this content and regenerate the code"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
