---
title: "Sketch2UI — Claude Code Phase-by-Phase Execution Plan"
project: "Sketch2UI"
status_basis: "PROJECT_STATUS.md"
status_date: "2026-08-24"
purpose: "Complete the current Sketch2UI implementation safely using Claude Code"
minimum_length: "10,000+ words"
---

# Sketch2UI — Claude Code Phase-by-Phase Execution Plan

> **Execution principle:** This plan starts from the **actual current repository state**, not from the original project proposal. The current project already has the core sketch → detect → correct → generate → preview → export pipeline, a Style + Content inspector, versioned HTML/CSS editing, dataset tooling, and automated boundary-parity tests. The highest-risk unfinished areas are the lightweight detector quality, persistence, durable jobs, inspector completion, and production hardening. fileciteturn0file0L18-L29

## How to use this document

This is an execution playbook for **Claude Code**, not a fresh architecture proposal. Each phase has:

- objective;
- exact repository areas to inspect;
- implementation tasks;
- Claude Code execution instructions;
- verification commands;
- acceptance criteria;
- stop conditions;
- risks;
- expected artifacts.

**Critical rule:** Claude Code must inspect the repository before changing anything. It must preserve the already-working core pipeline and treat `PROJECT_STATUS.md` as the current baseline. The existing system has already implemented all 12 practical build-order steps from project CRUD through export. fileciteturn0file0L40-L55

---

# 0. Current-State Baseline — Do Not Skip

Before implementing anything, Claude Code must establish a reproducible baseline.

## 0.1 What is already working

The current project already has:

1. Project CRUD.
2. Image upload.
3. Annotation canvas.
4. Page-boundary detection/manual adjustment.
5. YOLO-based detection integration.
6. Detection correction.
7. UI-IR/layout reconstruction.
8. HTML generation.
9. CSS generation.
10. Sandboxed live preview.
11. Immutable code versions.
12. ZIP export. fileciteturn0file0L42-L55

The project also has:

- editable Monaco code editor;
- code validation shared by browser/API/evaluation;
- Style inspector;
- Content inspector;
- dataset export/import tooling;
- active-learning report;
- benchmark/evaluation harness;
- explicit training approval;
- TypeScript/Python boundary-parity tests. fileciteturn0file0L57-L97

## 0.2 What is not production-ready

The detector is explicitly a smoke test:

- 156 training images;
- 16 of 41 taxonomy classes;
- several weak classes;
- current model is YOLOv8-nano fine-tuning rather than literal YOLOv5;
- benchmark status is explicitly `"smoke_test"`. fileciteturn0file0L102-L118

Persistence is still JSON, not Postgres/Prisma, and Redis/BullMQ are provisioned but not actually connected. fileciteturn0file0L120-L129

Auth, multi-page projects, camera capture, perspective correction, reusable component palette, correction history/audit log, V2 capabilities, V3 research capabilities, cloud deployment, backup/recovery, CI/CD, and real observability are not implemented. fileciteturn0file0L134-L177

The Inspector has Style and Content, but editable Detection, Geometry, and Structure groups are still missing. fileciteturn0file0L182-L197

The current documented next priorities are:

1. Geometry + Structure inspector.
2. More training data + `v1.1.0`.
3. Explicit auth decision.
4. Postgres/Prisma. fileciteturn0file0L202-L218

---

# 1. Master Execution Strategy

Claude Code must work in phases, with a verification gate between phases.

## Phase sequence

```text
PHASE 0  Baseline / safety lock
   ↓
PHASE 1  Geometry Inspector
   ↓
PHASE 2  Structure Inspector
   ↓
PHASE 3  Detection Inspector
   ↓
PHASE 4  Correction history + audit trail
   ↓
PHASE 5  Dataset expansion + annotation quality
   ↓
PHASE 6  YOLO model v1.1.0
   ↓
PHASE 7  Model integration + benchmark gate
   ↓
PHASE 8  PostgreSQL + Prisma migration
   ↓
PHASE 9  Redis + durable background jobs
   ↓
PHASE 10 Auth / workspace security
   ↓
PHASE 11 Multi-page projects
   ↓
PHASE 12 Camera + perspective correction
   ↓
PHASE 13 Component palette + visual editing
   ↓
PHASE 14 Frontend automated tests + E2E
   ↓
PHASE 15 CI/CD + observability + backup
   ↓
PHASE 16 Performance + security hardening
   ↓
PHASE 17 Final product integration
   ↓
PHASE 18 Evaluation + academic evidence
   ↓
PHASE 19 Release candidate
```

Do not automatically implement V2/V3 research features before the core V1 quality gates are closed.

---

# 2. Claude Code Operating Rules

Claude Code should follow these rules on every phase.

## Rule 1 — Inspect before editing

Before making modifications:

```bash
git status
git branch --show-current
find . -maxdepth 2 -type f | sort | head -n 300
```

Then inspect the relevant files.

For TypeScript:

```bash
find apps packages scripts -type f | sort
```

For Python:

```bash
find services/cv-worker -type f | sort
```

For ML:

```bash
find ml scripts docs -type f | sort
```

Never infer file names that are not actually present.

## Rule 2 — Preserve working behavior

Do not rewrite:

- `packages/codegen/src/layout.ts`;
- `packages/codegen/src/html.ts`;
- `packages/codegen/src/css.ts`;
- existing versioning;
- export flow;
- boundary parity;
- existing Style/Content override behavior;

unless the current implementation requires a targeted change.

The goal is incremental completion, not architectural churn.

## Rule 3 — Read the local documentation

Claude Code must read:

```text
PROJECT_STATUS.md
README.md
relevant module README files
package.json
docker-compose.yml
```

before beginning.

## Rule 4 — One concern per change

Prefer small changes such as:

```text
Add geometry override types.
Add geometry API.
Add geometry inspector.
Add geometry generation integration.
Add tests.
```

rather than one giant uncontrolled rewrite.

## Rule 5 — Test after every logical slice

Never wait until the end of a phase to discover that the API or frontend broke.

## Rule 6 — Do not claim success without evidence

Claude Code must report:

- command executed;
- result;
- tests passed;
- files changed;
- known limitations.

## Rule 7 — Preserve the source of truth

The current project status is verified against the actual codebase. fileciteturn0file0L7-L12

If the repository differs from `PROJECT_STATUS.md`, Claude Code must stop and reconcile the difference before implementing dependent phases.

---

# 3. Phase 0 — Baseline and Safety Lock

## Objective

Create a safe starting point so all future work can be measured against the current working prototype.

## Tasks

### 0.1 Create a feature baseline document

Create:

```text
docs/execution/
├── current-baseline.md
├── phase-log.md
└── regression-checklist.md
```

Record:

- current commit;
- Node version;
- Python version;
- package manager;
- test command;
- Python test command;
- build command;
- current model version;
- current dataset count;
- current taxonomy count.

### 0.2 Record working commands

Identify actual scripts from `package.json`.

Do not invent commands.

Expected categories:

```bash
npm run test
npm run test:py
npm run build
npm run dev
```

Use the exact scripts actually present.

### 0.3 Create a regression checklist

At minimum verify:

```text
[ ] project create
[ ] image upload
[ ] manual box creation
[ ] page boundary
[ ] auto detection
[ ] manual correction
[ ] UI tree
[ ] HTML generation
[ ] CSS generation
[ ] live preview
[ ] code edit
[ ] version activation
[ ] export ZIP
[ ] Style inspector
[ ] Content inspector
```

### 0.4 Git safety

Claude Code should:

```bash
git status --short
git diff --stat
git log -5 --oneline
```

Create a dedicated working branch.

Recommended:

```text
feat/complete-project
```

or a series of smaller feature branches if the repository workflow prefers it.

## Acceptance criteria

- Repository builds.
- Existing tests pass.
- Baseline demo works.
- No unexplained working-tree changes.
- Baseline commit/tag exists.

## Stop condition

If the existing application cannot start or the baseline cannot be reproduced, stop. Do not begin feature work until the baseline problem is understood.

---

# 4. Phase 1 — Complete Geometry Inspector

The status document identifies Geometry as one of the immediate missing Inspector groups. fileciteturn0file0L186-L210

## Objective

Let the user edit:

- X;
- Y;
- width;
- height.

for a selected detection/UI node.

## Important design decision

Existing Style and Content overrides are keyed to **detection UUID**, because UI-IR node IDs can shift between generations. fileciteturn0file0L64-L70

Geometry should follow the same identity pattern.

## Tasks

### 1.1 Inspect current detection model

Claude Code should locate:

```text
Detection
bbox
source
confidence
id
```

and determine whether the stored bbox is already normalized.

Do not create a second coordinate format.

### 1.2 Define geometry override type

Create something conceptually like:

```ts
type GeometryOverride = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};
```

Use normalized coordinates if that is the current canonical representation.

### 1.3 Validate geometry

Rules:

```text
x >= 0
y >= 0
width > 0
height > 0
x + width <= 1
y + height <= 1
```

Allow a small floating-point tolerance if needed.

### 1.4 API

Implement:

```http
GET    /projects/:projectId/geometry-overrides
PUT    /projects/:projectId/geometry-overrides/:detectionId
DELETE /projects/:projectId/geometry-overrides/:detectionId
```

### 1.5 Codegen integration

Add:

```text
raw detections
    ↓
layout
    ↓
geometry overrides
    ↓
UI-IR
    ↓
HTML/CSS
```

Do not mutate the original detection.

### 1.6 Inspector

Add a Geometry section:

