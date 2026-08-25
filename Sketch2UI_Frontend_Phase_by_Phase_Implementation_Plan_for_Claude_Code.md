---
title: "Sketch2UI Frontend — Phase-by-Phase Implementation Plan for Claude Code"
project: "Sketch2UI"
scope: "React + Vite + TypeScript + Tailwind CSS frontend"
status_basis: "Verified baseline, phase execution log, Phase 8 amendment, regression checklist"
status_date: "2026-08-25"
---

# Sketch2UI Frontend — Phase-by-Phase Implementation Plan for Claude Code

## 1. Purpose

This is the **frontend execution plan** for the existing Sketch2UI application. It is not a greenfield frontend specification. The project already has a React + Vite + TypeScript + Tailwind frontend, an annotation canvas, Inspector, UI tree, code editor, live preview, versioning, export, and a Playwright golden-path test. The plan therefore focuses on **verification, stabilization, synchronization, testing, polish, and release**, not rebuilding completed functionality. The baseline identifies `apps/web` as the React/Vite/TypeScript/Tailwind application and records the actual development/test/build setup. fileciteturn6file0L57-L74

The frontend is complete when one continuous user journey works reliably:

```text
Dashboard
  ↓
Project
  ↓
Upload sketch
  ↓
Page boundary
  ↓
YOLO detection
  ↓
Manual correction
  ↓
UI tree
  ↓
Inspector
  ↓
HTML / CSS
  ↓
Live preview
  ↓
Code version
  ↓
Export ZIP
```

The project regression checklist makes this same core path the release gate and explicitly says not to mark a phase complete if any checklist step fails. fileciteturn5file7L540-L548

---

# 2. Verified Frontend Starting Point

## 2.1 Existing stack

Keep the current stack:

```text
React
Vite
TypeScript
Tailwind CSS
```

Do not migrate the frontend to another framework during completion.

## 2.2 Existing implementation that must be preserved

The phase log confirms the frontend now includes:

- Geometry Inspector;
- Structure Inspector;
- Detection Inspector;
- Style Inspector;
- Content Inspector;
- correction History;
- canvas/tree/code synchronization for geometry and structure;
- Detection class correction;
- generated-code/version refresh after Inspector changes. fileciteturn5file1L104-L143

The Geometry implementation deliberately updates `effectiveDetections` so canvas, tree, code and preview see the same positions, and direct canvas drag clears a geometry override so a drag does not silently revert. fileciteturn6file8L625-L636

The Structure implementation layers manual parent/order overrides on top of automatic containment and row grouping rather than replacing the existing layout engine. fileciteturn5file3L258-L266

Correction History is already integrated into `InspectorPanel` and `ProjectWorkspace`; it refreshes after correction-producing actions. fileciteturn6file9L724-L733

## 2.3 Current E2E position

The latest phase log already contains a Playwright golden-path test covering:

```text
create project
→ upload deterministic fixture
→ mocked detection
→ Inspector correction
→ generate
→ live-preview iframe
→ export ZIP
```

It runs against a throwaway store and does not touch real Postgres. fileciteturn6file1L107-L141

## 2.4 Current Postgres status relevant to frontend

The backend has already been migrated to PostgreSQL for runtime persistence, and the latest real regression run executed the complete 15-step path against real Postgres with real CV inference, including all four override groups and version activation/export. fileciteturn5file8L637-L654

That means the frontend should now be treated as a **Postgres-backed product**, not as a JSON-store application.

---

# 3. Frontend Architectural Rules

## Rule 1 — Do not rebuild working features

When a feature already exists, Claude Code must use:

```text
inspect → test → stabilize
```

not:

```text
rewrite → hope → regress
```

## Rule 2 — API service is the frontend boundary

Prefer:

```text
React component
    ↓
apps/web/src/services/api.ts
    ↓
HTTP API
```

Do not scatter direct `fetch()` or route strings throughout the UI when an existing service method already handles the endpoint.

## Rule 3 — Detection UUID is persistent editing identity

The existing Inspector override architecture uses detection UUIDs because UI-IR node IDs are per-generation and unstable. Geometry, Structure and the other Inspector features follow this identity model. Preserve it. fileciteturn6file2L168-L179

## Rule 4 — UI-IR node IDs are not persistence IDs

