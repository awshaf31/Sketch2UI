import { useEffect, useMemo, useState } from "react";
import type {
  ContentOverride,
  CorrectionRecord,
  Detection,
  GeometryOverride,
  StructureOverride,
} from "@sketch2ui/shared-types";
import { ALL_CLASSES, contentFieldsFor, validateGeometryOverride } from "@sketch2ui/shared-types";
import { AccordionSection } from "./AccordionSection.js";
import { GeometrySpatialEditor } from "./GeometrySpatialEditor.js";
import { InspectorSectionFooter } from "./InspectorSectionFooter.js";
import { Button } from "../../components/Button.js";
import { EmptyState } from "../../components/EmptyState.js";
import { Field } from "../../components/Field.js";
import { Input, Textarea } from "../../components/Input.js";
import { Select } from "../../components/Select.js";
import { Tooltip } from "../../components/Tooltip.js";
import { cn } from "../../components/cn.js";

// Style + Content + Geometry inspector — plan §6.7 / §17.3. Field set matches the
// plan's grouping exactly: Style is display/gap/padding/margin/font-size/alignment
// (§17.3); Content is text/altText/href (§17.3 Content group, Appendix Q); Geometry
// is x/y/width/height (§17.3 Geometry group). Debounce-then-apply (§6.12): drafts
// live locally in this panel and are pushed to the API only when the user hits
// Apply, so typing a value never triggers a codegen round-trip.
//
// Phase 2G — accordion shell + shared footer. EVERY draft/dirty/validation/handler function
// below is unchanged from before this phase, including the EMPTY_STYLE_OVERRIDE
// reference-identity contract this component's props depend on (see ProjectWorkspace.tsx's
// own comment on that constant) — only the JSX this component RETURNS was restructured.
// Per-section status labels keep their EXACT original text (e.g. Detection's clean-state
// "Saved") rather than a simplified generic table, because e2e/golden-path.spec.ts asserts
// `getByText("Saved")` verbatim — preserving that assertion wins over any illustrative
// label table.

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
  /**
   * Change the detection's class. Unlike the other four groups this is NOT an
   * override map — it PATCHes the detection itself. When the current source is
   * `model`, the server flips it to `manual` and records `originalClassName` so a
   * later re-detect cannot overwrite the correction (plan §17.3 Detection group).
   * The parent regenerates the code as part of Apply so preview + export stay in
   * step with every other Inspector group's flow.
   */
  onChangeClass: (detectionId: string, className: string) => Promise<void>;
  /**
   * Correction history for the selected detection ONLY (plan §4.3 — "optional but
   * useful"), oldest first. Read-only: this panel never writes here directly, the
   * records are a side effect of the routes behind onChangeClass/onApplyGeometry/
   * onApplyStructure/create/delete. Empty array (not undefined) when there is none
   * yet, so the section can render a clean "No corrections yet" state.
   */
  history: CorrectionRecord[];
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

// Single source of truth for the section names/order, since the empty state's preview
// row below can't just be generated from the real AccordionSection blocks further down
// (each is hand-written JSX with its own distinct fields, not a data-driven loop). Found
// out of sync with the real order (Detection/Geometry/Style/Structure/Content) — this had
// its own independent "Structure" before "Style" — while investigating an unrelated
// report; keeping both reads off this one array is what actually prevents that drift
// recurring, not just correcting the order once.
const SECTION_TITLES = ["Detection", "Geometry", "Style", "Structure", "Content"] as const;

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

// One-line human-readable summary per correction record — plan §4.3's mockup
// ("10:22  Button class changed"). `bbox_changed` deliberately omits the raw
// numbers (four decimals each side is noise in a one-line list); the Geometry
// section already shows the live values for anyone who wants precision.
function describeCorrection(record: CorrectionRecord): string {
  switch (record.type) {
    case "created":
      return `Created as ${record.newClassName ?? "?"}`;
    case "deleted":
      return `Deleted (was ${record.oldClassName ?? "?"})`;
    case "class_changed":
      return `Class changed: ${record.oldClassName ?? "?"} → ${record.newClassName ?? "?"}`;
    case "bbox_changed":
      return "Geometry updated";
    case "parent_changed": {
      const to =
        record.newParentDetectionId === null
          ? "root"
          : record.newParentDetectionId
            ? `${record.newParentDetectionId.slice(0, 8)}…`
            : "auto";
      return `Parent changed to ${to}`;
    }
    case "order_changed":
      return `Display order set to ${record.newDisplayOrder ?? "auto"}`;
    case "ignored":
      return "Ignored";
    default:
      return record.type;
  }
}

function formatCorrectionTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mx-md mb-xs rounded-sm border border-error/30 bg-error-subtle px-sm py-xs text-xs text-error">
      {message}
    </div>
  );
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
  onChangeClass,
  history,
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
  const [classDraft, setClassDraft] = useState<string>(selected?.className ?? "");
  const [styleError, setStyleError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [geometryError, setGeometryError] = useState<string | null>(null);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);

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

  useEffect(() => {
    setClassDraft(selected?.className ?? "");
    setDetectionError(null);
  }, [selected?.id, selected?.className]);

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

  async function handleApplyClass() {
    if (!selected) return;
    if (classDraft === selected.className) return;
    setDetectionError(null);
    try {
      await onChangeClass(selected.id, classDraft);
    } catch (err) {
      setDetectionError((err as Error).message);
    }
  }

  async function handleRevertToModelClass() {
    if (!selected?.originalClassName) return;
    setDetectionError(null);
    try {
      await onChangeClass(selected.id, selected.originalClassName);
    } catch (err) {
      setDetectionError((err as Error).message);
    }
  }

  const classDirty = !!selected && classDraft !== selected.className;

  if (!selected) {
    return (
      <div className="flex h-full flex-col">
        <h2 className="border-b border-border px-md py-sm text-2xs font-medium uppercase tracking-wide text-text-muted">
          Inspector
        </h2>
        <EmptyState title="Select a component" description="to inspect and edit" />
        <div className="mt-auto flex flex-wrap justify-center gap-sm border-t border-border px-md py-sm">
          {SECTION_TITLES.map((section) => (
            <span key={section} className="text-2xs uppercase tracking-wide text-text-muted">
              {section}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <h2 className="border-b border-border px-md py-sm text-2xs font-medium uppercase tracking-wide text-text-muted">
        Inspector
      </h2>

      <div className="flex flex-1 flex-col overflow-auto">
        {/* -------- Detection section (§17.3 Detection) -------- */}
        <AccordionSection title="Detection" defaultOpen dot={classDirty ? "dirty" : null}>
          <div className="grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-2 px-md pb-sm">
            <Field label="class" htmlFor="detection-class" layout="inline-80">
              <Select
                id="detection-class"
                value={classDraft}
                onChange={(e) => setClassDraft(e.target.value)}
                disabled={busy}
              >
                {ALL_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Confidence is READ-ONLY by design (§17.3): a user can correct the class,
              never falsify the model's own score. Manual boxes are 1.0 by definition.
              Rendered as a real bar, not just a number — this is the one piece of the
              Inspector that's literally a measurement, so it gets the one data-viz
              treatment in an otherwise plain-text panel. The fill color matches the
              same detection-model/primary distinction the canvas itself already draws
              (model-sourced vs. manual), and the exact percentage stays in text right
              beside it — the bar reinforces, it doesn't replace, the number. */}
          <div className="px-md pb-sm text-xs text-text-muted">
            <div className="flex items-center gap-sm">
              <span className="shrink-0">Model confidence</span>
              <span
                className="h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-pill bg-surface-sunken"
                aria-hidden="true"
              >
                <span
                  className={cn(
                    "block h-full rounded-pill transition-[width] duration-normal",
                    selected.source === "model" ? "bg-detection-model" : "bg-primary"
                  )}
                  style={{ width: `${Math.round(selected.confidence * 100)}%` }}
                />
              </span>
              <span className="shrink-0 font-mono font-medium text-text-secondary">
                {Math.round(selected.confidence * 100)}%
              </span>
            </div>
            <div className="mt-xs">
              Source: <span className="font-medium text-text-secondary">{selected.source}</span>
              {selected.modelVersionId && (
                <>
                  {" · "}
                  <span className="font-mono">{selected.modelVersionId}</span>
                </>
              )}
            </div>
            {selected.originalClassName && (
              <div>
                Model originally proposed:{" "}
                <span className="font-mono">{selected.originalClassName}</span>
              </div>
            )}
          </div>

          {detectionError && <ErrorBanner message={detectionError} />}

          <InspectorSectionFooter
            label={busy ? "Working…" : classDirty ? "Unapplied" : "Saved"}
            tone={busy ? "muted" : classDirty ? "warning" : "success"}
            actions={
              <>
                {selected.originalClassName && (
                  <Tooltip content={`Revert to what the model originally proposed: ${selected.originalClassName}`}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRevertToModelClass}
                      disabled={busy}
                      title={`Revert to what the model originally proposed: ${selected.originalClassName}`}
                    >
                      Revert to model
                    </Button>
                  </Tooltip>
                )}
                <Tooltip content="Save this class and regenerate the code">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApplyClass}
                    disabled={busy || !classDirty}
                    aria-label="Apply Detection changes"
                    title="Save this class and regenerate the code"
                  >
                    Apply
                  </Button>
                </Tooltip>
              </>
            }
          />
        </AccordionSection>

        {/* -------- Geometry section (§17.3 Geometry) -------- */}
        <AccordionSection
          title="Geometry"
          dot={geometryDirty ? "dirty" : hasGeometryOverride ? "applied" : null}
        >
          <div className="px-md pb-2xs text-2xs text-text-muted">
            Normalized [0..1] relative to the sketch. Leave a field blank to inherit the
            detection's stored value.
          </div>

          <GeometrySpatialEditor
            bbox={selected.bbox}
            draft={geometryDraft}
            onDraftChange={setGeometryDraft}
            disabled={busy}
          />

          <div className="grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-2 px-md pb-sm">
            <Field label="x" htmlFor="geo-x" layout="inline-80">
              <Input
                id="geo-x"
                type="number"
                step="0.001"
                min={0}
                max={1}
                value={geometryDraft.x}
                placeholder={selected.bbox.x.toFixed(4)}
                onChange={(e) => setGeometryDraft({ ...geometryDraft, x: e.target.value })}
                disabled={busy}
                mono
              />
            </Field>

            <Field label="y" htmlFor="geo-y" layout="inline-80">
              <Input
                id="geo-y"
                type="number"
                step="0.001"
                min={0}
                max={1}
                value={geometryDraft.y}
                placeholder={selected.bbox.y.toFixed(4)}
                onChange={(e) => setGeometryDraft({ ...geometryDraft, y: e.target.value })}
                disabled={busy}
                mono
              />
            </Field>

            <Field label="width" htmlFor="geo-width" layout="inline-80">
              <Input
                id="geo-width"
                type="number"
                step="0.001"
                min={0}
                max={1}
                value={geometryDraft.width}
                placeholder={selected.bbox.width.toFixed(4)}
                onChange={(e) => setGeometryDraft({ ...geometryDraft, width: e.target.value })}
                disabled={busy}
                mono
              />
            </Field>

            <Field label="height" htmlFor="geo-height" layout="inline-80">
              <Input
                id="geo-height"
                type="number"
                step="0.001"
                min={0}
                max={1}
                value={geometryDraft.height}
                placeholder={selected.bbox.height.toFixed(4)}
                onChange={(e) => setGeometryDraft({ ...geometryDraft, height: e.target.value })}
                disabled={busy}
                mono
              />
            </Field>
          </div>

          {geometryError && <ErrorBanner message={geometryError} />}

          <InspectorSectionFooter
            label={
              busy
                ? "Working…"
                : geometryDirty
                  ? "Unapplied"
                  : hasGeometryOverride
                    ? "Applied"
                    : "No geometry override"
            }
            tone={busy ? "muted" : geometryDirty ? "warning" : hasGeometryOverride ? "success" : "muted"}
            actions={
              <>
                <Tooltip content="Clear this component's geometry override and revert to the raw detection bbox">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleResetGeometry}
                    disabled={busy || !hasGeometryOverride}
                    aria-label="Reset Geometry override"
                    title="Clear this component's geometry override and revert to the raw detection bbox"
                  >
                    Reset
                  </Button>
                </Tooltip>
                <Tooltip content="Save this position/size and regenerate the code">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApplyGeometry}
                    disabled={busy || !geometryDirty}
                    aria-label="Apply Geometry changes"
                    title="Save this position/size and regenerate the code"
                  >
                    Apply
                  </Button>
                </Tooltip>
              </>
            }
          />
        </AccordionSection>

        {/* -------- Style section -------- */}
        <AccordionSection
          title="Style"
          dot={styleDirty ? "dirty" : hasStyleOverride ? "applied" : null}
        >
          <div className="grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-2 px-md pb-sm">
            <Field label="display" htmlFor="style-display" layout="inline-80">
              <Select
                id="style-display"
                value={styleDraft.display}
                onChange={(e) => setStyleDraft({ ...styleDraft, display: e.target.value })}
                disabled={busy}
              >
                {DISPLAY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>

            <Field label="gap" htmlFor="style-gap" layout="inline-80">
              <Input
                id="style-gap"
                value={styleDraft.gap}
                placeholder="e.g. 12px"
                onChange={(e) => setStyleDraft({ ...styleDraft, gap: e.target.value })}
                disabled={busy}
                mono
              />
            </Field>

            <Field label="padding" htmlFor="style-padding" layout="inline-80">
              <Input
                id="style-padding"
                value={styleDraft.padding}
                placeholder="e.g. 16px or 8px 12px"
                onChange={(e) => setStyleDraft({ ...styleDraft, padding: e.target.value })}
                disabled={busy}
                mono
              />
            </Field>

            <Field label="margin" htmlFor="style-margin" layout="inline-80">
              <Input
                id="style-margin"
                value={styleDraft.margin}
                placeholder="e.g. 0 0 16px 0"
                onChange={(e) => setStyleDraft({ ...styleDraft, margin: e.target.value })}
                disabled={busy}
                mono
              />
            </Field>

            <Field label="font-size" htmlFor="style-font-size" layout="inline-80">
              <Input
                id="style-font-size"
                value={styleDraft["font-size"]}
                placeholder="e.g. 16px"
                onChange={(e) => setStyleDraft({ ...styleDraft, "font-size": e.target.value })}
                disabled={busy}
                mono
              />
            </Field>

            <Field label="alignment" htmlFor="style-text-align" layout="inline-80">
              <Select
                id="style-text-align"
                value={styleDraft["text-align"]}
                onChange={(e) => setStyleDraft({ ...styleDraft, "text-align": e.target.value })}
                disabled={busy}
              >
                {ALIGN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          {styleError && <ErrorBanner message={styleError} />}

          <InspectorSectionFooter
            label={
              busy
                ? "Working…"
                : styleDirty
                  ? "Unapplied"
                  : hasStyleOverride
                    ? "Applied"
                    : "No style overrides"
            }
            tone={busy ? "muted" : styleDirty ? "warning" : hasStyleOverride ? "success" : "muted"}
            actions={
              <>
                <Tooltip content="Clear this component's style overrides and revert to the auto-inferred layout">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleResetStyle}
                    disabled={busy || !hasStyleOverride}
                    aria-label="Reset Style override"
                    title="Clear this component's style overrides and revert to the auto-inferred layout"
                  >
                    Reset
                  </Button>
                </Tooltip>
                <Tooltip content="Save these style tweaks and regenerate the code">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApplyStyle}
                    disabled={busy || !styleDirty}
                    aria-label="Apply Style changes"
                    title="Save these style tweaks and regenerate the code"
                  >
                    Apply
                  </Button>
                </Tooltip>
              </>
            }
          />
        </AccordionSection>

        {/* -------- Structure section (§17.3 Structure) -------- */}
        <AccordionSection
          title="Structure"
          dot={structureDirty ? "dirty" : hasStructureOverride ? "applied" : null}
        >
          <div className="px-md pb-2xs text-2xs text-text-muted">
            Reparent this node or pin its position among its siblings. Leave a field
            blank to keep auto-inferred behaviour.
          </div>

          <div className="grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-2 px-md pb-sm">
            <Field label="parent" htmlFor="structure-parent" layout="inline-80">
              <Select
                id="structure-parent"
                value={structureDraft.parent}
                onChange={(e) =>
                  setStructureDraft({ ...structureDraft, parent: e.target.value })
                }
                disabled={busy}
              >
                <option value="">Auto (from containment)</option>
                <option value={STRUCTURE_ROOT_SENTINEL}>Root (page)</option>
                {parentCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.className} · {candidate.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="order" htmlFor="structure-order" layout="inline-80">
              <Input
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
                mono
              />
            </Field>
          </div>

          {structureError && <ErrorBanner message={structureError} />}

          <InspectorSectionFooter
            label={
              busy
                ? "Working…"
                : structureDirty
                  ? "Unapplied"
                  : hasStructureOverride
                    ? "Applied"
                    : "No structure override"
            }
            tone={busy ? "muted" : structureDirty ? "warning" : hasStructureOverride ? "success" : "muted"}
            actions={
              <>
                <Tooltip content="Clear parent/order overrides and let auto containment inference decide">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleResetStructure}
                    disabled={busy || !hasStructureOverride}
                    aria-label="Reset Structure override"
                    title="Clear parent/order overrides and let auto containment inference decide"
                  >
                    Reset
                  </Button>
                </Tooltip>
                <Tooltip content="Save this parent/order and regenerate the code">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApplyStructure}
                    disabled={busy || !structureDirty}
                    aria-label="Apply Structure changes"
                    title="Save this parent/order and regenerate the code"
                  >
                    Apply
                  </Button>
                </Tooltip>
              </>
            }
          />
        </AccordionSection>

        {/* -------- Content section (§17.3 Content, Appendix Q) -------- */}
        <AccordionSection
          title="Content"
          dot={contentDirty ? "dirty" : hasContentOverride ? "applied" : null}
        >
          {applicableFields.size === 0 ? (
            <div className="px-md pb-sm text-xs text-text-muted">
              Content editing does not apply to <span className="font-mono">{selected.className}</span>.
              This is a container class in the plan's content mapping (Appendix P).
            </div>
          ) : (
            <div className="grid grid-cols-[80px_1fr] items-start gap-x-2 gap-y-2 px-md pb-sm">
              {applicableFields.has("text") && (
                <Field label="text" htmlFor="content-text" layout="inline-80">
                  <Textarea
                    id="content-text"
                    value={contentDraft.text}
                    placeholder="Placeholder used if left blank"
                    onChange={(e) => setContentDraft({ ...contentDraft, text: e.target.value })}
                    disabled={busy}
                    rows={3}
                  />
                </Field>
              )}

              {applicableFields.has("altText") && (
                <Field label="alt text" htmlFor="content-alt" layout="inline-80">
                  <Input
                    id="content-alt"
                    value={contentDraft.altText}
                    placeholder="e.g. Portrait of the founder"
                    onChange={(e) =>
                      setContentDraft({ ...contentDraft, altText: e.target.value })
                    }
                    disabled={busy}
                  />
                </Field>
              )}

              {applicableFields.has("href") && (
                <Field label="link" htmlFor="content-href" layout="inline-80">
                  <Input
                    id="content-href"
                    value={contentDraft.href}
                    placeholder="/about or https://example.com"
                    onChange={(e) => setContentDraft({ ...contentDraft, href: e.target.value })}
                    disabled={busy}
                    mono
                  />
                </Field>
              )}
            </div>
          )}

          {contentError && <ErrorBanner message={contentError} />}

          {applicableFields.size > 0 && (
            <InspectorSectionFooter
              label={
                busy
                  ? "Working…"
                  : contentDirty
                    ? "Unapplied"
                    : hasContentOverride
                      ? `Applied · ${currentContent?.contentState}`
                      : "Unknown (placeholder)"
              }
              tone={busy ? "muted" : contentDirty ? "warning" : hasContentOverride ? "success" : "muted"}
              actions={
                <>
                  <Tooltip content="Clear this component's content override and revert to the placeholder">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleResetContent}
                      disabled={busy || !hasContentOverride}
                      aria-label="Reset Content override"
                      title="Clear this component's content override and revert to the placeholder"
                    >
                      Reset
                    </Button>
                  </Tooltip>
                  <Tooltip content="Save this content and regenerate the code">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleApplyContent}
                      disabled={busy || !contentDirty}
                      aria-label="Apply Content changes"
                      title="Save this content and regenerate the code"
                    >
                      Apply
                    </Button>
                  </Tooltip>
                </>
              }
            />
          )}
        </AccordionSection>

        {/* -------- History section (§4.3 — read-only correction audit trail) -------- */}
        <AccordionSection title="History" defaultOpen>
          {history.length === 0 ? (
            <div className="px-md pb-sm text-xs text-text-muted">No corrections recorded yet.</div>
          ) : (
            <ul className="space-y-xs px-md pb-sm text-xs text-text-secondary">
              {history.map((record) => (
                <li key={record.id} className="flex gap-sm">
                  <span className="shrink-0 font-mono text-text-muted">
                    {formatCorrectionTime(record.timestamp)}
                  </span>
                  <span>{describeCorrection(record)}</span>
                </li>
              ))}
            </ul>
          )}
        </AccordionSection>
      </div>
    </div>
  );
}
