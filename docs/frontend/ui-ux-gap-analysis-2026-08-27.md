---
title: "Sketch2UI — UI/UX Gap Analysis: Current Implementation vs. Design Inspiration"
status_date: "2026-08-27"
purpose: "Compares the 13 current-implementation screenshots (Sketch2UI_ScreenShot.zip) against the 16 design-inspiration references (uiux.zip), read against the project's own documented design direction, to surface concrete, buildable recommendations."
inputs:
  - "Sketch2UI_Complete_Overview.md (project documentation snapshot, 2026-08-27)"
  - "Sketch2UI_ScreenShot.zip — 13 live screenshots: public marketing page, auth (login/register), dashboard, account, project workspace (annotation + inspector + preview + code), and all 7 admin pages"
  - "uiux.zip — 16 reference images: mostly AI app-builder / no-code visual-editor UIs (Webflow-style, Framer-style, Figma-plugin-style panels), a CRM workflow builder, an HR dashboard, and two auth screens"
  - "docs/frontend/design-direction.md, design-tokens.md, saas-polish-audit-2026-08-26.md, apps/web/tailwind.config.js, apps/web/src/components/Card.tsx (read directly from the project repository for grounding)"
---

# Sketch2UI — UI/UX Gap Analysis

## How to read this report

This comparison has a wrinkle worth stating before anything else: Sketch2UI already has a
written, deliberate design direction (`docs/frontend/design-direction.md`, Phase 2A) that
describes the product as a **"drafting instrument, not a dashboard,"** modeled on Figma,
VS Code, and CV annotation tools like CVAT — flat surfaces delineated by hairline borders,
shadow reserved strictly for things that leave the page plane (menus, modals), no
gradients, no glassmorphism, no marketing-style stat cards. A second document
(`saas-polish-audit-2026-08-26.md`, dated the day before these screenshots) already found
and fixed three real problems — a permanently-expanded preview dock, cluttered canvas
labels, and a disconnected-feeling login page — all visible as *fixed* in the screenshots
reviewed here (the dock has a collapse chevron, canvas labels are lightweight, and both
auth pages already carry a soft background tint and a password show/hide toggle).

Most of the 16 inspiration images are a different genre of product entirely: AI app
builders and no-code page editors (Webflow, Framer-style tools, an "Oripio" AI-build
playground, a CRM workflow canvas, an HR dashboard). Several of them lean on exactly the
vocabulary Sketch2UI's own direction document explicitly rejects — gradient KPI tiles,
frosted/glass panels, colorful blob backgrounds, bold display serif headlines, pill-shaped
buttons everywhere. Recommending Sketch2UI adopt that surface language wholesale would
undo a considered decision, not improve it.

So this report does two things rather than one. First, it separates the inspiration set
into what's *structurally* transferable — panel composition, information density,
affordances — from what's purely *decorative* and specific to a marketing-facing SaaS
product. Second, for each current screen, it names concrete gaps between what's on screen
today and what the project's **own** stated direction and token system already promise,
since those are gaps worth closing regardless of any inspiration folder.

## What's already working and shouldn't change

Three things are worth confirming as strengths before listing gaps, so they don't get
accidentally "fixed" later. The IBM Plex Sans / IBM Plex Mono pairing called for in
`design-tokens.md` is genuinely wired up (`index.html` loads both families from Google
Fonts, weights 400/500/600 only, matching the "no 700 anywhere" rule) — the clean, slightly
technical letterforms visible across every screenshot are real, not a fallback font that
happens to look similar. The flat, border-only surface treatment on cards and panels
(`Card.tsx`: `shadow-none` by default, `shadow-subtle` only on hover/focus for interactive
cards) is a deliberate implementation of the "shadow means floating above the page, nothing
else" rule, and it reads correctly in the dashboard and admin screenshots — this should be
treated as correct, not as "the design feels flat/unfinished." And the status-pill
vocabulary already in use in the admin tables (green `COMPLETED`/`GENERATED`, red
`FAILED`, gray `DRAFT`) is exactly the semantic-color-only-means-something discipline the
tokens describe (`success`/`error`/neutral, not decorative color).