```text
Geometry
---------
X
Y
Width
Height

[Apply]
[Reset]
```

### 1.7 Canvas synchronization

When Geometry is applied:

1. save override;
2. regenerate code;
3. update preview;
4. move visual detection box;
5. keep source sketch unchanged.

### 1.8 Testing

Test:

- valid geometry;
- negative geometry rejection;
- out-of-page rejection;
- override persistence;
- deletion;
- regeneration;
- preview/export correctness.

## Claude Code prompt for Phase 1

```text
Read PROJECT_STATUS.md first. Inspect the existing Detection model, Style override architecture, Content override architecture, UI-IR, InspectorPanel, and code-generation pipeline. Implement ONLY the missing Geometry inspector group using the same detection-UUID keyed pattern already used by Style and Content overrides. Do not rewrite working layout/html/css generation. Add validated GET/PUT/DELETE geometry override API routes, frontend Inspector controls for x/y/width/height, visual synchronization with the detection overlay, code-generation integration, and tests. Before editing, show me the exact files and architecture you found. After implementation, run the relevant TypeScript tests, build, and a focused integration test. Report every changed file and any remaining limitations.
```

## Gate

Do not begin Phase 2 until:

```text
Geometry edit works
Geometry persists
Preview updates
Export reflects geometry
All existing tests pass
```

---

# 5. Phase 2 — Complete Structure Inspector

## Objective

Implement:

- parent;
- display order;
- re-parenting.

The current system already infers parents using bbox containment and row grouping, but user editing of Structure is not built. fileciteturn0file0L49-L50

## 2.1 Structure data

A node needs:

```text
nodeId
parentId
displayOrder
```

Be careful: the UI-IR node ID is generation-specific. Structure overrides should therefore be attached to stable detection IDs where possible.

## 2.2 Structure override

Conceptually:

```ts
type StructureOverride = {
  parentDetectionId?: string | null;
  displayOrder?: number;
};
```

Special value:

```text
null
```

should mean root-level placement.

## 2.3 Inspector UI

```text
Structure
---------
Parent
[ dropdown ]

Display order
[ 1 ]

[Apply]
[Reset]
```

## 2.4 Tree drag-and-drop

Allow:

```text
drag child
→ drop on valid container
```

Examples:

```text
button → card
text → section
nav_item → navbar
```

Prevent invalid relationships where practical.

## 2.5 Structural validation

Warn or reject cases such as:

```text
navbar inside button
footer inside card
page inside button
```

The exact rules should match the project taxonomy and existing layout logic.

## 2.6 Rebuild tree

Provide:

```text
Rebuild Automatically
```

but distinguish it from user overrides.

Recommended behavior:

```text
auto inferred tree
+
user structure overrides
=
effective tree
```

A rebuild should not erase manual changes unless the user explicitly chooses “Reset Structure Overrides”.

## Claude Code prompt

```text
Read the current PROJECT_STATUS.md and inspect layout.ts, UI-IR schemas, tree UI, detection models, and existing style/content override patterns. Implement the missing Structure inspector group: parent selection, display order, and re-parenting. Use stable detection UUIDs for persistence where possible. Preserve the current automatic containment/row grouping algorithm. Introduce explicit manual structure overrides that are applied after automatic inference. Add tree drag-and-drop only if it can be implemented without breaking the existing tree. Add validation for illegal parent-child relationships. Add tests for persistence, re-parenting, ordering, reset, and regeneration. Do not rewrite unrelated code.
```

## Gate

The same selected node must remain linked across:

```text
canvas
tree
inspector
generated UI-IR
preview
```

---

# 6. Phase 3 — Complete Detection Inspector

## Objective

Implement the final missing Inspector group:

```text
class
confidence
model
source
```

## 3.1 Editable class

The user should be able to change:

```text
image → card
text → heading
button → link
```

without creating duplicate records.

## 3.2 Confidence

Confidence should normally be read-only for model detections.

Do not let users falsify the model's confidence.

Instead provide:

```text
Model confidence: 0.82
```

and:

```text
Source: manual
```

after correction.

## 3.3 Source

Show:

```text
model
manual
```

If an inference result is edited, preserve the current documented behavior: editing a model detection changes `source` to `manual`. fileciteturn0file0L48-L50

## 3.4 Model version

Display:

```text
ui-detector-v1.0.0
```

or the current registered model identifier.

This is valuable for reproducibility.

## Acceptance

Inspector becomes complete:

| Group | Status |
|---|---|
| Style | Done |
| Content | Done |
| Detection | Done |
| Geometry | Done |
| Structure | Done |

---

# 7. Phase 4 — Correction History and Audit Trail

## Objective

Make user corrections traceable and useful for future training.

Current training already supports explicit approval and snapshots a sketch's current boxes as ground truth. fileciteturn0file0L84-L92

The next level is to record how the correction happened.

## 4.1 Correction record

Store:

```text
correctionId
projectId
detectionId
timestamp
oldClass
newClass
oldBBox
newBBox
oldParent
newParent
oldOrder
newOrder
user/source
reason
```

## 4.2 Correction types

```text
class_changed
bbox_changed
parent_changed
order_changed
ignored
created
deleted
```

## 4.3 Audit UI

Optional but useful:

```text
History
--------
10:22  Button class changed
10:24  Geometry updated
10:26  Parent changed to hero_section
```

## 4.4 Training integration

When approved:

```text
source image
+
accepted annotations
+
corrections
→
training sample
```

The existing `corr_` naming convention should be preserved. fileciteturn0file0L89-L92

## Gate

A corrected sample must be exportable without modifying original source data.

---

# 8. Phase 5 — Dataset Expansion and ML Quality Program

This is the highest-value machine-learning phase because the current detector is explicitly marked as a smoke test. fileciteturn0file0L106-L118

## Objective

Move from:

```text
156 images / 16 classes / smoke test
```

to a defensible model release.

## 5.1 First action

Run the existing active-learning report:

```text
npm run report:active-learning
```

or the exact documented script if the package defines another command.

Do not invent the command.

Capture its output.

## 5.2 Categorize data gaps

Create a matrix:

```text
Class
Train count
Val count
Test count
AP@0.5
Confusion
Priority
```

### Priority levels

**P0**

- low AP;
- high user importance;
- high frequency.

**P1**

- medium AP;
- high visual value.

**P2**

- low frequency;
- optional.

## 5.3 Do not blindly train all 41 classes

The current model deliberately uses 16 classes from a 41-class taxonomy. fileciteturn0file0L113-L115

Before expanding to 41, verify every class has:

- definition;
- positive examples;
- negative examples;
- enough images;
- annotation consistency.

## 5.4 Dataset quality checks

Automate:

```text
invalid labels
duplicate images
zero-area boxes
unknown classes
class imbalance
train/test leakage
boxes outside image
```

## 5.5 Hard negatives

Prioritize images containing:

- external handwritten notes;
- arrows outside page;
- measurements;
- labels outside page;
- page title above boundary;
- notes beside page.

These are especially relevant because page-aware filtering is a core product requirement.

## 5.6 Ground-truth policy

Keep the user's original image.

Do not erase outside annotations.

The training annotation should contain only accepted webpage components.

## 5.7 Dataset version

Create:

```text
dataset-v1.1
```

with:

```text
manifest
classes.txt
counts
split
source provenance
annotation guide version
```

---

# 9. Phase 6 — Train YOLO Release v1.1

## Important project-status fact

The current model is `yolov8n.pt` fine-tuned, while the project title says YOLOv5 tiny. fileciteturn0file0L113-L116

Claude Code must not silently replace the model architecture.

The implementation decision must be explicit:

### Option A — Keep lightweight YOLOv8-nano

Reason:

- current pipeline already works;
- detector is already integrated;
- migration risk is lower.

### Option B — Train literal YOLOv5 tiny/small variant

Reason:

- aligns exactly with original project specification.

### Required decision

Before Phase 6, create:

```text
docs/ml/model-decision.md
```

recording:

- current model;
- target model;
- reason;
- trade-offs;
- inference API compatibility.

## 6.1 Training protocol

Claude Code should inspect the actual current training scripts before altering them.

Do not assume file names.

Run:

```text
dataset validation
→ baseline evaluation
→ train v1.1
→ validate
→ test
→ compare against v1.0 baseline
```

## 6.2 Promotion rule

A new model must not become the active production model merely because it has a newer version.

Require:

```text
overall metrics ≥ baseline
AND
critical class metrics not materially worse
AND
page boundary false-positive behavior acceptable
AND
inference latency acceptable
```

## 6.3 Required artifacts

```text
weights
metrics.json
classes.txt
dataset version
training config
evaluation report
sample predictions
confusion matrix
```

## Claude Code prompt

```text
Study the existing ML scripts, dataset structure, model registry, metrics, and evaluation harness before editing. The current detector is explicitly a smoke test: 156 images, 16/41 classes, and the registered model is YOLOv8-nano rather than literal YOLOv5. Do not silently change architectures. First write docs/ml/model-decision.md comparing keeping the current lightweight model versus moving to the exact YOLOv5 target. Then expand the dataset based on the existing active-learning report, validate labels, train a candidate v1.1 model, evaluate it against the existing baseline JSON, generate per-class metrics and qualitative predictions, and only register it if the defined promotion gate passes. Preserve v1.0.0 and make the new model reproducible.
```

---

# 10. Phase 7 — Model Integration and Regression Gate

## Objective

Make the improved model safe to use in the product.

## Tasks

### 7.1 Model registry

Add fields if missing:

```text
model version
architecture
weights path
classes
dataset version
metrics
status
created at
```