A generated tree can be regenerated. Persistent edits must remain attached to the source detection.

## Rule 5 — One effective state

The following surfaces must agree:

```text
Canvas
Tree
Inspector
HTML/CSS
Preview
Export
```

A geometry or structure edit that only changes one surface is a frontend defect.

## Rule 6 — Backend remains authoritative

Frontend validation improves UX, but backend validation still owns:

- geometry validity;
- structure validity;
- content security;
- project ownership;
- persistence;
- job state.

## Rule 7 — Preserve security

The current preview sandbox must not be weakened, and existing content validation must not be bypassed. The regression checklist explicitly requires that the iframe not gain `allow-scripts`. fileciteturn5file7L71-L81

## Rule 8 — Do not introduce a second state architecture

Before adding Zustand, Redux, Context, or another store, inspect the current state model. Use local state when local; lift only shared state.

---

# 4. Frontend Phase Map

```text
Phase F0  Baseline audit
Phase F1  Dashboard / project lifecycle
Phase F2  Upload UX
Phase F3  Annotation canvas
Phase F4  Page-boundary UX
Phase F5  Detection workflow
Phase F6  UI tree / selection synchronization
Phase F7  Inspector stabilization
Phase F8  Code editor / CodePanel
Phase F9  Live preview
Phase F10 Code-version UX
Phase F11 Export UX
Phase F12 API service layer
Phase F13 ProjectWorkspace state architecture
Phase F14 Loading / empty / error / retry UX
Phase F15 Accessibility
Phase F16 Responsive frontend
Phase F17 Performance
Phase F18 Security review
Phase F19 Targeted frontend tests
Phase F20 Final regression
Phase F21 Demo preparation
Phase F22 Feature freeze / release
```

The earlier Inspector phases are already implemented in the phase log, so F7 is a **stabilization and verification phase**, not a reimplementation phase.

---

# 5. Phase F0 — Baseline Audit

## Objective

Establish the exact frontend state before changes.

## Claude Code tasks

Read:

```text
PROJECT_STATUS.md
docs/execution/current-baseline.md
docs/execution/phase-log.md
docs/execution/regression-checklist.md
docs/execution/phase-8-architecture-amendment.md
```

Inspect the real `apps/web` tree and produce:

```text
route/page map
component map
API service map
ProjectWorkspace state map
Inspector state map
canvas/tree/preview synchronization map
test map
known frontend gaps
```

Run the current frontend build/typecheck and the existing Playwright golden path.

## Acceptance

```text
[ ] typecheck passes
[ ] build passes
[ ] Playwright golden path passes
[ ] no unexplained frontend changes
```

## Claude Code prompt

```text
Read the current baseline, phase log, regression checklist, and Phase 8 amendment.
Inspect the actual apps/web source tree.
Do not modify code yet.
Map pages, components, services, ProjectWorkspace state, Inspector state, canvas/tree/preview synchronization, and existing tests.
Run frontend typecheck, build, and the existing golden-path Playwright test.
Report exact frontend gaps and recommend only the next frontend phase.
```

---

# 6. Phase F1 — Dashboard and Project Lifecycle UX

## Objective

Make project creation/opening reliable without redesigning the dashboard.

## Verify

### New project

```text
button visible
→ create request
→ loading
→ success
→ workspace navigation
```

Prevent double-submit.

### Project list

Support explicit states:

```text
loading
empty
loaded
error
```

### Open project

Clicking a project must load the correct project, not stale workspace state.

### Refresh

Refreshing a project URL should restore the project correctly.

### Delete

If delete exists in the current UI:

```text
confirmation
→ delete
→ success
→ dashboard
```

## Acceptance

Create, open, refresh and return to projects without stale frontend state.

## Claude Code prompt

```text
Audit the existing dashboard and project lifecycle only.
Do not redesign the application.
Fix only proven issues in project loading, creation, empty/loading/error states, navigation, and duplicate submissions.
Run typecheck/build and the existing E2E test.
```

---

# 7. Phase F2 — Upload UX

## Objective

Make upload predictable and safe.

The regression checklist requires PNG/JPEG upload, visible asset appearance and stored upload behavior. fileciteturn5file7L571-L576

## States

Use an explicit state machine:

```text
idle
selecting
uploading
success
error
```

## Tasks