## Screen-by-screen findings

### Authentication (Login / Register)

Both screens already got the 2026-08-26 polish pass: a soft radial tint sits behind the
card, the layout is closer to vertically centered, and the password field has a working
show/hide toggle. Measured against the inspiration set specifically, the highest-value
remaining pattern is the **split-screen layout** used by three of the sixteen references
(the "Voice Aura" sign-up, the HR "Welcome back" screen, and less directly the general
app-shell logins) — a left or right panel carrying brand context, a clear panel carrying
the form. The important caveat: those references fill that second panel with
photography, gradients, or a product screenshot — none of which belong here per
`design-direction.md`'s explicit "no hero sections, no illustrated panels" rule. A
version worth building would keep the second panel *functional* rather than decorative:
a live, sandboxed, non-interactive render of what the product actually outputs
(a small "before sketch → after HTML" pair, rendered with the same muted, border-only
treatment as everything else). That reinforces "precision instrument" instead of fighting
it, and gives new users their first honest look at the product's output before they've
uploaded anything. Short of that, the current single-card-on-tinted-field approach is
already reasonably aligned with the stated direction and shouldn't be pulled toward a
generic marketing split-screen.

### Dashboard / Projects

The project-creation card and the search/filter toolbar are clean and appropriately
dense. The one concrete, checkable gap: **"Recent projects" cards carry zero visual
preview.** `Dashboard.tsx` only keeps a client-side object-URL thumbnail during the
create-project flow, revoked on unmount — once a project exists, its card shows nothing
but a name and a status word ("generated"/"draft"). Every relevant inspiration reference
(the Webflow-style page list, the Oripio template gallery, the shadcn block gallery) and,
more importantly, Sketch2UI's own closest analog — Figma's file browser — treats a visual
thumbnail as the primary way you recognize a project, not the name string. This is
buildable without new backend work: the API already exposes an ownership-gated image
route (`GET /api/projects/:id/pages/:pageId/assets/:assetId/image`, per the project
overview's §13), so a project card can request its first page's sketch image the same way
the workspace already does. A thumbnail strip (sketch image, or the generated preview once
one exists) would make the dashboard scannable at a glance instead of requiring a click
into each project to remember what it is — this becomes materially more important as the
project count grows past the ~16 visible in the admin overview today.

### Project Workspace (the core screen)

This is the screen that matters most, and it's already the most mature — dense by
design, per `design-direction.md`'s explicit "CAD tool, not a content page" argument, and
the Layers tree, canvas toolbar, and version/preview/code dock all follow that
successfully. Two specific, non-decorative ideas from the inspiration set are worth
adopting here because they *reinforce* the precision-studio read rather than fight it.

First, the **visual box-model diagram** used for padding/spacing in two of the
inspiration panels (the "Message padding" editor and the "Grid Child" spacing panel) —
a small rectangle with drag-to-edit top/right/bottom/left handles and inline numeric
values — is a strictly better way to edit the Inspector's Geometry group than the current
four bare labeled number fields (`x`, `y`, `width`, `height` as plain text inputs). This
is exactly the kind of affordance CAD and layout tools use for spatial data, so borrowing
it isn't a stylistic import, it's adopting the correct tool for the job — likely the
single highest-leverage UI change available in the whole workspace, since geometry
editing is a core, frequent interaction.

Second, several inspiration panels group each editable region into its own clearly
bounded section with a header row, an overflow/actions control, and a collapse chevron
(the "Message padding" / "Message frame" cards, and the Design-panel "Layout / Size /
Spacing / Typography" sections). Sketch2UI's Inspector already has the right content
grouping (Style / Content / Detection / Geometry / Structure) and already uses chevron
accordions, but the groups aren't visually separated from each other beyond stacking —
there's no equivalent of a bordered "card" per group the way the canvas toolbar and
Layers panel already use borders as their primary structural device. Extending that same
hairline-border logic to wrap each Inspector accordion section would make the panel read
as a series of distinct, scannable instruments rather than one long form — consistent
with, not borrowed from outside, the existing border philosophy.

### Admin suite (Overview, Users, Projects, Jobs, Models, Training Data, Audit Logs)

Functionally thorough and visually consistent with the rest of the app — this is a
genuine strength; nothing here needs a redesign. Two smaller, low-risk observations.
The Overview page's three stat tiles (Total Users / Total Projects / Generated Projects)
occupy roughly the top eighth of a nearly-empty page — the inspiration set's dashboards
(the HR "Good Morning" screen in particular) use that space for a lightweight trend
element instead of leaving it blank, but the honest version for Sketch2UI would not be a
fabricated gradient KPI card — it would be something like a small, flat, single-color
sparkline of jobs-per-day or a status breakdown (draft/generated/failed) using the
existing muted palette, which is real data the Jobs table already contains, just not
visualized. Second, the Jobs and Audit Logs tables are dense, correctly-typed data
(timestamps, emails, project names, error strings) rendered entirely in the UI sans face;
`design-direction.md`'s own rule that "data gets its own typeface" (IBM Plex Mono) is
applied to canvas coordinates and code but not yet to these tabular timestamps/IDs — worth
a look, though this is a minor consistency polish, not a structural gap.

## Patterns from the inspiration set worth adopting

Stated plainly, independent of source: the visual spacing/box-model editor (Inspector
Geometry), bordered-card grouping for Inspector sections, and dashboard project
thumbnails. All three are functional affordances that happen to appear in the inspiration
images, not aesthetic choices — each one is defensible purely on "this is the more usable
version of a control Sketch2UI already has," which is why they survive being filtered
through the project's own stated design philosophy.

## Patterns to explicitly not adopt

For completeness, since these appear repeatedly across the 16 references and it's worth
being explicit about rejecting them rather than leaving it implicit: gradient-filled KPI
or hero panels (Oripio, the CRM workflow builder's purple/blue backdrop, the HR
dashboard's black gradient payroll tile), glassmorphic/frosted panels (the code-editor
preview mockup's floating translucent card), large soft drop shadows on in-flow panels,
bold display or serif headline type for UI chrome (several references use a heavy serif
for marketing-style headings — Sketch2UI's own direction reserves emphasis for IBM Plex
Sans 600 weight only), and pill-radius buttons used as general-purpose controls rather
than status indicators. None of these are wrong for the products they came from — they're
wrong for a tool whose own stated identity is closer to CVAT and VS Code than to a
marketing-site builder.

## Priority summary

| Recommendation | Where | Why it's high-value | Relative effort |
|---|---|---|---|
| Visual box-model editor for Geometry | Project Workspace → Inspector | Replaces four bare number fields with the correct tool for spatial editing; touches the most-used panel | Medium — new component, existing x/y/w/h data |
| Dashboard project thumbnails | Dashboard → project cards | Makes the project list scannable; image route already exists server-side | Medium — mostly frontend, reuses existing asset endpoint |
| Bordered-card grouping per Inspector section | Project Workspace → Inspector | Extends the app's own border-as-structure rule for a cleaner accordion; low risk | Low — CSS/layout only |
| Functional (non-decorative) auth side panel | Login / Register | First-impression polish without violating "no hero sections" | Low–Medium — optional, lower priority than the two above |
| Lightweight admin trend visualization | Admin → Overview | Fills genuinely empty space with real, already-collected data | Low — small chart component, existing Jobs data |
| Mono type for tabular timestamps/IDs | Admin → Jobs / Audit Logs | Minor consistency polish per the existing type-system rule | Low |

## What this report deliberately leaves out

No code changes were made and no mockups were produced — this is the written comparison
the task asked for. If any of the above should move forward, the natural next steps would
be either a small set of redesign mockups for the Inspector Geometry group and the
Dashboard project card (the two highest-value items), or going directly into the
`apps/web` codebase to implement them, following the same "read design-direction.md and
design-tokens.md first" discipline the project's own prior phases already used.