Statuses:

```text
trained
evaluated
approved
active
retired
```

### 7.2 A/B comparison

Provide an evaluation command that can compare:

```text
v1.0.0
v1.1.0
```

on identical benchmark images.

### 7.3 UI warning

If model status is smoke test:

```text
Experimental
```

If approved:

```text
Validated
```

Do not hide uncertainty.

## 7.4 Regression benchmark

Existing evaluation writes baseline JSON. fileciteturn0file0L89-L90

Build a gate around that artifact.

---

# 11. Phase 8 — PostgreSQL + Prisma Migration

The current JSON store is a deliberate stand-in but is a real scalability and consistency limitation. fileciteturn0file0L120-L124

## Objective

Move persistence from:

```text
apps/api/data/store.json
```

to:

```text
PostgreSQL + Prisma
```

without changing the domain behavior.

## 8.1 Critical rule

Do not rewrite route behavior.

The current JSON store deliberately exposes module-level functions so it can be swapped. fileciteturn0file0L122-L123

Use that abstraction.

## 8.2 Steps

### Step A

Create Prisma schema.

Entities likely include:

```text
Project
Detection
Job
CodeVersion
StyleOverride
ContentOverride
Asset
TrainingSample
Boundary
```

Use the actual current domain models as source of truth.

### Step B

Add migration.

### Step C

Create Prisma repository implementation.

### Step D

Add repository interface.

Example:

```ts
interface ProjectRepository {
  create(...)
  findById(...)
  list(...)
  update(...)
  delete(...)
}
```

### Step E

Swap dependency injection.

### Step F

Create migration script from JSON.

### Step G

Run parity tests.

Before:

```text
JSON result
```

After:

```text
Postgres result
```

must be structurally equivalent.

## 8.3 Transaction boundaries

Use transactions around:

```text
save detection set
save code version
activate version
delete project
create training snapshot
```

## 8.4 Data integrity

Add foreign keys.

Prevent:

```text
detection → missing project
override → missing detection
code version → missing project
```

## 8.5 Indexes

At minimum index:

```text
project_id
detection.project_id
code_version.project_id
job.project_id
```

## 8.6 Migration acceptance

The application must work with Postgres while the JSON store can remain available only as a migration/import tool, not as runtime storage.

---

# 12. Phase 9 — Redis + Durable Background Jobs

The current implementation is in-process and can orphan jobs after restart. fileciteturn0file0L126-L130

## Objective

Move detection jobs to a durable queue.

## 9.1 Queue architecture

```text
API
 ↓
Redis
 ↓
Worker
 ↓
Database
```

## 9.2 Job states

```text
queued
processing
completed
failed
cancelled
```

## 9.3 Job payload

```json
{
  "jobId": "...",
  "projectId": "...",
  "assetId": "...",
  "modelVersion": "...",
  "operation": "detect"
}
```

## 9.4 Idempotency

If a job retries:

```text
do not duplicate detection records
```

Use job ID/result versioning.

## 9.5 Worker isolation

The Node process should not load the Python model.

The Python worker should handle inference only.

## 9.6 Progress

Polling can remain initially because it already works.

Only after durable jobs are stable should you consider SSE/WebSockets.

## 9.7 Failure handling

Examples:

```text
image decode failed → permanent failure
model file missing → permanent/config failure
Redis timeout → retry
temporary storage failure → retry
worker restart → queue re-delivery
```

## Gate

Kill/restart worker or API during a detection job.

Verify the job eventually completes or transitions to a deterministic failed state.

---

# 13. Phase 10 — Authentication and Workspace Security

The current API has no auth gate and any reachable client can act on any project. fileciteturn0file0L44-L44

## Objective

Introduce lightweight accounts without overengineering.

## 10.1 User model

```text
User
- id
- email
- passwordHash
- name
- role
- createdAt
- updatedAt
```

## 10.2 Roles

For MVP:

```text
user
admin
```

## 10.3 Auth flow

```text
register
→ login
→ session
→ API authorization
```

Prefer secure HTTP-only cookies for a normal web application.

## 10.4 Project ownership

Every project must have:

```text
ownerId
```

All project queries must scope by owner unless the user is admin.

## 10.5 Migration concern

Existing single-user projects have no owner.

Create a migration:

```text
legacy workspace owner
```

or explicitly reassign existing projects to a seeded admin user.

Do not silently make all projects visible to every new account.

## 10.6 Security tests

Verify:

```text
User A cannot GET User B project
User A cannot PUT User B detection
User A cannot delete User B project
```

---

# 14. Phase 11 — Multi-Page Projects

## Objective

Support:

```text
Project
 ├ Page 1
 ├ Page 2
 └ Page N
```

This is useful for recipe and multi-screen sketches.

## 11.1 Data model

Create a `Page` concept:

```text
Page
- id
- projectId
- name
- order
- sourceAssetId
- boundary
- ...
```

Move page-specific data from Project scope to Page scope where required.

## 11.2 Frontend

Add a page navigator:

```text
Pages
------
Page 1
Page 2
Page 3
+
```

## 11.3 Page isolation

Each page gets:

```text
source image
page boundary
detections
UI tree
code version
```

## 11.4 Export

Support:

```text
/pages/page-1/
pages/page-2/
```

or generate a simple multi-page site:

```text
index.html
page-2.html
page-3.html
```

## 11.5 Avoid premature routing complexity

First support multiple independent generated documents.

Navigation linking between pages can be added afterward.

---

# 15. Phase 12 — Camera Capture and Perspective Correction

The status identifies camera capture and true perspective warp as unimplemented. fileciteturn0file0L149-L151

## 12.1 Camera capture

Frontend:

```text
Use camera
Take photo
Retake
Use photo
```

Use browser camera APIs.

Do not require camera permission on page load.

Ask only when the user presses “Camera”.

## 12.2 Perspective correction

Implement:

```text
image
→ page boundary quadrilateral
→ four corner coordinates
→ OpenCV perspective transform
→ normalized page
→ YOLO
```

## 12.3 Important UX

Show:

```text
Original
Corrected
```

tabs.

Allow the user to adjust the four corners.

## 12.4 Acceptance

A photographed sketch at an angle should become a front-facing page before detection.

---

# 16. Phase 13 — Reusable Component Palette

## Objective

Add manual components that the detector may not have recognized.

## Palette

Start with the existing taxonomy:

```text
Section
Header
Navbar
Logo
Heading
Text
Image
Button
Card
Input
Form
List
Footer
Divider
```

## Drag/drop flow

```text
palette
 ↓
drop on canvas
 ↓
create manual detection/UI node
 ↓
update tree
 ↓
generate code
```

## Important rule

The palette must reuse the same internal component schema as detector-created nodes.

Do not create a second component representation.

---

# 17. Phase 14 — Frontend Automated Testing

The status explicitly says there are no React component tests or Playwright E2E tests yet. fileciteturn0file0L94-L98

## 14.1 Unit tests

Test:

- Inspector;
- ClassPicker;
- detection overlay;
- tree;
- preview configuration;
- upload validation;
- override form validation.

## 14.2 Integration tests

Test:

```text
select detection
→ inspector
→ apply style
→ generate
→ preview
```

## 14.3 E2E

Create one golden path:

```text
open app
create project
upload fixture
detect
select box
change content
change geometry
generate
preview
export
```

## 14.4 Regression fixture

Use one or more stable sketches stored under:

```text
tests/fixtures/
```

The E2E test should not depend on a live unstable ML prediction if deterministic testing is required.

Mock detection in UI E2E, and run separate ML integration tests against real models.

---

# 18. Phase 15 — CI/CD

## Objective

Every meaningful change should be validated automatically.

## CI stages

```text
Install
 ↓
Lint
 ↓
Type check
 ↓
Unit tests
 ↓
Python tests
 ↓
Build
 ↓
E2E
 ↓
ML smoke test
```

## ML smoke test

Do not retrain on every CI run.

Instead verify:

- model artifact exists;
- model loads;
- inference executes on a tiny fixture;
- output schema is valid.

## Deployment

Only deploy after CI passes.

---

# 19. Phase 16 — Observability and Backup

Current observability is only ad-hoc logging. fileciteturn0file0L174-L177

## 16.1 Correlation IDs

Every API request:

```text
requestId
```

Every background job:

```text
jobId
```

Log both.

## 16.2 Stage timing

Record:

```text
upload
preprocess
page detection
model inference
postprocess
layout
code generation
export
```

## 16.3 Error classification

Use stable error codes:

```text
UPLOAD_INVALID
PAGE_NOT_FOUND
MODEL_LOAD_FAILED
INFERENCE_FAILED
LAYOUT_FAILED
CODEGEN_FAILED
EXPORT_FAILED
```

## 16.4 Backup

Back up:

```text
Postgres
uploaded images
approved dataset artifacts
model registry
```

Do not rely on one local JSON file anymore after migration.

---

# 20. Phase 17 — Security Hardening

## Uploads

Validate:

- size;
- MIME;
- extension;
- decode;
- dimensions.

Store generated filenames.

## Preview

Keep the current sandboxed strategy.

Do not introduce unrestricted JavaScript execution from generated/user content.

## Content overrides

Preserve current security rules for:

- `<`/`>` rejection;
- href allowlists.

Those validations are already implemented and verified. fileciteturn0file0L75-L82

Do not weaken them while adding more inspector fields.

## CSS overrides

Keep allowlists.

Do not turn style overrides into arbitrary CSS injection.

---

# 21. Phase 18 — Performance Optimization

## Objective

Ensure the application remains responsive as data and images grow.