- drag-and-drop;
- choose file;
- client-side basic validation;
- upload progress/feedback;
- preview after success;
- retry after failure;
- prevent duplicate upload actions.

## Important rule

Do not remove the original sketch when starting detection.

Do not display stale detections when a new sketch is uploaded.

## Acceptance

Upload a real sketch, refresh, reopen the project and verify the correct asset remains visible.

---

# 8. Phase F3 — Annotation Canvas

## Objective

Make the canvas the authoritative visual editor.

## Rendering layers

```text
source image
page boundary
model/manual detection boxes
selection
resize handles
optional labels
```

## Coordinate model

Store normalized coordinates, convert to pixels only for display.

## Selection

```text
canvas click
→ selectedDetectionId
→ tree highlights
→ Inspector updates
```

## Drag

When dragging:

```text
local visual state
→ commit on drag end
```

Avoid an API request for every pointer movement.

## Geometry override interaction

Preserve the current rule: if a direct canvas drag occurs on an element with a geometry override, the override is cleared so the new canvas position is not silently reverted. fileciteturn6file8L632-L636

## Resize

Ensure:

```text
width > 0
height > 0
inside image/page constraints
```

using the same normalized model already used by the backend/shared types.

## Acceptance

Manual box creation, selection, drag, resize and delete work and remain synchronized with Inspector and tree.

---

# 9. Phase F4 — Page Boundary UX

## Objective

Make the most important computer-vision UX rule visually obvious:

> Detect UI components inside the webpage, not external handwritten notes.

The regression checklist requires the boundary to be adjustable and outside boxes to be filtered/greyed live. fileciteturn5file7L577-L580

## UI

Show:

```text
page boundary
corner handles
manual/automatic state
```

## Manual boundary

After user correction, later detection must preserve the manual boundary behavior.

## Rejected/outside objects

Normal mode:

```text
hide / filter
```

Debug mode:

```text
grey + rejected label
```

## Acceptance

Use a sketch with handwritten text outside the page and verify that it remains visible in the source image but does not enter the accepted UI tree or generated code.

---

# 10. Phase F5 — Detection Workflow UX

## Objective

Make YOLO detection understandable and robust.

The current model registry is explicitly `smoke_test`, uses YOLOv8-nano, has 16 trained classes, and should not be presented as a production-accuracy model. The frontend should accurately communicate that state. fileciteturn6file2L184-L199

## Detect button states

```text
Detect
Detecting...
Detected
Retry
```

Prevent duplicate requests.

## Job polling

The current product uses polling rather than WebSocket/SSE. Preserve that for the deadline unless a demonstrated UX problem requires otherwise.

## Model badge

Recommended:

```text
UI Detection · Experimental
```

Do not make unsupported accuracy claims.

## Detection box states

Use distinct states for:

```text
model
manual
selected
rejected
```

Do not rely on color alone.

## Acceptance

Run detection and verify:

```text
job processing
→ completed
→ boxes
→ selection
→ Inspector
```

---

# 11. Phase F6 — UI Tree and Selection Synchronization

## Objective

The UI tree must be a structural mirror of the effective detected/layout state.

The regression checklist requires the tree to reflect container/atomic relationships from the shared taxonomy. fileciteturn5file7L584-L585

## Two-way selection

```text
Canvas → Tree
Tree → Canvas
```

## Hierarchy

Respect the current taxonomy and shared container/atomic semantics. Do not build a second manually maintained taxonomy if the shared one can be reused.

## Regeneration

After:

```text
class change
geometry change
structure change
detection update
```

rebuild tree from the latest effective state.

## Synthetic nodes

Some layout groups may be synthetic and have no source detection UUID. The frontend must not assume every tree node is directly editable.

## Acceptance

Selecting one object from either canvas or tree must select the same logical detection and show the same Inspector state.

---

# 12. Phase F7 — Inspector Stabilization

## Current verified state

All five Inspector groups are now implemented:

```text
Detection
Geometry
Structure
Style
Content
```

and History is available as a read-only correction view. The Detection phase specifically wired editable class selection to the pre-existing detection PATCH route rather than creating a duplicate API record. fileciteturn5file1L111-L143

## Therefore: stabilize, do not rewrite.

### Detection

Preserve:

```text
class editable
confidence read-only
modelVersionId read-only
source read-only
originalClassName when available
revert-to-model
```

