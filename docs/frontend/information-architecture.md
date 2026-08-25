---
title: "Sketch2UI — Application Information Architecture"
deliverable: "Phase 2, Deliverable 3"
---

# Information Architecture

## Route table

Sketch2UI has exactly two routes today (`apps/web/src/App.tsx`), and this
specification keeps it at exactly two. No settings, account, or auth route is added —
per `PROJECT_STATUS.md` §4.2, auth and per-user scoping are explicitly out of scope for
this product's current stage, and inventing a settings screen with nothing real to put
in it would violate the "do not invent features that don't exist" constraint.

| # | Route | Component | Status |
|---|---|---|---|
| 1 | `/` | Dashboard | Exists — redesigned in [dashboard-design.md](dashboard-design.md) |
| 2 | `/projects/:id` | Project Workspace | Exists — redesigned in [workspace-design.md](workspace-design.md) |

## 1. Dashboard (`/`)

| Field | Specification |
|---|---|
| **Purpose** | Entry point. See what projects exist, resume one, start a new one. |
| **Primary user action** | Create a new project (name → redirected straight into its Workspace) |
| **Secondary actions** | Open an existing project; delete a project |
| **Layout** | Single centered column, generous vertical rhythm — see [dashboard-design.md](dashboard-design.md) |
| **Components** | `AppHeader` (brand mark, no nav needed — this *is* the top level), `ProjectCreateForm`, `ProjectList` / `ProjectCard`, `EmptyState`, `ConfirmDialog` |
| **Data required** | `GET /api/projects` on mount |
| **States** | loading, empty (no projects yet), populated, error (list fetch failed), per-row deleting |
| **Responsive** | Already the most responsive-friendly screen in the app (Phase 1 audit §19) — fluid single column at every width, no special mobile treatment needed beyond touch-target sizing |

## 2. Project Workspace (`/projects/:id`)

| Field | Specification |
|---|---|
| **Purpose** | Everything from "no image yet" through "exported ZIP" — upload, detect, correct, inspect, generate, preview, hand-edit code, version, export, approve for training. One project, one asset, worked end-to-end. |
| **Primary user action** | Depends on lifecycle stage — see the four sub-states below |
| **Secondary actions** | Detect, Approve for training, Export, Save code version, every Inspector Apply/Reset, version activation |
| **Layout** | Toolbar → consolidated status bar → four-region workspace body (Layers / Canvas / Inspector / Code+Preview dock) — full spec in [workspace-design.md](workspace-design.md) |
| **Components** | `WorkspaceToolbar`, `StatusBar`, `LayersPanel` → `UITree`, `CanvasPanel` → `SketchCanvas` + overlays, `InspectorPanel` → six sections, `BottomDock` → `CodePanel` + `PreviewPane` |
| **Data required** | `GET /api/projects/:id`, `.../assets`, `.../detections` on mount; `.../style-overrides`, `.../content-overrides`, `.../geometry-overrides`, `.../structure-overrides`, `.../corrections`, `.../code-versions`, `.../exports`, `.../approve-training` as each panel needs them |
| **States** | See the four lifecycle sub-states below, each with its own loading/empty/error |
| **Responsive** | Desktop-first, explicit narrow-viewport fallback — full spec in [responsive-design.md](responsive-design.md) |

### Workspace lifecycle sub-states

The single route has four meaningfully different states, which the design treats
as distinct rather than one screen that happens to have conditionals (this replaces
the audit's §22 complaint that today's version has no visible structure for this):

| Sub-state | Trigger | What's shown |
|---|---|---|
| **Empty** | No asset uploaded yet | `UploadDropzone`, full-panel, everything else hidden |
| **Annotating** | Asset present, no code generated yet | Full four-region workspace, `BottomDock` defaults to an empty/prompt state in place of Preview |
| **Working** | At least one saved `CodeVersion` exists | Full workspace, `BottomDock` shows live Preview/Code |
| **Detecting** | A detection job is in flight | Full workspace + the status bar's job-progress segment active; canvas remains interactive for manual correction while detection runs |

## Screens explicitly not built

Per "do not invent routes that are not necessary" — confirmed against
`PROJECT_STATUS.md` §4 as genuinely not implemented, not merely undocumented:

- **Login / account / settings** — no auth exists (§4.2); a settings screen with
  nothing to configure would be decoration, not a feature.
- **Project settings / archive view** — the only project-level actions are create and
  delete; there is no separate metadata to manage.
- **Multi-page project navigator** — one asset per project today (§4.2 "a later
  implementation"); no `Project → Page[]` hierarchy to navigate.
- **Standalone export/history page** — exports and code versions are already
  surfaced in-context inside the Workspace (see [workspace-design.md](workspace-design.md)'s
  status bar and [code-preview-design.md](code-preview-design.md)'s version selector);
  a separate route for the same data would fragment one continuous task.