### Frontend

Optimize:

- large SVG overlay rendering;
- image scaling;
- tree rendering;
- preview refresh;
- Monaco editor.

### API

Optimize:

- pagination;
- DB queries;
- asset metadata;
- job polling.

### ML

Keep model loaded in worker memory.

Measure:

```text
preprocessing ms
inference ms
postprocessing ms
```

### Large source images

Create:

```text
original
thumbnail
processing image
```

so the UI does not repeatedly render the full-resolution original.

---

# 22. Phase 19 — Final Product Integration

After each subsystem is separately stable, run the full path.

## Test case A — clean wireframe

```text
upload
→ page
→ detect
→ tree
→ code
→ preview
```

## Test case B — sketch with outside annotations

Verify:

```text
external notes visible in original
external notes NOT accepted as components
```

## Test case C — wrong detection

Verify:

```text
change class
→ source becomes manual
→ regenerate
→ preview correct
```

## Test case D — geometry edit

Verify:

```text
change box position
→ generated layout changes
→ preview changes
→ export changes
```

## Test case E — structure edit

Verify:

```text
move button from section A to card B
→ tree updates
→ generated HTML hierarchy updates
```

## Test case F — code edit

Verify:

```text
edit HTML/CSS
→ new code version
→ activate
→ preview/export reflect it
```

The code editor and immutable versioning behavior are already verified in the current project and must remain intact. fileciteturn0file0L57-L61

---

# 23. Claude Code Verification Protocol for Every Phase

Claude Code should finish each phase by producing a structured report.

Use:

```text
PHASE REPORT

Phase:
Goal:
Status:

Files added:
Files changed:
Files removed:

Tests:
- command:
- result:

Manual verification:
- scenario:
- result:

Database changes:
- migration:
- result:

API changes:
- routes:

Frontend changes:
- components:

ML changes:
- model/dataset:

Known limitations:

Next phase:
```

This makes the long implementation auditable.

---

# 24. Master Claude Code Prompt — Use at the Start of the Project

The following prompt should be placed in the project instructions for Claude Code.

```text
You are the senior implementation engineer responsible for completing the existing Sketch2UI repository.

PROJECT GOAL:
Complete Sketch2UI as a production-like academic prototype:
hand-drawn wireframe sketch → page boundary isolation → UI component detection → manual correction → layout/UI-IR reconstruction → HTML/CSS generation → live preview → export.

IMPORTANT:
The repository is NOT greenfield. A substantial working implementation already exists. You MUST inspect the repository and PROJECT_STATUS.md before making changes.

CURRENT STATUS:
- Core sketch → detect → correct → generate → preview → export pipeline already works.
- Style inspector works.
- Content inspector works.
- Monaco code editing and immutable code versions work.
- Dataset/export/evaluation/active-learning tooling exists.
- Boundary parity tests exist in TypeScript and Python.
- YOLO detector is experimental/smoke-test quality.
- Persistence is currently JSON.
- Detection jobs are currently in-process.
- Auth is not implemented.
- Multi-page projects are not implemented.
- Inspector Detection/Geometry/Structure groups are incomplete.
- V2 and V3 research features are not implemented.

ABSOLUTE RULES:
1. Read PROJECT_STATUS.md before any implementation.
2. Inspect actual source files before deciding architecture.
3. Never assume a file exists.
4. Never replace working modules with speculative rewrites.
5. Preserve existing Style and Content override behavior.
6. Preserve immutable CodeVersion behavior.
7. Preserve sandboxed preview security.
8. Preserve TypeScript/Python boundary-parity behavior.
9. Use small, reviewable changes.
10. Run tests after each logical change.
11. Do not claim completion without command evidence.
12. If repository behavior conflicts with PROJECT_STATUS.md, stop and report the discrepancy.
13. Do not start V2/V3 work until the core V1 gates are closed unless explicitly requested.
14. Do not silently change the ML architecture from the current model to YOLOv5 or vice versa. Document any model decision first.
15. Keep the original source sketch immutable.
16. External handwritten notes outside the page must never enter the accepted UI detection tree.
17. User corrections must be traceable and must not be overwritten by re-detection.
18. Generated code must come from a stable UI-IR, not directly from raw detector output.
19. Prefer deterministic geometry/layout rules before adding new machine-learning components.
20. Keep the project runnable after every phase.

EXECUTION METHOD:
For each phase:
A. inspect;
B. explain the intended files/change boundary;
C. implement;
D. test;
E. run build/type checks;
F. perform targeted manual verification;
G. produce a phase report;
H. wait for the next phase unless the requested execution mode explicitly allows continuing.

FIRST TASK:
Read:
- PROJECT_STATUS.md
- README.md
- package.json
- docker-compose.yml
- relevant source files for the current feature

Then produce:
1. current architecture summary;
2. current test commands;
3. exact missing files/features for Phase 1;
4. implementation plan for Phase 1 only;
5. no code changes until the inspection is complete.

PHASE ORDER:
0. baseline/safety lock
1. Geometry Inspector
2. Structure Inspector
3. Detection Inspector
4. correction history/audit
5. dataset expansion
6. model v1.1
7. model integration/regression gate
8. PostgreSQL + Prisma
9. Redis + durable jobs
10. auth/security
11. multi-page projects
12. camera + perspective correction
13. reusable component palette
14. frontend unit/E2E tests
15. CI/CD
16. observability/backup
17. performance/security hardening
18. final integration
19. evaluation/release candidate

For every phase, preserve existing functionality and prove it with tests.
```

---

# 25. Phase-by-Phase Claude Code Execution Prompts

## Prompt — Phase 0

```text
Start Phase 0 only.

Read PROJECT_STATUS.md completely. Inspect the repository, package scripts, build configuration, database configuration, docker-compose, frontend, API, Python worker, ML artifacts, tests, and current git state.

Do not modify application code yet.

Produce a baseline report containing:
- exact repository architecture;
- exact current commands;
- current model version;
- current dataset structure;
- current class taxonomy;
- current persistence mechanism;
- current job mechanism;
- current Inspector capabilities;
- current automated tests;
- current known gaps.

Then create only the documentation needed for the baseline and run the existing test/build commands.

Do not proceed to Phase 1 until the baseline is reproducible.
```

## Prompt — Phase 1

```text
Implement only Geometry Inspector.

First inspect the existing Style and Content override implementations and mirror their architecture.

Requirements:
- stable detection-UUID keyed geometry override;
- x/y/width/height;
- strict normalized validation;
- GET/PUT/DELETE API;
- Inspector controls;
- Apply/Reset;
- detection overlay synchronization;
- codegen integration;
- preview/export integration;
- unit/integration tests.

Do not redesign layout.ts, html.ts, or css.ts globally.
After implementation:
1. run all existing tests;
2. run focused geometry tests;
3. build frontend/API;
4. manually verify one real project.
Return a phase report.
```

## Prompt — Phase 2

```text
Implement only Structure Inspector.

Use manual structure overrides on top of automatic layout inference.

Support:
- parent selection;
- display order;
- re-parenting;
- reset;
- optional tree drag/drop.

Prevent invalid hierarchy relationships.

Do not discard existing automatic layout inference.

Write tests for:
- parent override;
- order;
- reset;
- regeneration;
- invalid parent.

Run all existing tests and build.
```

## Prompt — Phase 3

```text
Complete the Detection Inspector group.

Show:
- class;
- model confidence;
- model version;
- source.

Allow class edits but do not allow falsifying model confidence.

When a model detection is edited, preserve the existing source=manual behavior.

Add focused tests and ensure Detection, Geometry, Structure, Style, and Content can coexist on one selected node without state conflicts.
```

## Prompt — Phase 4

```text
Implement correction history.

Record class, geometry, structure, ignore/create/delete events with old/new values and timestamps.

Do not store only the final state; preserve enough information to understand how the user corrected the model.

Connect approved correction snapshots to existing training export behavior.

Add an optional history UI only after the data path works.
```

## Prompt — Phase 5

```text
Focus only on dataset quality.

Run the current active-learning report and inspect existing v1 dataset statistics.

Create a dataset quality report covering:
- images per split;
- objects per class;
- underrepresented classes;
- weak model classes;
- external-annotation hard negatives;
- duplicate/leakage risk.

Add or improve scripts for label validation and dataset statistics.

Do not retrain yet.
Do not change model weights yet.
```

## Prompt — Phase 6

```text
Train a candidate detector release.

Before training:
- inspect the current model architecture;
- inspect the existing training script;
- inspect data.yaml;
- inspect class mappings;
- inspect baseline metrics.

Do not silently switch from YOLOv8-nano to YOLOv5.
Write a model decision document first.

Train a candidate v1.1.
Generate reproducible metrics and qualitative outputs.
Compare against baseline.
Do not make v1.1 active automatically.
```

## Prompt — Phase 7

```text
Implement model release gating.

A model can become active only if:
- it loads successfully;
- class mapping is compatible;
- benchmark metrics pass;
- critical classes do not regress beyond the defined tolerance;
- inference latency is acceptable.

Add a model registry status if needed.
Keep old models immutable.
```

## Prompt — Phase 8

```text
Migrate runtime persistence from JSON to PostgreSQL using Prisma.

Do not rewrite route/module business logic unnecessarily.

Create repository interfaces where needed and preserve existing module contracts.

Create:
- Prisma schema;
- migrations;
- JSON-to-Postgres migration tool;
- parity verification;
- transactional writes;
- indexes.

Run the existing app against Postgres before removing JSON runtime use.
Keep JSON only as an import/migration mechanism.
```