### Geometry

Preserve:

```text
x y width height
Apply
Reset
```

The existing implementation validates normalized values and keeps identity by detection UUID.

### Structure

Preserve:

```text
Auto
Root
eligible parent
Display Order
Apply
Reset
```

The existing structure validation rejects invalid parent references and cycles. fileciteturn5file3L247-L266

### Style

Keep the existing six-property allowlist.

### Content

Keep:

```text
text
altText
href
```

and the current security validation.

### History

Preserve read-only history and its per-detection scope.

## Draft state

Every group should show:

```text
clean
unsaved
applying
error
```

A change in one group must not erase another group's draft.

## Acceptance

Select one detection and successfully use all applicable Inspector groups in one workspace session.

---

# 13. Phase F8 — CodePanel and Monaco Editor

## Objective

Make HTML/CSS generation understandable and editing safe.

The regression checklist requires generated semantic HTML, generated CSS layout rules, editable Monaco, validator feedback and immutable versions. fileciteturn5file7L586-L594

## Tabs

```text
HTML
CSS
```

Do not add JavaScript unless the current generator actually creates it.

## Read-only/Edit mode

Make the state visually obvious.

## Save edit

Flow:

```text
editor
→ validate
→ create new CodeVersion
→ refresh versions
→ preview update
```

Never mutate an existing immutable version.

## Validation

Show human-readable syntax validation errors.

## Acceptance

Change a heading in Monaco, save, verify:

```text
new version
source=edited
preview updated
old version unchanged
```

---

# 14. Phase F9 — Live Preview UX

## Objective

Make the generated website preview reliable and secure.

## Security invariant

Do not add `allow-scripts` to the preview iframe. This is a specific regression requirement. fileciteturn5file7L76-L81

## States

```text
loading
ready
error
```

## Viewport controls

Preserve:

```text
Desktop
Tablet
Mobile
```

The regression checklist explicitly checks these toggles. fileciteturn5file7L590-L591

## Synchronization

Preview must refresh after:

```text
code edit
version activation
style Apply
content Apply
geometry Apply
structure Apply
```

## Error surface

Never leave a blank iframe with no message.

Show:

```text
Preview failed
Open Code
Retry
```

---

# 15. Phase F10 — Version Management UX

## Objective

Make immutable CodeVersion behavior understandable to users.

## Version list

Show:

```text
version
source
created
active
```

## Activation

```text
click Activate
→ loading
→ active state updates
→ preview refresh
→ export follows active version
```

## Critical invariant

Activating an old version must not mutate that version's source code. The regression checklist explicitly requires this. fileciteturn5file7L595-L596

## Acceptance

Create two versions, activate the first, verify preview/export, then reactivate the latest.

---

# 16. Phase F11 — Export UX

## Objective

Make the frontend export flow transparent.

The regression checklist requires the downloaded ZIP to contain:

```text
index.html
styles.css
assets/
source-sketch.*
README.txt
```

and verifies the HTML works directly without a server. fileciteturn5file7L597-L596

## UI states

```text
Export
Exporting...
Download ready
Export failed
Retry
```

## Acceptance

Download ZIP through the actual frontend button and open `index.html` independently.

---

# 17. Phase F12 — Frontend API Service Layer

## Objective

Audit and stabilize `apps/web/src/services/api.ts`.

Inventory:

```text
projects
assets
boundaries
detections
jobs
code generation
code versions
style overrides
content overrides
geometry overrides
structure overrides
corrections
training
exports
```

## Rules

- one endpoint definition per operation;
- no duplicated route strings;
- consistent error parsing;
- typed request/response payloads;
- no unnecessary direct fetch in components.

The Phase 8 backend architecture now exposes an async repository/service boundary, but the frontend should remain insulated from that internal change through the stable HTTP API. The frontend should not know or care whether the backend implementation is JSON or Prisma. fileciteturn5file0L40-L67

## Claude Code prompt

```text
Audit apps/web/src/services/api.ts and every frontend caller.
Do not redesign the backend.
Normalize only duplicated route/error/request logic that is demonstrably inconsistent.
Preserve existing HTTP contracts and response behavior.
Run typecheck/build and the existing Playwright test.
```

---

# 18. Phase F13 — ProjectWorkspace State Stabilization

## Objective

