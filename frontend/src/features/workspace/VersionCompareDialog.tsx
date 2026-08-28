import { useEffect, useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import type { CodeVersion } from "@sketch2ui/shared-types";
import { Dialog } from "../../components/Dialog.js";
import { Button } from "../../components/Button.js";
import { Select } from "../../components/Select.js";
import { Tab, Tabs } from "../../components/Tabs.js";
import { api } from "../../services/api.js";
import type { CodeVersionSummaryEntry } from "../../services/api.js";

// "Compare versions" — new capability (the reference design's dock control), reusing
// the already-installed @monaco-editor/react (CodePanel.tsx already depends on it) so
// no new dependency is introduced. A wide Dialog (the new `size="lg"` variant) rather
// than a bespoke overlay, since the only thing this needs beyond a normal dialog is room.

type DiffTab = "html" | "css";

interface VersionCompareDialogProps {
  open: boolean;
  onDismiss: () => void;
  projectId: string;
  pageId: string;
  versions: CodeVersionSummaryEntry[];
}

export function VersionCompareDialog({ open, onDismiss, projectId, pageId, versions }: VersionCompareDialogProps) {
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const [left, setLeft] = useState<CodeVersion | null>(null);
  const [right, setRight] = useState<CodeVersion | null>(null);
  const [tab, setTab] = useState<DiffTab>("html");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default selection on open: the two most recently created versions, so opening the
  // dialog usually shows the most useful diff with zero clicks. `sorted` is by
  // versionNumber, not array order — versionList's own order isn't documented as sorted.
  useEffect(() => {
    if (!open || versions.length < 2) return;
    const sorted = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
    setLeftId((prev) => prev ?? sorted[sorted.length - 2].id);
    setRightId((prev) => prev ?? sorted[sorted.length - 1].id);
  }, [open, versions]);

  useEffect(() => {
    if (!open || !leftId || !rightId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.getCodeVersion(projectId, pageId, leftId), api.getCodeVersion(projectId, pageId, rightId)])
      .then(([l, r]) => {
        if (cancelled) return;
        setLeft(l);
        setRight(r);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, leftId, rightId, projectId, pageId]);

  // Re-defaulting on every open (rather than remembering a stale pick) matches how the
  // rest of the workspace treats per-open state, e.g. the code editor's own draft reset.
  useEffect(() => {
    if (!open) {
      setLeftId(null);
      setRightId(null);
      setLeft(null);
      setRight(null);
      setError(null);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onDismiss={onDismiss}
      title="Compare versions"
      size="lg"
      actions={
        <Button variant="secondary" size="sm" onClick={onDismiss}>
          Close
        </Button>
      }
    >
      <div className="flex h-full flex-col gap-sm">
        <div className="flex flex-wrap items-center gap-sm">
          <div className="w-36">
            <Select aria-label="Compare from version" value={leftId ?? ""} onChange={(e) => setLeftId(e.target.value)}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} · {v.source}
                </option>
              ))}
            </Select>
          </div>
          <span aria-hidden="true" className="text-text-muted">
            →
          </span>
          <div className="w-36">
            <Select aria-label="Compare to version" value={rightId ?? ""} onChange={(e) => setRightId(e.target.value)}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} · {v.source}
                </option>
              ))}
            </Select>
          </div>
          <Tabs value={tab} onChange={(v) => setTab(v as DiffTab)} aria-label="Diff language" className="ml-auto">
            <Tab value="html">html</Tab>
            <Tab value="css">css</Tab>
          </Tabs>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-sm border border-border">
          {error ? (
            <p className="p-md text-sm text-error">Could not load these versions: {error}</p>
          ) : loading || !left || !right ? (
            <p className="p-md text-sm text-text-muted">Loading versions…</p>
          ) : (
            <DiffEditor
              key={tab}
              height="100%"
              language={tab}
              original={tab === "html" ? left.html : left.css}
              modified={tab === "html" ? right.html : right.css}
              theme="light"
              options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, wordWrap: "on" }}
            />
          )}
        </div>
      </div>
    </Dialog>
  );
}
