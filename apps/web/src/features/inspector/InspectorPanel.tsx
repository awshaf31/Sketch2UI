import { useEffect, useMemo, useState } from "react";
import type { ContentOverride, Detection } from "@sketch2ui/shared-types";
import { contentFieldsFor } from "@sketch2ui/shared-types";

// Style + Content inspector — plan §6.7 / §17.3. Field set matches the plan's
// grouping exactly: Style is display/gap/padding/margin/font-size/alignment (§17.3);
// Content is text/altText/href (§17.3 Content group, Appendix Q). Debounce-then-apply
// (§6.12): drafts live locally in this panel and are pushed to the API only when the
// user hits Apply, so a slider drag never triggers a codegen round-trip.

export type StyleOverride = Record<string, string>;

export interface ContentDraft {
  text?: string;
  altText?: string;
  href?: string;
}

interface InspectorPanelProps {
  /**
   * The currently-selected detection. Both sections are disabled without one — an
   * override needs a node to attach to, so Apply has nothing to save.
   */
  selected: Detection | null;
  /** Current persisted style override for the selected detection (empty if none). */
  currentStyle: StyleOverride;
  /** Current persisted content override for the selected detection (null if none). */
  currentContent: ContentOverride | null;
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
  /** Whether an Apply/Reset (style or content) is currently in flight. */
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

export default function InspectorPanel({
  selected,
  currentStyle,
  currentContent,
  onApplyStyle,
  onResetStyle,
  onApplyContent,
  onResetContent,
  busy,
}: InspectorPanelProps) {
  const [styleDraft, setStyleDraft] = useState<Record<StyleFieldKey, string>>(() =>
    toStyleDraft(currentStyle)
  );
  const [contentDraft, setContentDraft] = useState<Required<ContentDraft>>(() =>
    toContentDraft(currentContent)
  );
  const [styleError, setStyleError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);

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

  const styleDirty = !styleDraftsEqual(styleDraft, toStyleDraft(currentStyle));
  const contentDirty = !contentDraftsEqual(
    contentDraft,
    toContentDraft(currentContent),
    applicableFields
  );
  const hasStyleOverride = Object.keys(currentStyle).length > 0;
  const hasContentOverride =
    !!currentContent &&
    (!!currentContent.text || !!currentContent.altText || !!currentContent.href);

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

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        Inspector
      </div>

      {!selected ? (
        <div className="px-3 py-4 text-xs text-gray-500">
          Select a component on the canvas or in the tree to edit its style and content.
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