Prevent the workspace from becoming a single giant source of accidental state coupling.

Categorize current state into:

```text
Server state
    project
    assets
    detections
    boundaries
    overrides
    corrections
    versions
    jobs

Transient UI state
    selectedDetectionId
    active panel
    zoom
    viewport
    inspector drafts
    editor mode
```

## Rules

Keep state close to where it is used.

Move state upward only when multiple children need it.

Do not introduce a new global store simply because `ProjectWorkspace.tsx` is large.

## Synchronization rules

After a write:

```text
save
→ update local/effective state
→ regenerate where required
→ refresh versions where required
→ preserve selection when possible
```

## Acceptance

A geometry change cannot reset content drafts; a content change cannot reset structure; selecting a different detection must update the Inspector cleanly.

---

# 19. Phase F14 — Loading, Empty, Error and Recovery UX

## Objective

Make failures understandable rather than leaving stale UI.

Every async frontend operation must have:

```text
loading
success
failure
recovery
```

Apply this to:

```text
project load
upload
boundary load
Detect
code generation
version activation
export
history load
Inspector Apply
```

## Error hierarchy

### Validation error

Inline:

```text
Width must be between 0 and 1.
```

### API/business error

Notification/panel:

```text
Detection not found.
```

### Infrastructure error

Recovery UI:

```text
Unable to reach API.
Retry
```

Do not expose stack traces to users.

---

# 20. Phase F15 — Accessibility Pass

## Objective

Achieve a practical minimum accessibility baseline.

## Requirements

- real `<button>` for actions;
- labels for Inspector inputs;
- visible keyboard focus;
- keyboard-friendly forms;
- accessible names for icon buttons;
- error text associated with controls;
- sensible heading hierarchy;
- dialogs trap/restore focus where dialogs exist.

## Canvas

The canvas can remain mouse-primary, but all important object-editing operations must remain accessible through:

```text
Tree
Inspector
Toolbar
```

## Acceptance

Navigate major controls using keyboard only and verify that the selected detection remains understandable.

---

# 21. Phase F16 — Responsive Frontend

This refers to the **Sketch2UI application UI**, not the generated website preview.

## Desktop

Primary target:

```text
1280–1440px+
```

Three-pane workspace should remain usable:

```text
Tree | Canvas | Inspector
```

## Tablet

Use collapsible/drawer behavior if necessary.

## Mobile

Do not promise a complete mobile annotation experience unless it is already supported.

At minimum keep:

```text
Dashboard
Project list
Preview
```

usable.

Do not introduce a frontend framework migration to achieve this.

---

# 22. Phase F17 — Performance Pass

## Focus

Audit:

```text
ProjectWorkspace
AnnotationCanvas
DetectionOverlay
UITreePanel
InspectorPanel
Monaco
PreviewPane
```

## Rules

Use optimization only where useful:

```text
React.memo
useMemo
useCallback
debounced persistence
local pointer state
```

Avoid blanket memoization.

## Canvas drag

Do not send network requests for every pointer move.

## Large images

Avoid repeated decoding and unnecessary full-resolution DOM copies.

## Acceptance

Selecting and dragging a normal wireframe remains responsive.

---

# 23. Phase F18 — Frontend Security Review

## Preview

Preserve the existing sandbox. Never broaden iframe permissions as a shortcut.

## Content Inspector

Do not bypass backend validation of `<`, `>`, and unsafe href schemes.

## Upload

Client-side validation is only a UX layer; backend validation remains authoritative.

## Editor

Do not execute arbitrary user-edited code inside the host application.

## Export

Do not inject untrusted filenames or HTML into the host document without appropriate escaping.

---

# 24. Phase F19 — Targeted Frontend Test Strategy

## Current state

The latest project phase contains one Playwright golden-path E2E test. The original baseline had no React component tests and no Playwright suite; that gap has partially been closed by the golden path. fileciteturn6file2L181-L201 fileciteturn6file1L107-L141

## Do not build a huge test suite under deadline.

Prioritize high-risk tests.

### A. Inspector test

Select detection and verify:

```text
Detection
Geometry
Structure
Style
Content
History
```

can coexist.

### B. Synchronization test

```text
canvas selection
→ tree selection
→ Inspector selection
```

### C. Geometry test

Apply geometry and verify preview/export effect.