## Prompt — Phase 9

```text
Move detection jobs from in-process execution to Redis/BullMQ or the project's selected durable queue.

Requirements:
- durable queue;
- retry policy;
- idempotency;
- explicit states;
- worker separation;
- startup resilience;
- no duplicate detections on retry.

Keep polling first.
Do not add WebSockets until the queue is stable.
```

## Prompt — Phase 10

```text
Add lightweight authentication.

Implement:
- registration;
- login;
- logout;
- current-user endpoint;
- secure password hashing;
- session or secure cookie strategy;
- project ownership;
- authorization middleware.

Existing legacy projects must be migrated to an explicit owner.

Add negative tests proving users cannot access each other's projects.
```

## Prompt — Phase 11

```text
Implement multi-page projects.

Introduce Page as a first-class entity.

Preserve one-page projects without requiring migration by users.

Each page must have its own:
- image;
- boundary;
- detections;
- UI tree;
- generated code.

Add page navigation and multi-page export.
```

## Prompt — Phase 12

```text
Implement camera capture and true perspective correction.

Camera:
- explicit user permission;
- capture;
- retake;
- use photo.

Perspective:
- page quad;
- four-corner editor;
- OpenCV perspective transform;
- corrected preview;
- inference on corrected image.

Preserve original image.
```

## Prompt — Phase 13

```text
Implement a reusable component palette using the same UI-IR component schema as detected elements.

Support:
- section;
- heading;
- text;
- image;
- button;
- card;
- input;
- form;
- footer;
- divider.

Dragging a component onto canvas must create a normal manual node compatible with the existing generation pipeline.
```

## Prompt — Phase 14

```text
Add frontend component tests and Playwright E2E.

Create a deterministic E2E fixture so the browser test does not depend on unstable real-time ML inference.

Test:
- project create;
- upload;
- selection;
- inspector edit;
- code generation;
- preview;
- export.

Keep ML validation separate from UI E2E.
```

## Prompt — Phase 15

```text
Implement CI/CD.

Run:
- lint;
- type-check;
- frontend tests;
- backend tests;
- Python tests;
- build;
- E2E;
- ML smoke inference.

Do not train the model in normal CI.

Add artifact handling for model registry and generated evaluation reports if appropriate.
```

## Prompt — Phase 16

```text
Implement production-like observability and backup.

Add:
- request correlation ID;
- job IDs;
- structured logging;
- stage duration;
- error codes;
- health endpoints;
- database backup procedure;
- upload/model artifact backup plan.

Do not introduce an unnecessary observability stack if simple structured logs are sufficient for this project.
```

## Prompt — Phase 17

```text
Run a full security and performance review.

Focus on:
- upload validation;
- preview sandbox;
- XSS/content override safety;
- CSS override injection;
- authorization;
- database concurrency;
- large image performance;
- SVG detection overlay performance;
- model worker memory;
- export safety.

Fix only evidence-based problems.
```

## Prompt — Phase 18

```text
Run the complete end-to-end integration suite.

Use:
- clean wireframe;
- sketch with external notes;
- complex card layout;
- form;
- two-page sample;
- manually corrected sample.

Verify:
upload → boundary → detection → correction → UI tree → HTML/CSS → preview → export.

Compare every result with the regression checklist.
```

## Prompt — Phase 19

```text
Prepare the release candidate.

Create:
- final evaluation report;
- model report;
- architecture diagram;
- API summary;
- database summary;
- known limitations;
- deployment instructions;
- demo script;
- benchmark results;
- final changelog.

Do not add new features after the release candidate unless they fix a release-blocking issue.
```

---

# 26. What Claude Code Must NOT Do

## Do not start with a massive rewrite

The current core pipeline already works end-to-end. fileciteturn0file0L20-L24

## Do not replace JSON with Prisma in one giant change

Use repository abstraction and parity tests.

## Do not retrain the model before examining the existing active-learning report

The report already exists and should drive data selection. fileciteturn0file0L86-L91

## Do not remove the Beta/experimental warning until model quality justifies doing so

The status explicitly says accuracy varies substantially by component type. fileciteturn0file0L115-L118

## Do not weaken boundary filtering

Boundary logic is intentionally duplicated in TypeScript and Python with parity fixtures. fileciteturn0file0L91-L92

## Do not allow re-detection to silently erase manual corrections

The current detection route already changes edited model detections to manual source. Preserve this behavior. fileciteturn0file0L48-L50

## Do not change version immutability

The existing implementation creates new code versions instead of mutating them. fileciteturn0file0L59-L61

---

# 27. Recommended Execution Order for the Actual Remaining Project

If the goal is **finish the project efficiently**, use this priority order:

```text
A. Safety baseline
B. Geometry Inspector
C. Structure Inspector
D. Detection Inspector
E. Correction history
F. Dataset quality
G. Model v1.1
H. Model regression gate
I. Postgres/Prisma
J. Durable jobs
K. Auth/security
L. Multi-page
M. Camera/perspective
N. Component palette
O. Tests
P. CI/CD
Q. Observability/backup
R. Performance/security hardening
S. Final integration
T. Evaluation/release
```

Do **not** prioritize:

```text
React export
Tailwind
OCR
layout transformer
multimodal model
collaboration
theme engine
```

until the above sequence is stable.

---

# 28. Definition of “Project Complete”

The project should be considered complete only when the following statements are true.

## Core conversion

A user can upload a hand-drawn wireframe and obtain a generated HTML/CSS webpage.

## Computer vision

The trained lightweight detector identifies the project's documented UI classes with measured validation performance.

## Page-aware behavior

External handwritten annotations outside the webpage are excluded from accepted detections.

## Manual correction

A user can correct:

- class;
- confidence/source metadata display;
- geometry;
- parent;
- display order;
- content;
- style.

## Layout

The system can reconstruct:

- sections;
- nesting;
- rows;
- columns;
- repeated cards;
- common layout modes.

## Generation

Generated HTML is valid enough for preview/export and uses semantic elements.

Generated CSS is maintainable and responsive.

## Preview

The result renders in an isolated live preview.

## Persistence

Project state is stored in a real database with safe concurrent behavior.

## Jobs

Long-running inference is durable and recoverable.

## Security

Users are correctly isolated and generated preview content cannot escape its sandbox.

## Evaluation

There is a repeatable benchmark and a documented model-release process.

---

# 29. Final Claude Code “Autopilot Supervisor” Prompt

Use this after the phase-specific prompts are understood.

```text
You are now the implementation supervisor for the Sketch2UI repository.

Your job is not to redesign the project. Your job is to complete it safely from its verified current state.

SOURCE OF TRUTH:
Read PROJECT_STATUS.md and the actual source tree. Treat the status document as a verified snapshot, but trust executable source behavior when checking current details. If the document and source disagree, report the discrepancy and update the plan before implementing.

PROJECT GOAL:
Complete a web application that converts a hand-drawn wireframe into HTML/CSS and a live preview using a lightweight UI object detector, while preserving page-boundary awareness, manual correction, UI-IR, versioning, export, and a future training feedback loop.

NON-NEGOTIABLE:
- Preserve working core pipeline.
- Preserve Style and Content override behavior.
- Preserve immutable CodeVersion behavior.
- Preserve preview sandbox.
- Preserve boundary TypeScript/Python parity.
- Preserve training approval workflow.
- Never silently destroy user corrections.
- Never make a model active without evaluation.
- Never make a database migration without a rollback/data-parity strategy.
- Never execute arbitrary generated code on the server.
- Never claim tests passed unless you actually ran them.

EXECUTION MODE:
For every phase:
1. inspect files;
2. identify exact change set;
3. list risks;
4. implement;
5. test;
6. build;
7. manually verify;
8. write phase report;
9. show git diff summary;
10. continue only when the phase acceptance criteria pass.

PHASE ORDER:
0 baseline
1 geometry inspector
2 structure inspector
3 detection inspector
4 correction history
5 dataset quality
6 model v1.1
7 model gate
8 postgres/prisma
9 redis durable jobs
10 auth
11 multi-page
12 camera/perspective
13 palette
14 tests
15 ci/cd
16 observability/backup
17 hardening
18 integration
19 release

WHEN YOU ENCOUNTER AN AMBIGUITY:
Do not guess when the decision can affect data, model compatibility, security, or user-visible behavior. Explain the ambiguity and choose the smallest reversible implementation.

WHEN YOU ENCOUNTER A FAILURE:
Do not patch blindly. Reproduce it, identify root cause, add a regression test, fix it, rerun the affected tests, then continue.

WHEN YOU ENCOUNTER A WORKING FEATURE:
Do not rewrite it merely to make the code look cleaner. Preserve behavior unless refactoring is necessary for the current phase.

DELIVERABLE:
At the end of each phase produce a concise machine-readable report plus a human-readable summary.

At final completion produce:
- implementation summary;
- architecture summary;
- feature matrix;
- model results;
- test results;
- known limitations;
- deployment instructions;
- final demo procedure.
```

# 30. Final Execution Checklist for You

Before giving Claude Code permission to implement the whole project, make sure the workflow is:

```text
[ ] Claude Code reads PROJECT_STATUS.md
[ ] Claude Code inspects actual source tree
[ ] Phase 0 baseline passes
[ ] Geometry completed
[ ] Structure completed
[ ] Detection inspector completed
[ ] Correction history completed
[ ] Dataset quality report completed
[ ] Model architecture decision documented
[ ] v1.1 model trained/evaluated
[ ] Model promotion gate passes
[ ] PostgreSQL migration passes parity tests
[ ] Durable jobs pass restart test
[ ] Auth/security tests pass
[ ] Multi-page passes
[ ] Camera/perspective passes
[ ] Component palette passes
[ ] React/RTL/Playwright coverage added where needed
[ ] CI passes
[ ] Backup tested
[ ] Observability available
[ ] Full end-to-end regression passes
[ ] Final benchmark recorded
[ ] Release candidate tagged
```

