import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import type { CodeIssue } from "@sketch2ui/shared-types";
import { validateGeneratedCode } from "@sketch2ui/shared-types";
import { Button } from "../../components/Button.js";
import { Tab, Tabs } from "../../components/Tabs.js";
import { Tooltip } from "../../components/Tooltip.js";

// Phase 2H — Monaco flips from the hardcoded `vs-dark` theme to light (the one
// permanently-dark surface in an otherwise all-light app, per the Phase 1 audit's §17/§21
// finding), and the surrounding chrome moves onto tokens. The draft/dirty state machine and
// the validateGeneratedCode() gate below are byte-for-byte unchanged — this phase touches
// presentation only.

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

type CodeTab = "html" | "css";

export default function CodePanel({ html, css, onSave, saving, activeVersionLabel }: CodePanelProps) {
  const [tab, setTab] = useState<CodeTab>("html");
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
      <div className="flex items-center justify-between border-b border-border pr-sm">
        <Tabs value={tab} onChange={(v) => setTab(v as CodeTab)} aria-label="Code language">
          <Tab value="html">html</Tab>
          <Tab value="css">css</Tab>
        </Tabs>
        <div className="flex items-center gap-sm">
          {activeVersionLabel && !editing && (
            <span className="font-mono text-2xs uppercase tracking-wide text-text-muted">{activeVersionLabel}</span>
          )}
          {editing ? (
            <>
              {dirty && (
                <span className="text-2xs uppercase tracking-wide text-warning">Unsaved</span>
              )}
              <Button variant="secondary" size="sm" onClick={cancelEdit} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !dirty || !onSave}>
                {saving ? "Saving…" : "Save edit"}
              </Button>
            </>
          ) : (
            <Tooltip content={onSave ? "Edit the generated HTML/CSS by hand" : "Nothing to edit yet"}>
              <Button variant="secondary" size="sm" onClick={beginEdit} disabled={!onSave}>
                Edit code
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {(issues.length > 0 || serverError) && (
        <div className="border-b border-error/30 bg-error-subtle px-sm py-xs text-xs text-error">
          {serverError ? (
            <span>{serverError}</span>
          ) : (
            <ul className="space-y-2xs">
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
          theme="light"
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