### D. Structure test

Apply parent/order and verify generated hierarchy.

### E. Content security test

Ensure `<script>` input is rejected by the API and never appears as executable preview content.

### F. Version test

Activate old version and verify current/new version content remains unchanged.

### G. Golden path

Keep the existing deterministic Playwright test as the primary release E2E.

---

# 25. Phase F20 — Final Frontend Regression

Use the project's existing regression checklist as the authoritative release test.

## Automated

Run the repository's current commands:

```bash
npm run test
npm run test:py
npm run build
```

plus:

```text
Playwright golden-path
```

The baseline confirms these are the real project-level test/build entry points. fileciteturn4file1L78-L105

## Manual 15-step flow

```text
1  Project create
2  Image upload
3  Manual box creation
4  Page boundary
5  Auto detection
6  Manual correction
7  UI tree
8  HTML generation
9  CSS generation
10 Live preview
11 Code edit
12 Version activation
13 Export ZIP
14 Style inspector
15 Content inspector
```

These are not optional demo checks; they are the project's defined core pipeline. fileciteturn5file7L566-L596

## Preservation checks

Also verify:

```text
model edit → source manual
re-detect → manual correction survives
versions immutable
preview sandbox unchanged
content validation unchanged
TS/Python boundary parity unchanged
```

---

# 26. Phase F21 — Final Demo Preparation

## Freeze one deterministic demo project

Use a known sketch containing:

```text
header
logo
navbar
hero
heading
text
image
button
cards
footer
```

## Demo script

```text
Open Dashboard
→ Open/Create Project
→ Upload sketch
→ Show page boundary
→ Detect
→ Select model box
→ Correct class
→ Adjust geometry
→ Show structure
→ Show HTML
→ Show CSS
→ Show preview
→ Edit text
→ Activate version
→ Export ZIP
```

## Do not depend on

```text
new dataset
network search
new model download
random sketch
unverified backend state
```

The demo must be reproducible from the frozen fixture.

---

# 27. Phase F22 — Frontend Feature Freeze

Once:

```text
typecheck
build
Playwright
15-step regression
manual demo
```

all pass:

**STOP adding features.**

Only allow:

```text
release-blocking bug fixes
```

Do not start:

```text
React export
Tailwind export
OCR
collaboration
large design-system rewrite
new frontend framework
```

---

# 28. Claude Code Master Frontend Prompt

Copy this prompt into Claude Code when working on the frontend as a whole:

```text
You are the senior frontend engineer responsible for completing the existing Sketch2UI frontend.

READ FIRST:
- current-baseline.md
- phase-log.md
- regression-checklist.md
- phase-8-architecture-amendment.md

THIS IS NOT GREENFIELD.

Current stack:
React + Vite + TypeScript + Tailwind CSS.

Current frontend features already implemented:
- dashboard/project creation
- upload
- annotation canvas
- page boundary
- detection
- UI tree
- HTML/CSS generation
- live preview
- Monaco/code editing
- immutable versioning
- export
- Detection Inspector
- Geometry Inspector
- Structure Inspector
- Style Inspector
- Content Inspector
- Correction History
- Playwright golden-path E2E

DO NOT rebuild completed features.

OBJECTIVE:
Make the existing frontend reliable, synchronized, testable, accessible, and ready for final demonstration.

PHASE ORDER:
F0 baseline
F1 dashboard
F2 upload
F3 canvas
F4 boundary
F5 detection
F6 tree
F7 inspector stabilization
F8 code editor
F9 preview
F10 versions
F11 export
F12 API service
F13 ProjectWorkspace state
F14 loading/error/recovery
F15 accessibility
F16 responsive
F17 performance
F18 security
F19 targeted tests
F20 final regression
F21 demo
F22 feature freeze

ABSOLUTE RULES:
1. Inspect before editing.
2. Preserve working behavior.
3. Use detection UUID as persistent edit identity.
4. Never use UI-IR node IDs as persistence identity.
5. Keep canvas/tree/Inspector/code/preview synchronized.
6. Preserve model→manual correction.
7. Preserve Geometry/Structure/Style/Content overrides.
8. Preserve immutable CodeVersion behavior.
9. Preserve page-boundary filtering.
10. Preserve iframe sandbox security.
11. Use the existing API service boundary.
12. Do not introduce a new global state library unless justified by an actual problem.
13. Do not rewrite layout.ts/html.ts/css.ts unless a real frontend regression proves it necessary.
14. Do not add large new features during deadline mode.
15. Test after every logical change.
16. A phase is not complete if the regression checklist fails.

For each phase:
- inspect exact files
- state intended file changes
- implement only the phase
- run typecheck
- run build
- run relevant tests
- run Playwright when applicable
- run the regression checklist after major phases
- report changed files, test results, and remaining limitations

DEADLINE PRIORITY:
reliability > regression safety > synchronization > demo readiness > polish > new features.

When a feature already works, stabilize it rather than rewriting it.
When a backend dependency is unavailable, do not fake production behavior; use a test mock only inside tests.

FINAL SUCCESS:
The complete 15-step regression checklist passes, the Playwright golden-path passes, typecheck/build pass, and the final demo can be repeated from a known sketch fixture.
```