# 31. Final Recommendation

The current project is **not starting from zero**. It already has a working MVP/core pipeline and a meaningful V1 slice, including annotation, boundary handling, detection integration, UI-IR, HTML/CSS generation, preview, code versioning, export, dataset tooling, and Style/Content inspection. fileciteturn0file0L31-L33

Therefore the most effective Claude Code strategy is **completion and hardening**, not rebuilding.

The highest-value implementation path is:

```text
finish Inspector
        ↓
improve detector + dataset
        ↓
replace JSON with Postgres
        ↓
make jobs durable
        ↓
secure workspace
        ↓
add multi-page/input improvements
        ↓
test everything
        ↓
deploy/evaluate
```

The project should reach a stable release candidate before expanding into OCR, React/Tailwind generation, multimodal understanding, layout transformers, collaboration, or other V2/V3 research features.

---

# Appendix A — Detailed Baseline Commands


Claude Code should derive exact commands from the repository's package files, but the baseline process should always include the following categories:

### Git state

```bash
git status
git branch --show-current
git log -10 --oneline
git diff --stat
```

### Repository inventory

```bash
find apps -maxdepth 4 -type f | sort
find packages -maxdepth 4 -type f | sort
find services -maxdepth 5 -type f | sort
find scripts -maxdepth 4 -type f | sort
find ml -maxdepth 5 -type f | sort
```

### TypeScript dependencies and scripts

```bash
cat package.json
```

If there are package-level `package.json` files, inspect them too.

### Python environment

Inspect:

```text
requirements.txt
pyproject.toml
environment.yml
```

whichever actually exists.

### Docker

Inspect:

```bash
cat docker-compose.yml
find . -maxdepth 2 -type f -name 'Dockerfile*' -print
```

### Database

Search for the current persistence layer:

```bash
grep -R "jsonStore\|prisma\|postgres\|pg" apps packages --exclude-dir=node_modules
```

### Jobs

Search:

```bash
grep -R "detect.job\|bullmq\|redis\|queue" apps services packages --exclude-dir=node_modules
```

The baseline must not merely say “Postgres is present in Docker.” It must verify whether runtime application code actually connects to it. The current status shows that Postgres and Redis are provisioned but unused by `apps/api`. fileciteturn0file0L120-L129

### ML

Inspect:

```bash
find ml/models -maxdepth 4 -type f | sort
find ml/dataset -maxdepth 4 -type f | sort
```

Read:

```text
metrics.json
classes.txt
training scope documentation
evaluation baseline
```

The baseline should write down the exact architecture, not simply call it “YOLO tiny.”


# Appendix B — Geometry Phase Detailed Test Matrix


Geometry is the first major incomplete Inspector feature and should be completed before adding more advanced UX.

### Validation

Test:

```text
x=0
y=0
width=1
height=1
```

Expected: accepted.

Test:

```text
x=-0.01
```

Expected: rejected.

Test:

```text
width=0
```

Expected: rejected.

Test:

```text
x=0.8
width=0.3
```

Expected: rejected unless the application intentionally supports clipping; the default should be strict normalized geometry.

### Persistence

1. Detect element.
2. Apply geometry.
3. Reload project.
4. Inspect geometry.
5. Verify override persists.

### Generation

1. Change position.
2. Generate code.
3. Compare generated layout.
4. Open preview.
5. Export ZIP.
6. Verify exported page reflects geometry.

### Identity

Change detection set so UI-IR node numbering changes.

Verify the geometry override still applies to the original detection UUID.

This is important because existing Style overrides explicitly use detection UUIDs rather than unstable generation-local node IDs. fileciteturn0file0L64-L70

### Reset

Apply override.

Reset.

Verify:

```text
override removed
source detection returns
generation returns to automatic geometry
```

### Security

Geometry fields should accept only numeric normalized values, not raw CSS strings.


# Appendix C — Structure Phase Detailed Rules


The Structure inspector should not be implemented as arbitrary DOM editing. It should manipulate the project's UI-IR structure.

## Valid parent examples

```text
nav_item → navbar
button → card
card_title → card
card_text → card
card_button → card
heading → section
text → section
image → section
```

## Invalid or suspicious examples

```text
page → button
button → button
footer → button
navbar → image
```

The system should distinguish between:

```text
hard invalid
```

and:

```text
unusual but allowed
```

Do not over-constrain the user with a taxonomy that prevents legitimate layouts.

## Display order

Use an integer order.

Example:

```text
section
  child order 0: heading
  child order 1: text
  child order 2: button
```

When moving a child from order 0 to order 2, the other children should be normalized so there are no duplicate orders.

## Re-parenting

When a user re-parents a node:

1. update manual structure override;
2. keep source detection unchanged;
3. rebuild effective tree;
4. regenerate code;
5. preserve other manual overrides.

## Tree and canvas

The tree and canvas should always refer to the same stable detection identity.


# Appendix D — ML Dataset Execution Playbook


The detector is the main quality bottleneck. The current v1.0.0 is explicitly a smoke test, so the goal of the ML phase is not merely “train more.” It is to create a reproducible data-quality and model-evaluation loop.

## Step 1 — Inventory

Create a machine-readable table:

```text
image_id
split
source
width
height
class_count
annotation_count
external_annotations_present
page_boundary_quality
```

## Step 2 — Label statistics

For every class calculate:

```text
count
images containing class
mean box area
median box area
```

## Step 3 — Hard examples

Create buckets:

```text
small component
faint pencil
dark pencil
angled page
external notes
overlapping components
repeated cards
dense footer
mobile sketch
```

## Step 4 — Annotation review

Select random samples from each bucket.

## Step 5 — Data split

Do not randomly split duplicate or near-duplicate photos.

The test set should represent unseen drawings rather than another copy of the training sketch.

## Step 6 — Baseline

Always evaluate the existing v1.0.0 first.

## Step 7 — Intervention

Add only targeted data based on observed errors.

## Step 8 — Train

Run candidate.

## Step 9 — Evaluate

Compare the candidate against exactly the same benchmark as v1.0.0.

## Step 10 — Qualitative inspection

Open false-positive and false-negative images.

## Step 11 — Promotion

Only approve if the whole pipeline improves or at least does not regress on critical classes.


# Appendix E — PostgreSQL Migration Playbook


The migration should be incremental.

## Stage 1 — Schema discovery

Inspect the actual JSON store to identify:

- projects;
- jobs;
- detections;
- versions;
- overrides;
- assets.

Do not create a database schema based solely on the old proposal if current runtime objects have changed.

## Stage 2 — Prisma schema

Create tables that represent the current domain state.

## Stage 3 — Repository boundary

Current route modules should talk to repository/service functions rather than direct JSON implementation details.

## Stage 4 — Dual-read development mode

For a short transition period, it is acceptable to provide a migration verification mode:

```text
JSON result
Postgres result
compare
```

Do not run both as production sources of truth indefinitely.

## Stage 5 — Import

Run:

```text
json
→ validate
→ transform
→ transaction
→ postgres
```

## Stage 6 — Parity verification

Check counts:

```text
projects
detections
versions
overrides
assets
jobs
```

Then sample detailed records.

## Stage 7 — Switch runtime

Use Postgres as the single runtime source.

## Stage 8 — Backup

Before deleting or deprecating JSON runtime storage, preserve a backup artifact.

## Stage 9 — Regression

Run the entire existing test suite plus migration-specific tests.


# Appendix F — Durable Queue Playbook


Detection is the expensive operation and should be the first durable background job.

## Job creation

The API should:

1. validate project;
2. validate image asset;
3. create job row;
4. enqueue job;
5. return job ID.

## Worker

The worker should:

1. claim job;
2. load asset;
3. load model;
4. preprocess;
5. infer;
6. filter;
7. persist detections;
8. rebuild dependent state if appropriate;
9. mark complete.

## Crash behavior

If the worker stops after inference but before marking the job complete, the retry must not duplicate detections.

Use a job-scoped result identifier.

## Cancellation

Cancellation can be added later.

## Progress

The job record should store:

```text
stage
progress
startedAt
finishedAt
errorCode
```

## Monitoring

Log:

```text
jobId
projectId
modelVersion
stage
elapsedMs
```

The existing implementation already has a startup orphan failure mechanism. Durable queues should replace that mitigation rather than deleting it without understanding why it exists. fileciteturn0file0L128-L130


# Appendix G — Authentication Migration Playbook


Authentication should be introduced only after the current single-user behavior is understood.

## Legacy state

Today there is no user/account layer and project routes are not auth-gated. fileciteturn0file0L44-L44

## Migration

Create a system owner:

```text
legacy-owner@local
```

or a seeded admin configured through environment variables.

Assign all legacy projects to that owner.

## Session

Use secure cookies.

Configure:

```text
HttpOnly
Secure in production
SameSite appropriate to deployment
```

## Authorization

Every route that takes a project ID should:

```text
authenticate
→ load project
→ verify owner/admin
→ continue
```

Do not rely on frontend filtering.

## Tests

Negative tests are mandatory.

```text
GET foreign project → 404 or 403
PATCH foreign project → 404 or 403
DELETE foreign project → 404 or 403
GET foreign asset → denied
```

