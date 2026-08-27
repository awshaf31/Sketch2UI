import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { Project, ProjectStatus } from "@sketch2ui/shared-types";
import { api } from "../services/api.js";
import { AppShell, PageHeader } from "../components/AppShell.js";
import { Badge } from "../components/Badge.js";
import type { BadgeTone } from "../components/Badge.js";
import { BrandMark } from "../components/BrandMark.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { EmptyState } from "../components/EmptyState.js";
import { Eyebrow } from "../components/Eyebrow.js";
import { ErrorState } from "../components/ErrorState.js";
import { IconButton } from "../components/IconButton.js";
import { Input } from "../components/Input.js";
import { ProjectThumbnail } from "../components/ProjectThumbnail.js";
import { cn } from "../components/cn.js";
import { useDialog } from "../components/DialogHost.js";
import { useToast } from "../components/ToastStack.js";
import UploadDropzone from "../features/upload/UploadDropzone.js";

// Phase 2C base implementation. Extended per a direct product request (not a new frontend
// spec doc) to make "start with your sketch" the Dashboard's primary workflow: a project
// name AND a sketch image can now be supplied together in one hero form, instead of
// requiring a trip into the (empty) project workspace just to upload. No API contract
// changed to build this — a project already gets a default page on creation
// (backend/.../projects.routes.ts), and api.uploadAsset(projectId, pageId, file) already
// exists; this just calls both in sequence before navigating. AppHeader/H1
// ("Projects")/create-form selectors/delete dialog copy are all unchanged from the base
// implementation — those exact strings matter to e2e/golden-path.spec.ts and friends.

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path
        d="M2.5 4h11M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4M3.5 4l.6 8.4a1 1 0 0 0 1 .93h5.8a1 1 0 0 0 1-.93l.6-8.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" className="animate-spin motion-reduce:animate-none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M14 14l-3-3" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path
        d="M11.3 2.3a1 1 0 0 1 1.4 0l1 1a1 1 0 0 1 0 1.4l-7.2 7.2-3 .8.8-3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// A small mono label chip over each thumbnail's corner — the same "detection label"
// idiom the marketing redesign introduced for the hero's annotation graphic (a tagged
// pill sitting on the artifact it describes, not decoration next to it). Carries real
// data (page count), so it replaces rather than duplicates the plain-text page count
// that used to sit in the meta line below.
function ThumbnailTag({ children }: { children: ReactNode }) {
  return (
    <span className="absolute left-sm top-sm rounded-sm border border-border bg-surface/95 px-1.5 py-[1px] font-mono text-[10px] uppercase leading-[1.6] tracking-wide text-text-secondary shadow-subtle">
      {children}
    </span>
  );
}

const GRID_CLASSES = "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-lg";