---

# 29. Phase-by-Phase Claude Code Short Prompts

## F0

```text
Audit the current frontend only. Do not modify. Read baseline/phase-log/regression files, inspect apps/web, run typecheck/build/Playwright, and report exact frontend gaps.
```

## F1

```text
Stabilize dashboard/project lifecycle. Fix only demonstrated loading, navigation, empty/error, or duplicate-submit problems. Preserve existing layout.
```

## F2

```text
Stabilize image upload. Ensure idle/uploading/success/error states, no stale detections after replacing a sketch, and robust retry behavior.
```

## F3

```text
Audit AnnotationCanvas and DetectionOverlay. Preserve normalized coordinates, selection, drag, resize, delete, and geometry override behavior. Fix synchronization issues only.
```

## F4

```text
Audit page-boundary UX. Preserve manual/sticky boundary behavior and ensure outside-page detections stay out of the accepted tree/code.
```

## F5

```text
Audit Detect workflow. Verify button states, polling, errors, model/manual visualization, selection and re-detection behavior. Do not change CV logic.
```

## F6

```text
Audit canvas/tree synchronization. Ensure two-way selection and correct refresh after detection/class/geometry/structure changes.
```

## F7

```text
Stabilize all Inspector groups without redesigning them. Verify independent drafts, Apply/Reset, loading, errors, and History refresh.
```

## F8

```text
Audit Monaco CodePanel. Verify HTML/CSS editing, validation, new CodeVersion creation and immutable version behavior.
```

## F9

```text
Audit PreviewPane. Preserve sandbox, viewport toggles, loading/error states and synchronization after every generation/version/override operation.
```

## F10

```text
Audit version list and activation. Verify active version affects preview/export and activation never mutates old version content.
```

## F11

```text
Audit export UX. Verify loading/error/success and actual ZIP download behavior; preserve current export contents.
```

## F12

```text
Audit apps/web/src/services/api.ts. Eliminate duplicated API logic only where clearly justified; preserve all existing HTTP contracts.
```

## F13

```text
Audit ProjectWorkspace state for accidental coupling. Do not introduce a new global state framework. Separate transient UI state from server state where useful.
```

## F14

```text
Add/fix loading, empty, error and retry states for major frontend operations. Never hide API failures.
```

## F15

```text
Perform a practical accessibility pass: buttons, labels, focus, keyboard navigation, error associations, icon accessibility.
```

## F16

```text
Run a responsive audit of the Sketch2UI editor. Keep desktop primary; make tablet/mobile graceful without rebuilding the workspace.
```

## F17

```text
Profile only obvious frontend performance problems. Optimize canvas drag, large-image rendering, unnecessary re-renders and repeated API calls without broad memoization.
```

## F18

```text
Perform frontend security review focused on upload, content input, preview iframe, editor, URLs and export. Do not weaken existing security rules.
```

## F19

```text
Add only high-value frontend tests around Inspector, selection synchronization, geometry, structure, content validation and version activation. Keep the existing golden-path E2E.
```

## F20

```text
Run the complete frontend regression. Fix every release-blocking frontend defect. Do not add new features.
```

## F21

```text
Prepare one deterministic final demo fixture and verify the complete UI flow from upload through export.
```

## F22

```text
Feature freeze. Only fix release-blocking defects. Re-run typecheck, build, Playwright and the full regression checklist. Produce final frontend release report.
```

---