## Admin

Admin should be able to inspect model versions and dataset approvals without becoming a superuser over application code execution.


# Appendix H — Multi-Page Migration Details


Multi-page support should not break the existing one-page UX.

## Backward compatibility

A project created before multi-page support can automatically receive:

```text
Page 1
```

linked to its existing source asset and detections.

The old route:

```text
/projects/:id
```

continues to open the first page.

## New structure

```text
Project
  pages[]
```

## Page-level operations

```text
upload page
detect page
edit page
generate page
preview page
export page
```

## Project-level operations

```text
rename project
duplicate project
delete project
export entire site
```

## Code

Generated files:

```text
index.html
about.html
contact.html
assets/
styles.css
```

Navigation can use relative links.

## Detection

Each page maintains independent normalized coordinates.

Do not mix page coordinate systems.


# Appendix I — End-to-End Regression Scenarios


Create a permanent set of regression scenarios.

### Scenario 1 — Simple landing page

Expected:

```text
page
header
logo
navbar
hero
heading
text
button
section
footer
```

### Scenario 2 — Car marketplace

Expected:

```text
header
navbar
hero
image
heading
select
button
cards
icons
footer
input
social_icon
```

### Scenario 3 — Recipe page

Expected:

```text
header
hero
section
image
heading
list
button
nutrition
product images
```

### Scenario 4 — Annotated sketch

Expected:

```text
external note rejected
internal button accepted
```

### Scenario 5 — Two-page recipe

Expected:

```text
Page 1
Page 2
```

### Scenario 6 — Correction

Change one class and confirm:

```text
source = manual
```

### Scenario 7 — Version activation

Generate version A.

Edit code.

Generate version B.

Activate A.

Verify preview and export return to A.

### Scenario 8 — Geometry

Move one button.

Generate.

Verify preview.

### Scenario 9 — Structure

Move one button into a card.

Generate.

Verify HTML nesting.

### Scenario 10 — Server restart

During a background job, restart the server/worker and verify durable behavior after queue migration.


# Appendix J — Final Release Gate


The Release Candidate should not be declared complete based on one successful demonstration.

## Product gate

All P0 features work.

## ML gate

Model is not labeled `smoke_test` unless explicitly documented as the final project limitation. A production-like release should have a named benchmark and defensible metrics.

## Data gate

Training and test sets are documented and reproducible.

## Persistence gate

Runtime uses Postgres.

## Job gate

Detection uses durable jobs.

## Security gate

Authorization and preview isolation are verified.

## Test gate

Unit, integration, and at least one full E2E workflow pass.

## Operational gate

A new developer can:

```text
clone
install
configure
migrate
start
run tests
run demo
```

using the documentation.

## Documentation gate

The final project must contain:

```text
README
architecture
ML training guide
annotation guide
API guide
database guide
deployment guide
evaluation report
known limitations
```

## Demo gate

The final presentation should demonstrate:

```text
sketch
→ page boundary
→ YOLO detections
→ manual corrections
→ UI tree
→ generated HTML/CSS
→ live preview
→ export
```

This is the central value chain of Sketch2UI.



# Appendix K — Phase Completion Matrix

| Phase | Main deliverable | Primary verification |
|---|---|---|
| 0 | Safe reproducible baseline | existing tests + demo |
| 1 | Geometry Inspector | geometry unit + integration tests |
| 2 | Structure Inspector | re-parent/order tests |
| 3 | Detection Inspector | class/source/model tests |
| 4 | Correction audit | correction persistence |
| 5 | Dataset quality | data validation report |
| 6 | Model v1.1 | benchmark comparison |
| 7 | Model promotion | release gate |
| 8 | Postgres | migration parity |
| 9 | Durable jobs | restart/retry test |
| 10 | Auth | cross-user security tests |
| 11 | Multi-page | multi-page E2E |
| 12 | Camera/perspective | corrected-image test |
| 13 | Palette | manual component E2E |
| 14 | Frontend tests | Playwright + RTL |
| 15 | CI/CD | pipeline green |
| 16 | Observability/backup | restore/log test |
| 17 | Hardening | security/performance review |
| 18 | Integration | all regression cases |
| 19 | Release | RC checklist |

# Appendix L — Final Instructions to Claude Code About Scope Control

Claude Code should treat the project in three bands:

## Band A — Must finish

```text
Inspector completion
model quality
database
durable jobs
security
testing
```

## Band B — Strong product completion

```text
multi-page
camera
perspective correction
palette
deployment
observability
```

## Band C — Future R&D

```text
OCR
React export
Tailwind export
themes
collaboration
layout transformer
multimodal UI model
visual similarity optimization
automatic active learning
```

If time is limited, finish Band A before starting Band C.

# Appendix M — The Most Important Anti-Regression Rule

The current project already proves the complete central path. The implementation effort is therefore a **maturity upgrade**, not a restart.

Every Claude Code change should answer:

```text
What existing behavior am I preserving?
What missing behavior am I adding?
How do I prove both?
```

If a proposed change cannot answer those three questions, it is not ready to implement.

# Appendix N — Final Handoff Artifact Set

At project completion, the repository should contain at least:

```text
docs/
├── architecture/
├── execution/
├── api/
├── database/
├── ml/
│   ├── annotation-guide.md
│   ├── dataset-report.md
│   ├── model-decision.md
│   ├── training.md
│   └── evaluation.md
├── security/
├── deployment/
└── eval/

models/
└── ui-detector/
    └── <version>/

tests/
├── fixtures/
├── e2e/
├── integration/
└── unit/
```

The final repository should make it possible for a reviewer to trace:

```text
requirement
→ implementation
→ test
→ evidence
```

for the major features.

# Appendix O — Final Execution Mindset

The strongest way to complete Sketch2UI is to treat it as four coupled but independently testable systems:

```text
1. Computer vision
2. UI/layout compiler
3. Web application
4. Evaluation/training system
```

The computer-vision system answers:

```text
What objects are in the sketch?
```

The layout compiler answers:

```text
How are those objects structurally related?
```

The web application answers:

```text
How can the user correct, inspect, generate, preview, save, and export the result?
```

The evaluation/training system answers:

```text
How do we know whether the detector and end-to-end product are improving?
```

Do not collapse these into one layer.

The current project already embodies much of this separation, and the remaining execution plan should strengthen it rather than replace it. The project status confirms that the core pipeline is already working end-to-end and that Style/Content override, dataset tooling, and versioned code editing are implemented. fileciteturn0file0L20-L33

# Appendix P — Final “Do Not Lose Existing Work” Checklist

Before every major migration, export or preserve:

```text
[ ] current code version
[ ] current source sketch
[ ] current detections
[ ] current UI tree
[ ] current style overrides
[ ] current content overrides
[ ] current model version
[ ] current baseline metrics
[ ] current dataset version
[ ] existing evaluation fixture
[ ] existing boundary parity fixtures
```

Before database migration:

```text
[ ] JSON backup
[ ] migration dry run
[ ] record count comparison
[ ] sample record comparison
[ ] rollback plan
```

Before model replacement:

```text
[ ] old weights preserved
[ ] old metrics preserved
[ ] class list preserved
[ ] benchmark rerun
[ ] candidate evaluated
[ ] promotion decision recorded
```

Before production-like release:

```text
[ ] backup tested
[ ] authorization tested
[ ] preview sandbox tested
[ ] upload validation tested
[ ] E2E tested
[ ] build reproducible
```

This checklist is intentionally conservative because the current repository already contains working behavior that should not be lost during the completion effort.


# Appendix A — Detailed Baseline Commands


Claude Code should derive exact commands from the repository's package files, but the baseline process should always include the following categories:

### Git state

```bash
git status
git branch --show-current
git log -10 --oneline
git diff --stat
```

### Repository inventory

```bash
find apps -maxdepth 4 -type f | sort
find packages -maxdepth 4 -type f | sort
find services -maxdepth 5 -type f | sort
find scripts -maxdepth 4 -type f | sort
find ml -maxdepth 5 -type f | sort
```

### TypeScript dependencies and scripts

```bash
cat package.json
```

If there are package-level `package.json` files, inspect them too.

### Python environment

Inspect:

```text
requirements.txt
pyproject.toml
environment.yml
```

whichever actually exists.

### Docker

Inspect:

```bash
cat docker-compose.yml
find . -maxdepth 2 -type f -name 'Dockerfile*' -print
```

### Database

Search for the current persistence layer:

```bash
grep -R "jsonStore\|prisma\|postgres\|pg" apps packages --exclude-dir=node_modules
```

### Jobs

Search:

```bash
grep -R "detect.job\|bullmq\|redis\|queue" apps services packages --exclude-dir=node_modules
```

The baseline must not merely say “Postgres is present in Docker.” It must verify whether runtime application code actually connects to it. The current status shows that Postgres and Redis are provisioned but unused by `apps/api`. fileciteturn0file0L120-L129

### ML

Inspect:

```bash
find ml/models -maxdepth 4 -type f | sort
find ml/dataset -maxdepth 4 -type f | sort
```

Read:

```text
metrics.json
classes.txt
training scope documentation
evaluation baseline
```

The baseline should write down the exact architecture, not simply call it “YOLO tiny.”



# Appendix B — Geometry Phase Detailed Test Matrix


Geometry is the first major incomplete Inspector feature and should be completed before adding more advanced UX.

### Validation

Test:

```text
x=0
y=0
width=1
height=1
```

Expected: accepted.

Test:

```text
x=-0.01
```

Expected: rejected.

Test:

```text
width=0
```

