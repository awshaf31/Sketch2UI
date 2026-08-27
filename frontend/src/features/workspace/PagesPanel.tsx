import { useState } from "react";
import type { Page } from "@sketch2ui/shared-types";
import { Button } from "../../components/Button.js";
import { IconButton } from "../../components/IconButton.js";
import { Input } from "../../components/Input.js";
import { useDialog } from "../../components/DialogHost.js";
import { api } from "../../services/api.js";
import { cn } from "../../components/cn.js";

// the vertical Pages list that replaces the horizontal PagesStrip, now living inside the
// Navigator's "Pages" tab.
//
// This is a LAYOUT move, not a behavior change: every handler below (rename via
// click-to-edit, delete via the shared confirm dialog, add) is carried over verbatim
// from PagesStrip.tsx, including the "never delete the last page" guard and the
// "reselect the first remaining page if the current one was deleted" rule. The page
// rows stay <Button>s labelled with the page name so existing selectors keep working.

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path
        d="M11.3 2.3a1 1 0 0 1 1.4 0l1 1a1 1 0 0 1 0 1.4l-7.2 7.2-3 .8.8-3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path
        d="M2.5 4h11M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4M3.5 4l.6 8.4a1 1 0 0 0 1 .93h5.8a1 1 0 0 0 1-.93l.6-8.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M8 2.5v11M2.5 8h11" strokeLinecap="round" />
    </svg>
  );
}

function PageIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M4 2.5h4.5L12 6v7.5H4z" strokeLinejoin="round" />
      <path d="M8.5 2.5V6H12" strokeLinejoin="round" />
    </svg>
  );
}

interface PagesPanelProps {
  projectId: string;
  pages: Page[];
  currentPageId: string | null;
  onPagesChange: (pages: Page[]) => void;
  onSelectPage: (pageId: string) => void;
}

export function PagesPanel({ projectId, pages, currentPageId, onPagesChange, onSelectPage }: PagesPanelProps) {
  const { confirm } = useDialog();
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function startRename(page: Page) {
    setEditingPageId(page.id);
    setEditingValue(page.name);
  }

  async function commitRename(pageId: string) {
    const name = editingValue.trim();
    const original = pages.find((p) => p.id === pageId);
    setEditingPageId(null);
    if (!name || !original || name === original.name) return;
    try {
      const updated = await api.renamePage(projectId, pageId, name);
      onPagesChange(pages.map((p) => (p.id === pageId ? updated : p)));
    } catch {
      // Left as-is: the list still shows the previous name, matching what's persisted.
    }
  }

  async function handleDelete(page: Page) {
    if (pages.length <= 1 || deletingId) return;
    const ok = await confirm({
      title: `Delete "${page.name}"?`,
      body: "This removes the page and everything on it. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(page.id);
    try {
      await api.deletePage(projectId, page.id);
      const remaining = pages.filter((p) => p.id !== page.id);
      onPagesChange(remaining);
      if (currentPageId === page.id && remaining[0]) {
        onSelectPage(remaining[0].id);
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAddPage() {
    if (creating) return;
    setCreating(true);
    try {
      const page = await api.createPage(projectId);
      onPagesChange([...pages, page]);
      onSelectPage(page.id);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-xs">
        {pages.map((page) => {
          const selected = page.id === currentPageId;
          const isEditing = editingPageId === page.id;

          if (isEditing) {
            return (
              <div key={page.id} className="px-2xs py-2xs">
                <Input
                  autoFocus
                  size="sm"
                  aria-label={`Rename "${page.name}"`}
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => void commitRename(page.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void commitRename(page.id);
                    if (e.key === "Escape") setEditingPageId(null);
                  }}
                  className="h-7 w-full"
                />
              </div>
            );
          }

          return (
            <div
              key={page.id}
              className={cn(
                "group flex items-center gap-2xs rounded-sm pr-2xs transition-colors duration-fast",
                // §3.6 — selected carries a ground AND aria-current, never color alone.
                selected ? "bg-primary-subtle" : "hover:bg-surface-sunken"
              )}
            >
              <Button
                variant="ghost"
                size="sm"
                aria-current={selected ? "page" : undefined}
                onClick={() => onSelectPage(page.id)}
                className={cn(
                  "min-w-0 flex-1 justify-start gap-sm bg-transparent hover:bg-transparent",
                  selected ? "text-primary" : "text-text-secondary"
                )}
              >
                <span className={cn("shrink-0", selected ? "text-primary" : "text-text-muted")}>
                  <PageIcon />
                </span>
                <span className="truncate">{page.name}</span>
              </Button>
              <IconButton
                aria-label={`Rename "${page.name}"`}
                icon={<PencilIcon />}
                size="sm"
                onClick={() => startRename(page)}
                className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              />
              {pages.length > 1 && (
                <IconButton
                  aria-label={`Delete "${page.name}"`}
                  icon={<TrashIcon />}
                  size="sm"
                  disabled={deletingId === page.id}
                  onClick={() => void handleDelete(page)}
                  className="shrink-0 opacity-0 hover:text-error group-hover:opacity-100 focus-visible:opacity-100"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Pinned below the list so it stays reachable however many pages exist. */}
      <div className="border-t border-border p-xs">
        <Button
          variant="ghost"
          size="sm"
          loading={creating}
          onClick={() => void handleAddPage()}
          className="w-full justify-start gap-sm"
        >
          <PlusIcon /> Add page
        </Button>
      </div>
    </div>
  );
}