# 30. Final Frontend Definition of Done

The frontend is complete when:

```text
[ ] Dashboard works
[ ] Project creation works
[ ] Project loading works
[ ] Upload works
[ ] Canvas works
[ ] Page boundary works
[ ] Outside-page objects are filtered
[ ] Detection works
[ ] Manual correction works
[ ] UI tree works
[ ] Detection Inspector works
[ ] Geometry Inspector works
[ ] Structure Inspector works
[ ] Style Inspector works
[ ] Content Inspector works
[ ] History works
[ ] HTML generation is visible
[ ] CSS generation is visible
[ ] Monaco editing works
[ ] Version creation works
[ ] Version activation works
[ ] Live preview works
[ ] Desktop/tablet/mobile preview works
[ ] Export works
[ ] API service layer is stable
[ ] Loading/error/retry UX is acceptable
[ ] Preview security remains intact
[ ] Playwright golden path passes
[ ] full regression checklist passes
[ ] final demo is reproducible
```

---

# 31. Final Frontend Architecture

```text
                         Sketch2UI Web App
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
             Dashboard                     ProjectWorkspace
                                               │
                  ┌────────────────────────────┼─────────────────────────────┐
                  │                            │                             │
               UI Tree                     Canvas                        Inspector
                  │                            │                             │
                  │                     ┌──────┼──────┐                      │
                  │                     │      │      │                      │
                  │                   Page  Detection  Selection          Groups
                  │                 Boundary  Overlay                      │
                  │                                                        ├ Detection
                  │                                                        ├ Geometry
                  │                                                        ├ Structure
                  │                                                        ├ Style
                  │                                                        ├ Content
                  │                                                        └ History
                  │
                  └──────────────────────┬─────────────────────────────────┘
                                         │
                                  Generated HTML/CSS
                                         │
                                  ┌──────┴───────┐
                                  │              │
                                CodePanel      Preview
                                  │              │
                                Versions     sandboxed iframe
                                  │
                                Export
```

The chain of truth is:

```text
Source Sketch
   ↓
Effective Detections
   ↓
UI Tree
   ↓
Generated HTML/CSS
   ↓
Active CodeVersion
   ↓
Preview
   ↓
Export
```

Every frontend edit must preserve that chain.

---

# 32. Final Recommendation

Do not make the frontend larger merely because more features are possible.

The verified project already has the core frontend pipeline and, after the recent work, has a working golden-path Playwright test. The real PostgreSQL regression has also exercised the frontend-visible workflow all the way through detection, Inspector overrides, version activation, preview and export. fileciteturn6file1L107-L141 fileciteturn5file8L642-L654

The correct remaining frontend strategy is:

```text
STABILIZE
   ↓
SYNCHRONIZE
   ↓
TEST
   ↓
POLISH
   ↓
FREEZE
```

not:

```text
ADD MORE FEATURES
   ↓
REWRITE UI
   ↓
RISK REGRESSIONS
```

The project regression checklist is the authoritative release gate. It specifically requires the complete sketch → detect → correct → generate → preview → export workflow and its preservation checks. fileciteturn5file7L544-L548

---

# 33. Final Claude Code Phase Report Format

After every frontend phase, Claude Code should report:

```text
FRONTEND PHASE REPORT

Phase:
Status:

Files changed:
Files added:
Files removed:

Existing behavior preserved:

Frontend behavior added/fixed:

API calls affected:

State affected:

Tests:
- npm run test
- npm run test:py
- npm run build
- npm run typecheck
- Playwright

Regression checklist:
- passed
- failed
- n/a

Known limitations:

Next frontend phase:
```

Do not allow Claude Code to automatically continue to another major frontend phase if a P0 regression exists.

---

# 34. Immediate Next Frontend Action

Because the current phase log already shows the core frontend features and a Playwright golden path, the next action should **not** be another large feature build.

Run the current regression and then audit the frontend around the latest Postgres runtime:

```text
Postgres-backed API
      ↓
React frontend
      ↓
real CV detection
      ↓
Inspector
      ↓
preview
      ↓
export
```

The latest real regression already exercised this flow successfully, including the four override groups. fileciteturn5file8L642-L654

Therefore the immediate frontend goal is:

```text
prove it remains stable
→ fix only defects
→ expand only high-value tests
→ freeze
```