Expected: rejected.

Test:

```text
x=0.8
width=0.3
```

Expected: rejected unless the application intentionally supports clipping; the default should be strict normalized geometry.

### Persistence

1. Detect element.
2. Apply geometry.
3. Reload project.
4. Inspect geometry.
5. Verify override persists.

### Generation

1. Change position.
2. Generate code.
3. Compare generated layout.
4. Open preview.
5. Export ZIP.
6. Verify exported page reflects geometry.

### Identity

Change detection set so UI-IR node numbering changes.

Verify the geometry override still applies to the original detection UUID.

This is important because existing Style overrides explicitly use detection UUIDs rather than unstable generation-local node IDs. fileciteturn0file0L64-L70

### Reset

Apply override.

Reset.

Verify:

```text
override removed
source detection returns
generation returns to automatic geometry
```

### Security

Geometry fields should accept only numeric normalized values, not raw CSS strings.



# Appendix C — Structure Phase Detailed Rules


The Structure inspector should not be implemented as arbitrary DOM editing. It should manipulate the project's UI-IR structure.

## Valid parent examples

```text
nav_item → navbar
button → card
card_title → card
card_text → card
card_button → card
heading → section
text → section
image → section
```

## Invalid or suspicious examples

```text
page → button
button → button
footer → button
navbar → image
```

The system should distinguish between:

```text
hard invalid
```

and:

```text
unusual but allowed
```

Do not over-constrain the user with a taxonomy that prevents legitimate layouts.

## Display order

Use an integer order.

Example:

```text
section
  child order 0: heading
  child order 1: text
  child order 2: button
```

When moving a child from order 0 to order 2, the other children should be normalized so there are no duplicate orders.

## Re-parenting

When a user re-parents a node:

1. update manual structure override;
2. keep source detection unchanged;
3. rebuild effective tree;
4. regenerate code;
5. preserve other manual overrides.

## Tree and canvas

The tree and canvas should always refer to the same stable detection identity.



# Appendix D — ML Dataset Execution Playbook


The detector is the main quality bottleneck. The current v1.0.0 is explicitly a smoke test, so the goal of the ML phase is not merely “train more.” It is to create a reproducible data-quality and model-evaluation loop.

## Step 1 — Inventory

Create a machine-readable table:

```text
image_id
split
source
width
height
class_count
annotation_count
external_annotations_present
page_boundary_quality
```

## Step 2 — Label statistics

For every class calculate:

```text
count
images containing class
mean box area
median box area
```

## Step 3 — Hard examples

Create buckets:

```text
small component
faint pencil
dark pencil
angled page
external notes
overlapping components
repeated cards
dense footer
mobile sketch
```

## Step 4 — Annotation review

Select random samples from each bucket.

## Step 5 — Data split

Do not randomly split duplicate or near-duplicate photos.

The test set should represent unseen drawings rather than another copy of the training sketch.

## Step 6 — Baseline

Always evaluate the existing v1.0.0 first.

## Step 7 — Intervention

Add only targeted data based on observed errors.

## Step 8 — Train

Run candidate.

## Step 9 — Evaluate

Compare the candidate against exactly the same benchmark as v1.0.0.

## Step 10 — Qualitative inspection

Open false-positive and false-negative images.

## Step 11 — Promotion

Only approve if the whole pipeline improves or at least does not regress on critical classes.



# Appendix E — PostgreSQL Migration Playbook


The migration should be incremental.

## Stage 1 — Schema discovery

Inspect the actual JSON store to identify:

- projects;
- jobs;
- detections;
- versions;
- overrides;
- assets.

Do not create a database schema based solely on the old proposal if current runtime objects have changed.

## Stage 2 — Prisma schema

Create tables that represent the current domain state.

## Stage 3 — Repository boundary

Current route modules should talk to repository/service functions rather than direct JSON implementation details.

## Stage 4 — Dual-read development mode

For a short transition period, it is acceptable to provide a migration verification mode:

```text
JSON result
Postgres result
compare
```

Do not run both as production sources of truth indefinitely.

## Stage 5 — Import

Run:

```text
json
→ validate
→ transform
→ transaction
→ postgres
```

## Stage 6 — Parity verification

Check counts:

```text
projects
detections
versions
overrides
assets
jobs
```

Then sample detailed records.

## Stage 7 — Switch runtime

Use Postgres as the single runtime source.

## Stage 8 — Backup

Before deleting or deprecating JSON runtime storage, preserve a backup artifact.

## Stage 9 — Regression

Run the entire existing test suite plus migration-specific tests.



# Appendix F — Durable Queue Playbook


Detection is the expensive operation and should be the first durable background job.

## Job creation

The API should:

1. validate project;
2. validate image asset;
3. create job row;
4. enqueue job;
5. return job ID.

## Worker

The worker should:

1. claim job;
2. load asset;
3. load model;
4. preprocess;
5. infer;
6. filter;
7. persist detections;
8. rebuild dependent state if appropriate;
9. mark complete.

## Crash behavior

If the worker stops after inference but before marking the job complete, the retry must not duplicate detections.

Use a job-scoped result identifier.

## Cancellation

Cancellation can be added later.

## Progress

The job record should store:

```text
stage
progress
startedAt
finishedAt
errorCode
```

## Monitoring

Log:

```text
jobId
projectId
modelVersion
stage
elapsedMs
```

The existing implementation already has a startup orphan failure mechanism. Durable queues should replace that mitigation rather than deleting it without understanding why it exists. fileciteturn0file0L128-L130



# Appendix G — Authentication Migration Playbook


Authentication should be introduced only after the current single-user behavior is understood.

## Legacy state

Today there is no user/account layer and project routes are not auth-gated. fileciteturn0file0L44-L44

## Migration

Create a system owner:

```text
legacy-owner@local
```

or a seeded admin configured through environment variables.

Assign all legacy projects to that owner.

## Session

Use secure cookies.

Configure:

```text
HttpOnly
Secure in production
SameSite appropriate to deployment
```

## Authorization

Every route that takes a project ID should:

```text
authenticate
→ load project
→ verify owner/admin
→ continue
```

Do not rely on frontend filtering.

## Tests

Negative tests are mandatory.

```text
GET foreign project → 404 or 403
PATCH foreign project → 404 or 403
DELETE foreign project → 404 or 403
GET foreign asset → denied
```

## Admin

Admin should be able to inspect model versions and dataset approvals without becoming a superuser over application code execution.



# Appendix H — Multi-Page Migration Details


Multi-page support should not break the existing one-page UX.

## Backward compatibility

A project created before multi-page support can automatically receive:

```text
Page 1
```

linked to its existing source asset and detections.

The old route:

```text
/projects/:id
```

continues to open the first page.

## New structure

```text
Project
  pages[]
```

## Page-level operations

```text
upload page
detect page
edit page
generate page
preview page
export page
```

## Project-level operations

```text
rename project
duplicate project
delete project
export entire site
```

## Code

Generated files:

```text
index.html
about.html
contact.html
assets/
styles.css
```

Navigation can use relative links.

## Detection

Each page maintains independent normalized coordinates.

Do not mix page coordinate systems.



# Appendix I — End-to-End Regression Scenarios


Create a permanent set of regression scenarios.

### Scenario 1 — Simple landing page

Expected:

```text
page
header
logo
navbar
hero
heading
text
button
section
footer
```

### Scenario 2 — Car marketplace

Expected:

```text
header
navbar
hero
image
heading
select
button
cards
icons
footer
input
social_icon
```

### Scenario 3 — Recipe page

Expected:

```text
header
hero
section
image
heading
list
button
nutrition
product images
```

### Scenario 4 — Annotated sketch

Expected:

```text
external note rejected
internal button accepted
```

### Scenario 5 — Two-page recipe

Expected:

```text
Page 1
Page 2
```

### Scenario 6 — Correction

Change one class and confirm:

```text
source = manual
```

### Scenario 7 — Version activation

Generate version A.

Edit code.

Generate version B.

Activate A.

Verify preview and export return to A.

### Scenario 8 — Geometry

Move one button.

Generate.

Verify preview.

### Scenario 9 — Structure

Move one button into a card.

Generate.

Verify HTML nesting.

### Scenario 10 — Server restart

During a background job, restart the server/worker and verify durable behavior after queue migration.



# Appendix J — Final Release Gate


The Release Candidate should not be declared complete based on one successful demonstration.

## Product gate

All P0 features work.

## ML gate

Model is not labeled `smoke_test` unless explicitly documented as the final project limitation. A production-like release should have a named benchmark and defensible metrics.

## Data gate

Training and test sets are documented and reproducible.

## Persistence gate

Runtime uses Postgres.

## Job gate

Detection uses durable jobs.

## Security gate

Authorization and preview isolation are verified.

## Test gate

Unit, integration, and at least one full E2E workflow pass.

## Operational gate

A new developer can:

```text
clone
install
configure
migrate
start
run tests
run demo
```

using the documentation.

## Documentation gate

The final project must contain:

```text
README
architecture
ML training guide
annotation guide
API guide
database guide
deployment guide
evaluation report
known limitations
```

## Demo gate

The final presentation should demonstrate:

```text
sketch
→ page boundary
→ YOLO detections
→ manual corrections
→ UI tree
→ generated HTML/CSS
→ live preview
→ export
```

This is the central value chain of Sketch2UI.



---

**Document statistics:** approximately 10,964 words. This plan is derived from the uploaded `PROJECT_STATUS.md` and is intentionally organized as an incremental Claude Code execution playbook rather than a greenfield architecture proposal.
