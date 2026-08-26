---
title: "Sketch2UI — Application Information Architecture"
deliverable: "Phase 2, Deliverable 3"
---

# Information Architecture

> **Superseded — route table only.** This doc's own text below ("exactly two
> routes," "no settings/account/auth route... out of scope") was accurate as of
> Phase 2 (2026-08-25) but predates Phase D1 (auth, 2026-08-25 later the same day)
> and the SaaS transformation (D0/S1–S14, 2026-08-26 — see
> `docs/execution/phase-log.md`'s consolidated entry for the full route/architecture
> history). The route table immediately below is corrected to match the current
> router (`apps/web/src/App.tsx`); the rest of this document's prose (the
> Dashboard/Workspace section specs, "screens explicitly not built" reasoning) is
> kept as historical record of Phase 2's own scope decision, not current fact —
> read it as "what Phase 2 shipped," not "what exists today."

## Route table (current — 2026-08-26)

| # | Route | Component | Status |
|---|---|---|---|
| 1 | `/` | Home (public marketing) | Added Phase S3 |
| 2 | `/pricing` | Pricing (public, mock/informational) | Added Phase S3 |
| 3 | `/login` | Login | Added Phase D1 |
| 4 | `/register` | Register | Added Phase D1 |
| 5 | `/app` | Dashboard (was `/` before Phase S3) | Exists — redesigned in [dashboard-design.md](dashboard-design.md) |
| 6 | `/app/projects/:id` | Project Workspace (was `/projects/:id` before Phase S3) | Exists — redesigned in [workspace-design.md](workspace-design.md) |
| 7 | `/app/account` | Account | Added Phase S4 |
| 8 | `/admin` | Admin Overview | Added Phase S6 |
| 9 | `/admin/users` | Admin Users | Added Phase S7 |
| 10 | `/admin/projects`, `/admin/projects/:id` | Admin Projects | Added Phase S8 |
| 11 | `/admin/jobs`, `/admin/models`, `/admin/training` | Admin Jobs/Models/Training | Added Phase S9 |
| 12 | `/admin/audit-logs` | Admin Audit Logs | Added Phase S10 |

## Route table — as originally written, Phase 2 (2026-08-25, now historical)

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

## Screens explicitly not built (as of Phase 2 — two items below have since shipped)

Per "do not invent routes that are not necessary" — confirmed against
`PROJECT_STATUS.md` §4 as genuinely not implemented, not merely undocumented, **at
the time Phase 2 was written**. Login/account (Phases D1/S4) and the multi-page
navigator (Phase D3's `PagesStrip.tsx`) have since been built — kept in this list
unedited as a record of Phase 2's own reasoning, not a current gap list. The
remaining two items are still accurate today.

- ~~**Login / account / settings**~~ — built: `/login`, `/register` (Phase D1),
  `/app/account` (Phase S4).
- **Project settings / archive view** — still not built. The only project-level
  actions are create, rename, and delete; there is no separate metadata to manage.
- ~~**Multi-page project navigator**~~ — built: `PagesStrip.tsx` (Phase D3),
  `Project → Page[]`.
- **Standalone export/history page** — exports and code versions are already
  surfaced in-context inside the Workspace (see [workspace-design.md](workspace-design.md)'s
  status bar and [code-preview-design.md](code-preview-design.md)'s version selector);
  a separate route for the same data would fragment one continuous task.
