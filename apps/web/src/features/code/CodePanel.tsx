import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import type { CodeIssue } from "@sketch2ui/shared-types";
import { validateGeneratedCode } from "@sketch2ui/shared-types";

interface CodePanelProps {
  /** The HTML the panel starts from — either live-regenerated or a stored version. */
  html: string;
  /** The CSS the panel starts from — same source as html. */
  css: string;
  /**
   * Called when the user clicks Save on their edits. Returns void on success; the panel
   * shows the parent's error message if this throws. The panel does not save on its own —
   * §6.9 "read-only initially, then add editable mode" plus §6.12's debounced-explicit
   * save principle: an edit only takes effect when the user asks for it.
   */
  onSave?: (input: { html: string; css: string }) => Promise<void>;
  /** Present when saving. Disables inputs so the same edit cannot be double-submitted. */
  saving?: boolean;
  /**
   * Labels which version this panel is currently reflecting, so the user can tell whether
   * they are editing a saved snapshot or the live regeneration. Left absent when there is
   * no persisted version to speak of yet.
   */
  activeVersionLabel?: string;
}

type Tab = "html" | "css";

export default function CodePanel({ html, css, onSave, saving, activeVersionLabel }: CodePanelProps) {
  const [tab, setTab] = useState<Tab>("html");
  const [editing, setEditing] = useState(false);
  const [draftHtml, setDraftHtml] = useState(html);
  const [draftCss, setDraftCss] = useState(css);
  const [issues, setIssues] = useState<CodeIssue[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  // Not-editing panels track incoming props verbatim so switching versions or updating
  // detections refreshes what the user sees. In edit mode the draft is authoritative —
  // typing into Monaco must not be silently overwritten by a background re-render.
  useEffect(() => {
    if (!editing) {
      setDraftHtml(html);
      setDraftCss(css);
    }
  }, [html, css, editing]);

  const dirty = editing && (draftHtml !== html || draftCss !== css);

  function beginEdit() {
    setDraftHtml(html);
    setDraftCss(css);
    setIssues([]);
    setServerError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraftHtml(html);
    setDraftCss(css);
    setIssues([]);
    setServerError(null);
  }

  async function handleSave() {
    if (!onSave) return;
    // Same validator the §21.4 evaluation harness and the API use; running it in the
    // browser catches unclosed tags and stray braces before a round trip and before the
    // save button ever gets the chance to fail server-side.
    const validation = validateGeneratedCode(draftHtml, draftCss);
    if (!validation.ok) {
      setIssues(validation.issues);
      setServerError(null);
      return;
    }
    setIssues([]);
    setServerError(null);
    try {
      await onSave({ html: draftHtml, css: draftCss });
      setEditing(false);
    } catch (err) {
      setServerError((err as Error).message);
    }
  }

  const value = tab === "html" ? draftHtml : draftCss;
  const setValue = tab === "html" ? setDraftHtml : setDraftCss;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 pr-2">
        <div className="flex">
          {(["html", "css"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium uppercase tracking-wide ${
                tab === t ? "border-b-2 border-orange-500 text-gray-900" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {activeVersionLabel && !editing && (
            <span className="text-[10px] uppercase tracking-wide text-gray-400">{activeVersionLabel}</span>
          )}
          {editing ? (
            <>
              {dirty && (
                <span className="text-[10px] uppercase tracking-wide text-amber-600">Unsaved</span>
              )}
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !dirty || !onSave}
                className="rounded bg-gray-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save edit"}
              </button>
            </>
          ) : (
            <button
              onClick={beginEdit}
              disabled={!onSave}
              title={onSave ? "Edit the generated HTML/CSS by hand" : "Nothing to edit yet"}
              className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Edit code
            </button>
          )}
        </div>
      </div>

      {(issues.length > 0 || serverError) && (
        <div className="border-b border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800">
          {serverError ? (
            <span>{serverError}</span>
          ) : (
            <ul className="space-y-0.5">
              {issues.map((iss, i) => (
                <li key={`${iss.code}-${i}`}>
                  <span className="font-medium">{iss.code}:</span> {iss.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex-1">
        <Editor
          key={tab}
          height="100%"
          language={tab}
          value={value}
          onChange={(next) => editing && setValue(next ?? "")}
          theme="vs-dark"
          options={{
            readOnly: !editing || saving,
            minimap: { enabled: false },
            fontSize: 12,
            wordWrap: "on",
          }}
        />
      </div>
    </div>
  );
}
