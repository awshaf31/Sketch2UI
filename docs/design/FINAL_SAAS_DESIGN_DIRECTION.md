---
title: "Sketch2UI — Final SaaS Design Direction"
date: 2026-08-26
status: FROZEN — do not re-litigate decisions recorded here
supersedes: nothing; extends docs/frontend/design-direction.md and design-tokens.md
---

# Final SaaS Design Direction

## 0. Scope of this document — read this first

This is **not** a redesign brief for the whole app. The SaaS transformation
(`docs/execution/phase-log.md`, phases D0 + S1–S14) and the 2026-08-26 polish pass
(`docs/frontend/saas-polish-audit-2026-08-26.md`) already shipped the public marketing
site, authentication, the app shell's header, the dashboard, the admin dashboard, audit
logging, and a full token system wired into `apps/web/tailwind.config.js`.

An inspection of the live source (not the docs) on 2026-08-26 found that against the
"professional SaaS / visual builder" target, **three gaps remain**. This document
freezes the direction for those three, and records the classification of everything
else as PRESERVE so no future pass reopens it.

The design system itself is **already established and is not being replaced**.
`docs/frontend/design-tokens.md` + `apps/web/tailwind.config.js` are the single source
of truth for color, type, spacing, radius, elevation, and motion. No second system is
introduced here. IBM Plex Sans/Mono, `#2f5fdd` primary, `#f97316` reserved for
selection only, 11–28px type scale, 2–48px spacing scale — all unchanged.

## 1. Surface classification

| Surface | Class | Rationale |
|---|---|---|
| Detection engine, YOLO, CV worker | PRESERVE | Business logic. Untouched. |
| Repositories, project/asset/page APIs, auth, authorization | PRESERVE | Untouched. |
| UI-IR, detection UUID identity, correction history | PRESERVE | Untouched. |
| Code generation, immutable CodeVersion, export ZIP | PRESERVE | Untouched. |
| Monaco editor, preview sandbox + its security posture | PRESERVE | No iframe permission changes, ever. |
| Public marketing site (`/`, `/pricing`) | PRESERVE | Shipped S3. Meets the bar. |
| Login / Register | PRESERVE | Shipped S1, polished 2026-08-26 (gradient ground, brand mark, `PasswordInput`). |
| Admin (`/admin/*`, 7 pages) | PRESERVE | Shipped S8–S12, visual-QA'd S13 + verified live in an isolated instance. |
| Design tokens, primitives (`components/*`) | PRESERVE | 27 primitives, consistent. Reuse, don't add. |
| Canvas + overlays | PRESERVE | Already correct per §5: dashed/translucent model boxes, zoom/fit, labels on hover only. |
| Inspector (5 groups + history) | PRESERVE | Already grouped, already has an empty state. |
| Code / Preview dock | PRESERVE | Tabs + Desktop/Tablet/Mobile + collapse toggle already shipped. |
| Workspace toolbar | PRESERVE | Back-link, click-to-rename, correct action hierarchy (verified by reading source). |
| **App shell (Dashboard, Account)** | **REDESIGN** | Gap 1 — top-nav only; brief and references call for a persistent sidebar. |
| **Workspace left panel** | **REDESIGN** | Gap 2 — Layers only; references call for Pages / Layers / Assets in one navigator. |
| **Assets panel** | **NEW** | Gap 3 — does not exist; the data already does. |

Everything marked PRESERVE is **frozen**. Do not restyle it to "match" the three
changes below — the three changes below are built from the existing primitives
specifically so that no such reconciliation is needed.

## 2. Reference-derived patterns (what was actually taken)

Two references in `uiux/` answer both open questions; no further pattern research was
performed, and none should be.

**Visual builder reference** → slim editor chrome; a left panel that is a *navigator*
(tree with type icons, indentation, disclosure arrows, a selected row) rather than a
single-purpose list; a right inspector under tabs; a bottom context strip. Taken:
the *relationship* between the panels and the idea of one left navigator holding
several structural views. Not taken: dark chrome, its layout, its typography, any of
its labels.

**SaaS application reference** → persistent left sidebar carrying brand at top,
grouped primary nav, and the user identity pinned at the bottom; content area gets a
breadcrumb/page header instead of repeating the nav. Taken: sidebar composition and
the "identity lives at the bottom of the rail" convention. Not taken: its grouping
labels, its upsell block, its color, its iconography.

Nothing else — no logos, names, copy, metrics, pricing, or invented features.

## 3. Design principles (binding)

1. **The sketch is the product.** Nothing may reduce the readability of the user's own
   drawing. Detection overlays stay translucent/dashed; labels stay on hover.
2. **One primary action per surface.** Detect is primary in the workspace; New project
   is primary on the dashboard. Everything else is secondary, tinted, or ghost.
3. **Reuse before invention.** Any new UI is assembled from `components/*`. A new
   primitive requires a reason no existing one covers.
4. **Density with air.** Compact controls (28–32px), hairline `border` separators,
   restrained elevation. Elevation is for overlays only — never for static panels.
5. **Color is data.** Outside the brand primary and semantic status, hue is reserved
   for meaning (detection source, selection). No decorative color.
6. **State is never implied by color alone.** Selected rows carry a background *and* a
   left rail *and* `aria-selected`/`aria-current`.
7. **Motion is confirmation, not decoration.** `duration-fast` on hover, `duration-normal`
   on panel transitions. Nothing animates on load.

## 4. Navigation structure (final)

