import { useState } from "react";
import type { Page } from "@sketch2ui/shared-types";
import { Button } from "../../components/Button.js";
import { IconButton } from "../../components/IconButton.js";
import { Input } from "../../components/Input.js";
import { useDialog } from "../../components/DialogHost.js";
import { api } from "../../services/api.js";
import { cn } from "../../components/cn.js";

// docs/execution/d3-multipage-handoff.md — one pill per page, built from existing
// Button/IconButton/Input primitives rather than Tabs.tsx (no add/rename/delete
// affordance there).

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

interface PagesStripProps {
  projectId: string;
  pages: Page[];
  currentPageId: string | null;
  onPagesChange: (pages: Page[]) => void;
  onSelectPage: (pageId: string) => void;
}

export function PagesStrip({ projectId, pages, currentPageId, onPagesChange, onSelectPage }: PagesStripProps) {
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
      // Left as-is: the strip still shows the previous name, matching what's persisted.
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
    <div className="flex items-center gap-2xs border-b border-border bg-surface px-md py-2xs">
      {pages.map((page) => {
        const selected = page.id === currentPageId;
        const isEditing = editingPageId === page.id;
        return (
          <div
            key={page.id}
            className={cn(
              "group flex items-center gap-2xs rounded-sm",
              isEditing && "bg-surface-sunken pl-2xs"
            )}
          >
            {isEditing ? (
              <Input
                autoFocus
                size="sm"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={() => void commitRename(page.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitRename(page.id);
                  if (e.key === "Escape") setEditingPageId(null);
                }}
                className="h-7 w-32"
              />
            ) : (
              <Button
                variant={selected ? "primary" : "ghost"}
                size="sm"
                onClick={() => onSelectPage(page.id)}
              >
                {page.name}
              </Button>
            )}
            <IconButton
              aria-label={`Rename "${page.name}"`}
              icon={<PencilIcon />}
              size="sm"
              onClick={() => startRename(page)}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            />
            {pages.length > 1 && (
              <IconButton
                aria-label={`Delete "${page.name}"`}
                icon={<TrashIcon />}
                size="sm"
                disabled={deletingId === page.id}
                onClick={() => void handleDelete(page)}
                className="opacity-0 hover:text-error group-hover:opacity-100 focus-visible:opacity-100"
              />
            )}
          </div>
        );
      })}
      <Button variant="ghost" size="sm" loading={creating} onClick={() => void handleAddPage()}>
        <PlusIcon /> Add page
      </Button>
    </div>
  );
}
