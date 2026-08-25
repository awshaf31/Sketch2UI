import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Project } from "@sketch2ui/shared-types";
import { api } from "../services/api.js";
import { AppHeader } from "../components/AppHeader.js";
import { BrandMark } from "../components/BrandMark.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { IconButton } from "../components/IconButton.js";
import { Input } from "../components/Input.js";
import { cn } from "../components/cn.js";
import { useDialog } from "../components/DialogHost.js";
import { useToast } from "../components/ToastStack.js";

// docs/frontend/dashboard-design.md — full implementation (Phase 2C). Preserves
// exactly the three behaviors the current app already has (list/create/delete) — no
// new functionality. AppHeader gets its first real mount here (deferred in Phase 2B —
// see docs/frontend/frontend-implementation-roadmap.md's Phase 2B result for why).
// The page's own H1 is "Projects" rather than a second "Sketch2UI" label directly
// under AppHeader's wordmark — avoids the literal duplicate brand string while keeping
// both the persistent brand bar and a page-level heading that names this page's actual
// content (design-direction.md's "words are design material" principle).

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
    <svg viewBox="0 0 16 16" width="14" height="14" className="animate-spin motion-reduce:animate-none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const GRID_CLASSES = "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-lg";

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const { showToast } = useToast();

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const project = await api.createProject({ name: name.trim() });
      navigate(`/projects/${project.id}`);
    } catch (e) {
      setCreateError((e as Error).message);
      setCreating(false);
    }
  }

  async function handleDelete(id: string, projectName: string) {
    if (deletingId) return;
    // Same guarantee as the window.confirm() this replaces — see
    // docs/frontend/dashboard-design.md's "Delete confirmation" section: identical
    // title/body copy, just rendered through the system Dialog instead of a native one.
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
    <div className="min-h-full bg-bg">
      <AppHeader />

      <div className="mx-auto max-w-[640px] px-lg pb-3xl pt-3xl">
        <h1 className="text-2xl font-semibold text-text-primary">Projects</h1>
        <p className="mt-xs text-md text-text-secondary">
          Turn a hand-drawn wireframe into HTML/CSS with a live preview.
        </p>

        <form onSubmit={handleCreate} className="mt-xl flex items-center gap-sm">
          <Input
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
        </form>

        {createError && <p className="mt-md text-sm text-error">{createError}</p>}

        <div className="mt-xl">
          {loading ? (
            <div className={GRID_CLASSES} aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[92px] rounded-lg border border-border bg-surface-sunken" />
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
          ) : (
            <div className={GRID_CLASSES}>
              {projects.map((p) => {
                const isDeleting = deletingId === p.id;
                return (
                  <Card
                    key={p.id}
                    interactive
                    className={cn("group relative", isDeleting && "pointer-events-none opacity-50")}
                  >
                    <button
                      onClick={() => navigate(`/projects/${p.id}`)}
                      disabled={isDeleting}
                      className="block w-full truncate pr-lg text-left text-md font-medium text-text-primary"
                    >
                      {p.name}
                    </button>
                    <p className="mt-2xs text-xs text-text-muted">{p.status}</p>
                    <IconButton
                      aria-label={`Delete "${p.name}"`}
                      icon={isDeleting ? <SpinnerIcon /> : <TrashIcon />}
                      size="sm"
                      disabled={isDeleting}
                      onClick={() => handleDelete(p.id, p.name)}
                      className={cn(
                        "absolute right-sm top-sm text-text-muted opacity-0 transition-opacity duration-fast",
                        "hover:text-error focus-visible:opacity-100 group-hover:opacity-100",
                        isDeleting && "opacity-100"
                      )}
                    />
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