```
PUBLIC          /                     Home
                /pricing              Pricing
                /login  /register     Auth

APP (sidebar)   /app                  Dashboard — Projects
                /app/account          Account
                /app/projects/:id     Workspace  (no sidebar — full-bleed editor)

ADMIN           /admin, /admin/users, /admin/projects, /admin/jobs,
                /admin/models, /admin/training, /admin/audit-logs
```

**Decision — the workspace does not get the app sidebar.** The editor needs its full
horizontal budget for Navigator + Canvas + Inspector. The workspace's own toolbar
already carries `← Projects`, which is the only escape hatch it needs. This is the
same split every real visual builder makes, and it is final.

**Decision — no Templates nav item.** Templates are not implemented. The brief's own
rule ("only if actually implemented") applies.

## 5. App shell direction (Gap 1 — REDESIGN)

A persistent 224px left rail on `/app` and `/app/account`, replacing `AppHeader` on
those two routes only.

- **Top:** `BrandMark` + "Sketch2UI", linking to `/`.
- **Middle:** primary nav — Projects, Account — each an icon + label row, 32px tall,
  `rounded-md`. Active row: `bg-primary-subtle`, `text-primary`, `aria-current="page"`.
  Hover: `bg-surface-sunken`. An Admin row renders only when `user.role === "admin"`.
- **Bottom:** user email (truncated, `title` attribute for the full value) above a
  ghost "Log out" button, separated by a `border-t`.
- **Content area:** page header (H1 + supporting line + primary action) then content.
- **Responsive:** below 768px the rail collapses to a top bar with a disclosure that
  reveals the same nav list vertically. No off-canvas drawer — the app already owns a
  `Drawer`, but a two-item menu does not justify a focus trap.

`AppHeader` is retained unchanged for auth pages, which mount it while unauthenticated.

## 6. Workspace direction (Gap 2 + 3 — REDESIGN / NEW)

The left panel becomes a **Navigator** with three tabs, reusing the existing `Tabs`
primitive: **Pages · Layers · Assets**. Width goes 240px → 260px to hold the tab row.

- **Pages** — vertical list replacing the horizontal `PagesStrip`. One row per page
  with the existing rename (click-to-edit) and delete (confirm dialog) affordances,
  moved verbatim; "Add page" pinned at the bottom of the list. Removing the horizontal
  strip returns ~34px of vertical space to the canvas and stops it competing with the
  toolbar for "where am I" signal.
- **Layers** — the existing `UITreePanel`, unchanged. It is already the UI-IR tree, is
  already keyboard-navigable, and is the only hierarchy model. No second tree.
- **Assets** — new, read-only. One row per `ProjectAsset` for the current page:
  thumbnail (the asset image itself), filename derived from `storageKey`, `mimeType`
  as a short type chip, and `width × height`. `fileSize` humanized. Nothing invented —
  every field is already on the type. No upload/delete here; upload stays the
  first-run dropzone. Empty state: "No assets on this page yet."

Tab state is component-local and resets per page switch to **Layers**, the tab that
matters during the detect/correct loop.

Everything else in the workspace — toolbar, status bar, canvas, inspector, dock — is
untouched.

## 7. Component rules

- Compose from `components/*`. `Panel`, `SectionHeader`, `Tabs`, `Button`,
  `IconButton`, `Input`, `Badge`, `EmptyState`, `Tooltip` cover all three gaps.
- Icons: inline 12–16px SVG, `stroke="currentColor"`, `strokeWidth` 1.4–1.5,
  `aria-hidden="true"` — matching every existing icon in the codebase.
- No new dependency is added for any of this work.

## 8. State rules

Every list surface implements four states explicitly: **loading** (existing skeleton /
"Loading…" convention), **empty** (`EmptyState` with a concrete next action),
**error** (`ErrorState` with retry where an action can be retried), and **populated**.
Destructive actions route through the existing `useDialog().confirm`. Transient
outcomes route through `useToast`.

## 9. Responsive rules

- Public + Dashboard + Account: desktop / tablet / mobile.
- Workspace: desktop-first. Tablet (768–1023px) keeps the existing Drawer treatment —
  the Navigator simply becomes the Drawer's content, so the three tabs are reachable
  there too. Mobile (<768px) keeps the existing `WorkspaceUnavailable` fallback.
- No horizontal page overflow at any width. Header rows that cannot fit scroll
  horizontally (`overflow-x-auto` + `shrink-0 whitespace-nowrap`), the pattern already
  proven in `AdminHeader` and `AppHeader`.

## 10. Accessibility rules

- Sidebar is `<nav aria-label="Primary">`; active row carries `aria-current="page"`.
- Navigator tabs use the existing `Tabs` primitive's roving-tabindex/`aria-selected`.
- Every icon-only control has an `aria-label`. Every icon is `aria-hidden`.
- Focus is always visible; the app's `focus` token drives the ring.
- Asset thumbnails get real `alt` text (the filename), not empty alt.
- State is never color-only (§3.6).
- Contrast: `text-muted` is `#5d6679` specifically to clear WCAG AA at 11px — do not
  lighten it.

## 11. Sketch2UI-specific decisions (frozen)

1. The workspace is sidebar-free (§4).
2. Pages moves from a horizontal strip to the Navigator (§6) — one "where am I"
   surface, not two.
3. Assets is read-only (§6). Upload remains the first-run dropzone, because the
   product's story is one sketch per page, not a media library.
4. No Templates (§4).
5. Selection orange (`#f97316`) is never used for the sidebar's active row — that is
   `primary`. Selection stays canvas/tree-only.
6. No metrics, counts, accuracy figures, or collaborator UI anywhere. If the API does
   not return it, it does not render.