// Blueprint Mockup 2 — "success/neutral tones" only; status is real data, this just
// gives it a Badge instead of a plain text string.
const STATUS_BADGE_TONE: Record<ProjectStatus, BadgeTone> = {
  draft: "neutral",
  annotated: "neutral",
  generated: "success",
  archived: "neutral",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Object-URL lifecycle for the client-side-only sketch preview shown before a
 * project exists to upload it to — created/revoked as the staged file changes, and
 * revoked again on unmount. Never sent anywhere; it's just a local thumbnail. */
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function StagedSketchPreview({
  file,
  previewUrl,
  onRemove,
}: {
  file: File;
  previewUrl: string | null;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-md rounded-lg border border-border bg-surface-sunken p-md">
      {previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          className="h-16 w-16 flex-shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <div className="h-16 w-16 flex-shrink-0 rounded-md border border-border bg-surface" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">{file.name}</p>
        <p className="text-xs text-text-muted">{(file.size / (1024 * 1024)).toFixed(1)}MB</p>
      </div>
      <IconButton
        aria-label="Remove selected sketch"
        icon={<TrashIcon />}
        size="sm"
        onClick={onRemove}
        className="hover:text-error"
      />
    </div>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  // Populated by each card's ProjectThumbnail as it looks up the project's first
  // page — a byproduct of that lookup, not a separate fetch (see ProjectThumbnail.tsx).
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const { showToast } = useToast();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const stagedPreviewUrl = useObjectUrl(stagedFile);

  function load() {
    setLoading(true);
    setListError(null);
    api
      .listProjects()
      .then(setProjects)
      .catch((e) => setListError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
  }, [projects, search]);

  function focusCreateForm() {
    nameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    nameInputRef.current?.focus();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    let project: Project;
    try {
      project = await api.createProject({ name: name.trim() });
    } catch (e) {
      setCreateError((e as Error).message);
      setCreating(false);
      return;
    }
    // A new project always has a default "Page 1" (backend/.../projects.routes.ts),
    // so a staged sketch can go straight to it. Best-effort: if this fails, the
    // project itself already exists and was created successfully, so we still open
    // it rather than stranding the user on the Dashboard — the workspace has its own
    // upload dropzone as a fallback path.
    if (stagedFile) {
      try {
        const pages = await api.listPages(project.id);
        const pageId = pages[0]?.id;
        if (pageId) await api.uploadAsset(project.id, pageId, stagedFile);
      } catch (e) {
        showToast(
          "error",
          `Project created, but the sketch upload failed: ${(e as Error).message}. You can upload it from the project.`
        );
      }
    }
    navigate(`/app/projects/${project.id}`);
  }

  // SaaS phase S5 — Phase 4 of the brief ("rename if supported"). Same click-to-edit
  // pattern as PagesStrip.tsx's page rename, applied to the project card's own title.
  function startRename(p: Project) {
    setEditingId(p.id);
    setEditingValue(p.name);
  }

  async function commitRename(p: Project) {
    const nextName = editingValue.trim();
    setEditingId(null);
    if (!nextName || nextName === p.name) return;
    try {
      const updated = await api.renameProject(p.id, nextName);
      setProjects((prev) => prev.map((existing) => (existing.id === p.id ? updated : existing)));
    } catch (e) {
      showToast("error", (e as Error).message);
    }
  }

  async function handleDelete(id: string, projectName: string) {
    if (deletingId) return;
    // Same guarantee as the window.confirm() this replaces: identical title/body copy, just
    // rendered through the system Dialog instead of a native one.
    const confirmed = await confirm({
      title: "Delete project?",
      body: `Delete "${projectName}"? This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    setDeletingId(id);
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      showToast("success", `"${projectName}" deleted.`);
    } catch (e) {
      showToast("error", (e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    // the persistent rail replaces AppHeader's top nav. The column widens 720 -> 880px
    // because the rail now takes the left edge, so the project grid keeps the same usable
    // measure it had before.
    <AppShell>
      <PageHeader
        title="Projects"
        description="Turn a hand-drawn wireframe into HTML/CSS with a live preview."
      />

        <div className="mt-xl flex flex-wrap items-center gap-sm">
          <div className="relative flex-1 min-w-[200px]">
            <span className="pointer-events-none absolute inset-y-0 left-sm flex items-center text-text-muted">
              <SearchIcon />
            </span>
            <Input
              size="md"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              aria-label="Search projects"
              className="pl-[30px] text-md"
            />
          </div>
          <Button type="button" variant="primary" size="lg" onClick={focusCreateForm}>
            New Project
          </Button>
        </div>

        <Card className="mt-xl p-xl">
          <Eyebrow>New project</Eyebrow>
          <h2 className="mt-xs text-lg font-semibold text-text-primary">Start from a sketch, or a blank page</h2>
          <p className="mt-2xs text-sm text-text-secondary">
            Upload a hand-drawn wireframe now, or skip it and add one from inside the project later.
          </p>

          <div className="mt-lg lg:grid lg:grid-cols-[320px_1fr] lg:gap-xl">
            <div>
              {stagedFile ? (
                <StagedSketchPreview file={stagedFile} previewUrl={stagedPreviewUrl} onRemove={() => setStagedFile(null)} />
              ) : (
                <UploadDropzone onFile={setStagedFile} />
              )}
            </div>

            <form onSubmit={handleCreate} className="mt-lg flex flex-col justify-center lg:mt-0">
              <label htmlFor="dashboard-project-name" className="block text-xs font-medium text-text-secondary">
                Project name
              </label>
              <div className="mt-xs flex items-center gap-sm">
                <Input
                  id="dashboard-project-name"
                  ref={nameInputRef}
                  size="md"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="New project name"
                  disabled={creating}
                  className="flex-1 text-md"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={!name.trim()}
                  loading={creating}
                  loadingLabel="Creating…"
                >
                  Create project
                </Button>
              </div>
              {createError && <p className="mt-sm text-sm text-error">{createError}</p>}
            </form>
          </div>
        </Card>

        <div className="mt-2xl">
          <div className="flex items-baseline gap-sm">
            <h2 className="text-lg font-semibold text-text-primary">Recent projects</h2>
            {!loading && !listError && projects.length > 0 && (
              <span className="font-mono text-2xs text-text-muted">{filteredProjects.length}</span>
            )}
          </div>

          <div className="mt-lg">
            {loading ? (
              <div className={GRID_CLASSES} aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[268px] rounded-lg border border-border bg-surface-sunken" />
                ))}
              </div>
            ) : listError ? (
              <ErrorState
                message={listError}
                action={
                  <Button variant="secondary" onClick={load}>
                    Retry
                  </Button>
                }
              />
            ) : projects.length === 0 ? (
              <EmptyState
                icon={<BrandMark className="h-10 w-10" />}
                title="No projects yet"
                description="Create one above to get started."
              />
            ) : filteredProjects.length === 0 ? (
              <EmptyState
                title="No matching projects"
                description={`No projects match "${search.trim()}".`}
                action={
                  <Button variant="secondary" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <div className={GRID_CLASSES}>
                {filteredProjects.map((p) => {
                  const isDeleting = deletingId === p.id;
                  const isEditing = editingId === p.id;
                  return (
                    <Card
                      key={p.id}
                      interactive
                      className={cn("group", isDeleting && "pointer-events-none opacity-50")}
                    >
                      <div className="relative -m-lg mb-lg h-[148px] overflow-hidden rounded-t-lg">
                        <ProjectThumbnail
                          projectId={p.id}
                          projectName={p.name}
                          onPageCount={(count) => setPageCounts((prev) => ({ ...prev, [p.id]: count }))}
                        />
                        {pageCounts[p.id] !== undefined && pageCounts[p.id] > 0 && (
                          <ThumbnailTag>
                            {pageCounts[p.id]} {pageCounts[p.id] === 1 ? "page" : "pages"}
                          </ThumbnailTag>
                        )}
                        <div
                          className={cn(
                            "absolute right-sm top-sm flex items-center gap-2xs opacity-0 transition-opacity duration-fast",
                            "focus-within:opacity-100 group-hover:opacity-100",
                            (isDeleting || isEditing) && "opacity-100"
                          )}
                        >
                          {!isEditing && (
                            <IconButton
                              aria-label={`Rename "${p.name}"`}
                              icon={<PencilIcon />}
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => startRename(p)}
                              className="border border-border bg-surface text-text-muted"
                            />
                          )}
                          {!isEditing && (
                            <IconButton
                              aria-label={`Delete "${p.name}"`}
                              icon={isDeleting ? <SpinnerIcon /> : <TrashIcon />}
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => handleDelete(p.id, p.name)}
                              className="border border-border bg-surface text-text-muted hover:text-error"
                            />
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <Input
                          autoFocus
                          size="sm"
                          aria-label={`Rename "${p.name}"`}
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => void commitRename(p)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void commitRename(p);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => navigate(`/app/projects/${p.id}`)}
                          disabled={isDeleting}
                          className="block w-full truncate text-left text-md font-medium text-text-primary"
                        >
                          {p.name}
                        </button>
                      )}
                      <div className="mt-2xs flex items-center gap-sm">
                        <Badge tone={STATUS_BADGE_TONE[p.status]}>{p.status}</Badge>
                        <p className="truncate font-mono text-2xs text-text-muted">Created {formatDate(p.createdAt)}</p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
    </AppShell>
  );
}
