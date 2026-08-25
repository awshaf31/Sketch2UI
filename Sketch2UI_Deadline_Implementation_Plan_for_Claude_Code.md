# Sketch2UI — Emergency Deadline Implementation Plan for Claude Code

**Purpose:** Finish the current Sketch2UI project as quickly and safely as possible before the academic deadline.

**Execution mode:** Deadline Mode — prioritize a stable, demonstrable, testable product over completing every feature in the original long-term roadmap.

**Source of truth:** The verified project baseline, current phase log, regression checklist, and Phase 8 architecture amendment supplied with the project.

---

# 1. Executive Decision

The project is **not greenfield** and must **not** be rebuilt.

The current verified state already contains a working end-to-end core:

```text
Sketch upload
   ↓
Page boundary
   ↓
YOLO detection
   ↓
Detection correction
   ↓
UI-IR/layout reconstruction
   ↓
HTML generation
   ↓
CSS generation
   ↓
Sandboxed live preview
   ↓
Versioning
   ↓
ZIP export
```

The project also has Style, Content, Geometry, Structure, and Correction History work completed in the execution sequence.

The remaining goal is therefore:

> **Stabilize and complete the existing core product quickly enough to produce a reliable final demonstration and submission.**

Do **not** interpret "complete project" as "implement every item in the original 19-phase roadmap."

For the deadline, the correct definition is:

```text
COMPLETE =
core workflow works reliably
+
critical persistence is stable
+
database migration is safe
+
existing functionality does not regress
+
ML limitations are honestly evaluated
+
final demo is repeatable
+
final report evidence is available
```

---

# 2. Verified Current Position

The Phase 0 baseline confirms:

- macOS/Darwin environment;
- Node 20.17.0;
- npm 11.4.2;
- npm workspaces;
- Python 3.9.6;
- Ultralytics 8.3.0;
- Torch 2.8.0;
- existing React + Vite + Tailwind frontend;
- Node + Express + TypeScript API;
- Python/FastAPI CV worker;
- 41-class canonical taxonomy;
- 16-class v1 detector subset;
- model registry `ui-detector/v1.0.0`. 

The project baseline originally had no Git repository, which was identified as a safety gap. The execution process should keep version-control discipline from this point onward.

The current regression checklist is the authority for the core demo and says the checklist must be run after every phase; a phase must not be marked complete when a checklist item fails.

---

# 3. Current Product State

## 3.1 Already complete

The project status identifies the following as done:

```text
Project CRUD
Image upload
Annotation canvas
Page boundary
YOLO detection integration
Detection correction
UI-IR/layout reconstruction
HTML generation
CSS generation
Live preview
Immutable code versions
ZIP export
Style inspector
Content inspector
Geometry inspector
Structure inspector
Correction history
Dataset export/import tooling
Active-learning report
Evaluation harness
Training approval
Boundary parity tests
```

These features are already part of the working product and should be treated as protected functionality.

## 3.2 Still incomplete or partial

The major unfinished areas include:

```text
PostgreSQL runtime migration
Remaining repository migrations
Durable queue
Authentication
Multi-page projects
Camera
Perspective correction
React/Tailwind export
V2/V3 research features
Frontend E2E suite
CI/CD
Production observability
Full model improvement
```

Not all of these should be completed before the deadline.

---

# 4. Deadline Scope: P0, P1, P2, Deferred

## P0 — Must finish

These directly affect the final product:

```text
1. Detection repository migration
2. Remaining core persistence migrations
3. PostgreSQL single-source-of-truth runtime
4. Core regression verification
5. Detection/model correction preservation
6. Code version preservation
7. Override preservation
8. Export preservation
9. Core demo path stability
10. Final evaluation and evidence
```

## P1 — Strongly recommended

```text
11. Boundary persistence migration
12. CodeVersion persistence migration
13. Style/Content/Geometry/Structure persistence migration
14. Training/Correction persistence migration
15. Export persistence migration
16. Job persistence migration
17. One deterministic E2E smoke test
18. Security review of the existing preview/upload paths
19. Final UI polish for obvious defects
```

## P2 — Only if enough time remains

```text
20. Durable Redis/BullMQ migration
21. Authentication
22. Multi-page projects
23. Camera capture
24. Perspective correction
25. Additional model experiment
```

## Deferred

Do not start unless specifically required by the deadline specification:

```text
React export
Tailwind export
OCR
Themes
Design tokens
Collaboration
Layout transformer
Multimodal model
Advanced active learning
Enterprise auth/SSO
Backend generation from sketches
```

---

# 5. The Most Important Current Blocker

The original Phase 8 plan assumed the JSON store was a clean swappable abstraction.

The actual source contradicted that assumption.

The execution log measured:

```text
92 lines containing db.state
100 db.state occurrences
19 files touching db.state
32 db.save() call sites
2 async route handlers
```

The reason is that the current JSON store exposes a synchronous mutable object graph:

```ts
db.state
```

and many routes mutate objects directly.

Prisma is asynchronous, so this cannot be replaced without propagating `async/await`.

The project correctly amended the architecture to:

```text
Route / Service
      ↓
Repository contract
      ↓
JSON adapter     Prisma adapter
      ↓                  ↓
   JSON file        PostgreSQL
```

This architecture amendment is now active and supersedes the original Phase 8 assumption.

---

# 6. What Has Already Been Achieved in Phase 8

The database migration is farther along than a normal "schema created" stage.

Verified:

```text
13 tables
12 enums
27 non-PK indexes
23 foreign keys
445 migrated rows
JSON/Postgres semantic parity
real PostgreSQL test database
Prisma contract tests
Project repository migrated
Asset repository migrated
```

The current live PostgreSQL migration has also verified constraints and the 445-row data migration.

The latest execution log says:

```text
ProjectRepository: complete
AssetRepository: complete
DetectionRepository: next
```

The current repository guard reports:

```text
2 migrated
75 db.state occurrences remaining
25 db.save occurrences remaining
```

---

# 7. Immediate Next Task — Detection Repository

This is the single highest-priority implementation task.

The latest phase log explicitly identifies Detection as the next domain because it owns critical behaviors that must not be bypassed:

```text
model → manual flip
originalClassName capture
clearModelDetections idempotency
```

Do not jump to unrelated features.

---

# 8. Phase A — Detection Repository Migration

## Objective

Move all Detection persistence behavior behind:

```text
DetectionRepository
```

with:

```text
JsonDetectionRepository
PrismaDetectionRepository
```

while preserving the exact current API behavior.

## 8.1 Inspect first

Claude Code must inspect:

```text
apps/api/src/repositories/types.ts
apps/api/src/repositories/index.ts
apps/api/src/repositories/json/
apps/api/src/repositories/prisma/
apps/api/src/modules/detections/
apps/api/src/modules/training/
packages/shared-types/
apps/api/prisma/schema.prisma
```

Do not assume file names beyond what exists.

## 8.2 Required repository operations

Use the existing contract if already present.

The Detection repository should cover the actual operations required by the application, such as:

```text
listByProject
findById
create
update
delete
clearModelDetections
```

If the existing interface already contains these, extend only when required by actual callers.

Do not introduce generic CRUD merely for aesthetic reasons.

## 8.3 Preserve model → manual behavior

The current application has an important rule:

```text
model detection
      ↓
user edits class/bbox
      ↓
source = manual
```

This must survive the migration.

Do not move the rule into a component that future callers can bypass.

The repository/service boundary should own this behavior.

## 8.4 Preserve original class

When a model detection is changed:

```text
originalClassName
```

must retain the model's original class.

This is used by the training feedback system.

## 8.5 Preserve clearModelDetections

Automated re-detection needs to clear only eligible model detections.

It must not delete manually corrected detections.

Expected semantic behavior:

```text
model A
model B
manual C

clearModelDetections()

remaining:
manual C
```

## 8.6 Contract tests

Run the same contract against:

```text
JSON adapter
Prisma adapter
```

Do not maintain two independent test definitions.

## 8.7 Route migration

Convert detection route/service code to use the repository.

Every persistence read/write should become async.

Do not change:

```text
HTTP method
URL
request body
response shape
status codes
business semantics
```

unless the current behavior is demonstrably incorrect.

## 8.8 Verification

Run:

```bash
npm run test
npm run test:py
npm run typecheck
npm run build
npm run check:db-state
```

Then perform live API smoke tests.

---

# 9. Claude Code Prompt — Detection

Copy this into Claude Code:

```text
EMERGENCY DEADLINE MODE — IMPLEMENT DETECTION REPOSITORY NOW.

Read:
- PROJECT_STATUS.md
- docs/execution/current-baseline.md
- docs/execution/phase-log.md
- docs/execution/regression-checklist.md
- docs/execution/phase-8-architecture-amendment.md

Do NOT start any unrelated phase.

The latest phase log says:
- ProjectRepository is migrated and verified
- AssetRepository is migrated and verified
- DetectionRepository is the next highest-risk domain
- current db.state guard shows 75 remaining occurrences and 25 db.save calls

Objective:
Migrate the Detection domain through the existing repository boundary.

FIRST inspect:
- DetectionRepository interface
- JsonDetectionRepository
- PrismaDetectionRepository
- detections.routes.ts
- detections.service.ts
- detect.job.ts
- shared detection types
- Prisma Detection model
- TrainingSample/originalClassName logic

Preserve ALL existing behavior.

Critical invariants:
1. Editing a model detection changes source to "manual".
2. originalClassName preserves the original model class.
3. clearModelDetections never removes manual detections.
4. clearModelDetections is idempotent.
5. Detection IDs remain stable.
6. Re-detection cannot silently overwrite a manual correction.
7. API request/response contracts remain unchanged.
8. Do not bypass the repository with direct Prisma imports in route modules.
9. Tests must run against sketch2ui_test, never the development database.
10. Do not touch unrelated domains.

Implementation:
- complete JSON DetectionRepository if necessary
- complete Prisma DetectionRepository
- run identical repository contract tests against both
- migrate detection route/service callers
- migrate any directly dependent detection persistence path
- preserve model/manual semantics
- preserve originalClassName
- preserve clearModelDetections

After implementation run:
npm run test
npm run test:py
npm run typecheck
npm run build
npm run check:db-state

Then perform focused live API smoke tests:
- create model detection
- PATCH class
- verify source=model → manual
- verify originalClassName
- run clearModelDetections
- verify manual survives
- verify model detection is removed
- run code generation
- verify core pipeline still works

Do not mark complete until all checks pass.

Return:
1. files changed
2. domains migrated
3. db.state count before/after
4. db.save count before/after
5. tests
6. live smoke results
7. regressions
8. next exact action
```

---

# 10. Phase B — Migrate the Core Persistence Domains

After Detection, do not automatically migrate every remaining table in arbitrary order.

Use this order:

```text
Detection
   ↓
Boundary
   ↓
CodeVersion
   ↓
Style Override
   ↓
Content Override
   ↓
Geometry Override
   ↓
Structure Override
   ↓
Correction / Training
   ↓
Export
   ↓
Job
```

This order protects the core pipeline first.

---

# 11. Boundary Repository

## Why it matters

Page-boundary filtering is a core feature.

The regression checklist specifically requires:

```text
boxes outside page become filtered
boundary parity fixture passes in TS and Python
```

Do not alter boundary geometry algorithms while migrating persistence.

## Preserve

```text
manual boundary
automatic boundary
sticky manual behavior
polygon
source asset relation
```

## Test

Verify:

```text
save boundary
load boundary
update boundary
core detection filtering
boundary parity
```

---

# 12. CodeVersion Repository

This is high priority because code versions power:

```text
preview
activation
export
hand editing
Style overrides
Content overrides
```

The current application treats code versions as immutable.

Therefore:

```text
CREATE new version
```

not:

```text
UPDATE existing version
```

The regression checklist explicitly requires that activating an old version does not mutate that version.

## Test

```text
Generate Version A
Generate Version B
Activate A
Preview shows A
Export shows A
Version B remains unchanged
```

---

# 13. Style Override Repository

Style overrides are already working.

Do not redesign their six-property allowlist.

Preserve:

```text
display
gap
padding
margin
font-size
text-align
```

Preserve detection UUID identity.

Do not switch to UI-IR node IDs.

---

# 14. Content Override Repository

Preserve the existing validation.

The project already rejects:

```text
<
>
javascript:
data:
```

in the applicable content/href paths.

Do not weaken those protections during migration.

Test:

```text
valid content
invalid HTML injection
valid href
javascript: rejection
data: rejection
reset
```

---

# 15. Geometry Override Repository

Geometry is already complete.

Only move persistence.

Preserve:

```text
x
y
width
height
```

normalized `[0,1]` semantics.

Preserve:

```text
detection UUID
effectiveBBox()
```

Do not modify geometry layout logic just because the persistence backend is changing.

---

# 16. Structure Override Repository

Preserve:

```text
parentDetectionId
displayOrder
root override
cycle validation
parent existence
```

The automatic layout engine must remain intact.

Manual structure overrides should continue to layer on top.

---

# 17. Correction / Training Persistence

Correction history is already implemented.

It should become database-backed without redesigning its semantics.

Preserve:

```text
class_changed
bbox_changed
parent_changed
order_changed
created
deleted
```

Also preserve:

```text
TrainingSampleBox.originalClassName
```

This is part of the ML feedback signal.

---

# 18. Export Repository

Exports are important to the final demonstration.

The regression checklist requires:

```text
index.html
styles.css
assets/
source-sketch.*
README.txt
```

The exported website must work without the Sketch2UI application.

Test this as an actual browser-opened file.

---

# 19. Job Repository

Jobs are the last persistence domain because the current detection job mechanism is in-process.

Do not combine:

```text
Job repository migration
```

with:

```text
Redis/BullMQ migration
```

unless there is enough time.

First preserve the existing in-process semantics.

Then, only if the deadline permits, move the execution layer to Redis/BullMQ.

---

# 20. Critical Decision: Redis/BullMQ

The current application has an in-process detection job.

It works with:

```text
processing
completed
failed
```

and has startup orphan handling.

A full durable queue is useful architecture, but it is **not necessary for the final academic demonstration if the deadline is extremely close**.

Therefore:

## If plenty of time remains

Implement:

```text
API
 ↓
Redis
 ↓
worker
 ↓
PostgreSQL
```

with retry/idempotency.

## If only a few hours remain

Do NOT start Redis migration.

Keep:

```text
in-process jobs
```

and document:

> Background jobs remain in-process for the current academic release; durable queue infrastructure is planned for a future release.

A complete, tested in-process feature is better than a half-finished queue.

---

# 21. PostgreSQL Cutover Gate

Do not set:

```env
PERSISTENCE_DRIVER=postgres
```

until the required core repositories are actually migrated.

The current log correctly says that switching too early would create split-brain persistence because only part of the domain is on Prisma.

Before the switch:

```text
[ ] detection migrated
[ ] assets migrated
[ ] projects migrated
[ ] boundaries migrated
[ ] code versions migrated
[ ] overrides migrated
[ ] training/corrections migrated
[ ] exports migrated
[ ] jobs migration decision documented
```

Then:

```text
PERSISTENCE_DRIVER=postgres
```

---

# 22. PostgreSQL Cutover Procedure

Claude Code should perform the cutover carefully.

## Step 1

Confirm dev database:

```text
sketch2ui
```

## Step 2

Confirm test database:

```text
sketch2ui_test
```

## Step 3

Verify:

```text
15 projects
393 detections
7 code versions
12 jobs
2 training samples
2 exports
```

or whatever the current counts are after the latest legitimate development changes.

Do not blindly assume old counts.

## Step 4

Start API with Postgres.

## Step 5

Run:

```text
project create
upload
detect
correction
code generation
style
content
geometry
structure
preview
version activation
export
```

## Step 6

Check Postgres counts.

## Step 7

Check that JSON is no longer used for runtime writes.

---

# 23. The Regression Checklist Is Your Definition of Done

The existing checklist is exceptionally useful for the deadline.

Run these 15 steps after every major migration:

```text
1. Project create
2. Image upload
3. Manual box creation
4. Page boundary
5. Auto detection
6. Manual correction
7. UI tree
8. HTML generation
9. CSS generation
10. Live preview
11. Code edit
12. Version activation
13. Export ZIP
14. Style inspector
15. Content inspector
```

Also verify the preservation rules:

```text
model edit → source manual
manual correction survives re-detect
code versions immutable
preview sandbox unchanged
content validation unchanged
boundary parity unchanged
```

---

# 24. Add a Minimal E2E Test Before the Deadline

You do not need full frontend test coverage.

Create one golden-path Playwright test.

## Test objective

```text
Sketch → Detect → Correct → Generate → Preview → Export
```

Use a deterministic fixture.

Do not make the E2E test depend on a flaky live model unless required.

For the E2E test:

```text
mock detection result
```

and separately test real CV inference.

This gives you:

```text
UI regression confidence
+
ML integration confidence
```

without making one test responsible for everything.

---

# 25. ML Strategy Under Deadline Pressure

The model is currently:

```text
YOLOv8-nano
156 images
16 classes
status = smoke_test
```

The project also has:

```text
41-class canonical taxonomy
```

The latest ML preparation has already concluded that the data is the current bottleneck and that running v1.1 on the same corpus would not provide meaningful new information.

Therefore:

## Case A — No new annotated data available

Do not retrain.

Instead:

```text
freeze v1.0.0
run evaluation
generate qualitative examples
document limitations
```

In the final report state:

> The trained lightweight detector demonstrates the complete inference pipeline but remains experimental due to limited training diversity and partial class coverage.

That is scientifically defensible.

## Case B — New labeled data already exists

Then run:

```text
quality report
→ fix dataset issues
→ train candidate v1.1
→ evaluate
→ compare baseline
```

Do not change the active model unless the comparison is meaningful.

---

# 26. Do Not Chase All 41 Classes

The current model intentionally trains on 16 classes.

The dataset-quality report identified:

```text
select
radio_button
carousel
```

as weak and:

```text
card
page
```

as important but untrained.

If you have no time for proper additional annotation, do not pretend the 41-class model is ready.

For the final demo, use a sketch whose important components belong to the trained class subset and verify the result manually.

---

# 27. Final Demo Strategy

Choose **one best-looking sketch**.

Do not demonstrate the system with a random difficult image.

The best demo should contain:

```text
header
logo
navbar
heading
text
image
button
cards
section
footer
```

and optionally:

```text
form
```

The user journey:

```text
1. Upload sketch
2. Show page boundary
3. Run detection
4. Show detected boxes
5. Correct one detection
6. Show UI tree
7. Show generated HTML
8. Show generated CSS
9. Show live preview
10. Edit content
11. Show changed preview
12. Export ZIP
13. Open exported index.html
```

That is the strongest demonstration of the actual project.

---

# 28. Final Demo Data Should Be Frozen

Create:

```text
tests/fixtures/final-demo/
```

with:

```text
sketch.png
expected/
README.md
```

Do not use a randomly uploaded image during the final presentation.

The demo should be reproducible.

---

# 29. Final Project Freeze

Once this works:

```text
Sketch
 ↓
Detect
 ↓
Correct
 ↓
Tree
 ↓
HTML/CSS
 ↓
Preview
 ↓
Export
```

**STOP FEATURE DEVELOPMENT.**

Do not start another architecture phase.

Freeze:

```text
model
database
frontend
API
codegen
```

and move to:

```text
testing
evaluation
documentation
presentation
```

---

# 30. Final Testing Commands

Use the repository's verified commands, not invented replacements.

At minimum:

```bash
npm run test
npm run test:py
npm run typecheck
npm run build
npm run check:db-state
```

Also run the actual CV worker health check:

```bash
curl http://localhost:8000/health
```

The baseline expects the CV worker to report the loaded model and class count.

---

# 31. Final Manual Acceptance

Use the existing regression checklist literally.

Record:

```text
PASS
FAIL
N/A
```

for every item.

If any P0 item fails:

```text
do not release
```

Fix it before freezing.

---

# 32. Claude Code Phase Prompts

## Prompt 1 — Detection

```text
Execute the Detection repository migration only.

Use the repository contracts already created in Phase 8.
Inspect actual current source first.

Preserve:
- model→manual
- originalClassName
- clearModelDetections
- API behavior
- manual correction survival

Implement:
- JSON adapter
- Prisma adapter
- shared contract tests
- route/service migration

Run:
npm run test
npm run test:py
npm run typecheck
npm run build
npm run check:db-state

Run a live API smoke test.

Do not start another domain until this phase is green.
```

## Prompt 2 — Core domains

```text
Continue deadline mode.

Now migrate only the persistence domains required by the core product:
Boundary → CodeVersion → Style → Content → Geometry → Structure → Correction/Training → Export.

One domain at a time.

After each:
- contract tests
- typecheck
- build
- db-state guard
- focused API smoke

Do not modify layout algorithms, HTML generator, CSS generator, preview security, or model inference unless required to fix a regression.

Stop if a migration introduces behavior differences.
```

## Prompt 3 — PostgreSQL cutover

```text
All core persistence domains are now migrated.

Before changing the runtime persistence driver:

1. verify repository coverage
2. run check:db-state
3. verify no core route directly accesses JSON state
4. verify test database isolation
5. verify dev database row counts

Then set PERSISTENCE_DRIVER=postgres for the development runtime.

Run the full regression checklist.

Test:
project
upload
boundary
detect
correction
tree
HTML
CSS
preview
code edit
version activation
style
content
geometry
structure
export

Do not proceed if any core behavior regresses.
```

## Prompt 4 — Emergency E2E

```text
Build exactly one high-value Playwright E2E golden-path test.

Do not create a large test suite.

Test:
create project
upload fixture
detect/mocked detection
select
correct
generate
preview
export

Keep real YOLO inference separately testable.

Make the test deterministic and fast.
```

## Prompt 5 — Final stabilization

```text
FEATURE FREEZE MODE.

Do not add new functionality.

Run:
npm run test
npm run test:py
npm run typecheck
npm run build
npm run check:db-state

Then execute the full manual regression checklist.

Fix only release-blocking defects.

Do not refactor unrelated code.

Do not change the model.

Do not change database architecture.

Do not change the code-generation architecture.

After all tests pass, produce the final release report.
```

---

# 33. Final Claude Code Master Prompt

Use this as your main instruction while Claude Code completes the project:

```text
You are the senior engineer finishing the existing Sketch2UI project under a very short academic deadline.

This is NOT greenfield work.

Your goal is:
DELIVER A STABLE, DEMONSTRABLE, TESTABLE FINAL VERSION AS QUICKLY AS POSSIBLE.

Never optimize for "number of features".
Optimize for:
- reliability
- preservation
- verification
- demo readiness
- deadline completion

READ FIRST:
- PROJECT_STATUS.md
- docs/execution/current-baseline.md
- docs/execution/phase-log.md
- docs/execution/regression-checklist.md
- docs/execution/phase-8-architecture-amendment.md

CURRENT CORE PIPELINE IS PROTECTED:
sketch
→ page boundary
→ YOLO detection
→ correction
→ UI-IR
→ HTML
→ CSS
→ preview
→ version
→ export

DO NOT REWRITE THAT PIPELINE.

CURRENT DATABASE STATE:
- Prisma schema exists
- PostgreSQL exists
- database migration executed
- Projects migrated
- Assets migrated
- Detection is the next migration
- current runtime must not use Postgres until split-brain persistence is eliminated

IMPLEMENTATION ORDER:

P0:
1. Detection repository
2. Boundary repository
3. CodeVersion repository
4. Override repositories
5. Correction/Training
6. Export
7. Jobs persistence
8. PostgreSQL cutover
9. regression

P1:
10. Minimal E2E
11. security review
12. final demo stabilization

P2:
13. Redis/BullMQ if time
14. auth if required
15. camera/perspective if required

DEFER:
everything else.

ABSOLUTE RULES:

- inspect before editing
- preserve route contracts
- preserve API response behavior
- preserve manual correction
- preserve version immutability
- preserve preview sandbox
- preserve boundary parity
- use repository contracts
- never bypass the repository with Prisma in routes
- never mix development/test database
- never run destructive tests against dev database
- never overwrite old model versions
- never make unsupported accuracy claims
- do not add features that are not deadline-critical
- run tests after every logical domain
- stop and report if data safety is uncertain

FOR EACH DOMAIN:
1. inspect
2. implement JSON adapter
3. implement Prisma adapter
4. run identical contract tests
5. migrate callers
6. typecheck
7. build
8. run focused API test
9. run db-state guard
10. record result
11. continue

AFTER CORE MIGRATION:
Switch to PostgreSQL only when the core path is fully covered.

THEN:
Run the entire regression checklist.

THEN:
Freeze features.

THEN:
Prepare final evaluation and demo artifacts.

If time becomes critically short:
STOP architectural expansion.

Do NOT start another major subsystem.

The final release must prefer:
"a smaller product that works reliably"

over:
"a larger product with unfinished or unstable features".
```

---

# 34. Recommended Deadline Order

The fastest practical sequence is:

```text
NOW
 │
 ▼
Detection migration
 │
 ▼
Boundary
 │
 ▼
CodeVersion
 │
 ▼
Overrides
 │
 ▼
Correction/Training
 │
 ▼
Export
 │
 ▼
Jobs persistence
 │
 ▼
Postgres-only runtime
 │
 ▼
Full regression
 │
 ▼
One E2E test
 │
 ▼
Feature freeze
 │
 ▼
ML evaluation
 │
 ▼
Final screenshots
 │
 ▼
Final report
 │
 ▼
DEMO
```

---

# 35. If You Have Only 24 Hours

Use the emergency cut:

```text
HOUR 0–4
Detection migration

HOUR 4–8
Core persistence migration

HOUR 8–10
Postgres cutover

HOUR 10–12
Regression fixes

HOUR 12–14
One E2E/demo path

HOUR 14–16
Final ML evaluation/screenshots

HOUR 16–20
Report

HOUR 20–22
Final demo rehearsal

HOUR 22–24
Freeze + backup + submission
```

Do not start:

```text
Redis
auth
multi-page
camera
React export
OCR
```

unless they are explicitly required for assessment.

---

# 36. If You Have 48–72 Hours

Add:

```text
Redis durable jobs
basic auth
```

only after the core PostgreSQL runtime is stable.

Use the rest of the time for:

```text
more regression tests
UI polish
ML evaluation
performance
documentation
```

---

# 37. What to Show in the Final Defense

The strongest story is:

## Problem

Hand-drawn wireframes are difficult to transform into working websites.

## Solution

Sketch2UI detects UI components from sketches and transforms them into structured HTML/CSS.

## Computer vision

Show:

```text
original sketch
→ page isolation
→ YOLO detections
```

## Intelligent reconstruction

Show:

```text
detections
→ UI tree
```

## Generation

Show:

```text
UI tree
→ HTML
→ CSS
```

## Runtime

Show:

```text
live preview
```

## User correction

Show:

```text
wrong detection
→ manual correction
→ regenerated page
```

## Engineering

Show:

```text
PostgreSQL
Prisma
repositories
```

## Evaluation

Show:

```text
precision
recall
mAP
inference time
limitations
```

This gives you a coherent academic story across:

```text
Computer Vision
+
Software Engineering
+
Web Development
+
Database
+
Human-in-the-loop correction
```

---

# 38. Final Definition of Done

Do not call the project complete because every planned feature exists.

Call it complete when:

```text
[ ] Sketch upload works
[ ] Page boundary works
[ ] Detection works
[ ] External notes are rejected
[ ] Manual correction works
[ ] Geometry works
[ ] Structure works
[ ] Style works
[ ] Content works
[ ] UI tree works
[ ] HTML works
[ ] CSS works
[ ] Preview works
[ ] Versions work
[ ] Export works
[ ] PostgreSQL runtime is stable
[ ] Core repositories are migrated
[ ] Regression checklist passes
[ ] Model limitations are documented
[ ] Final demo fixture is frozen
[ ] Final report evidence is captured
[ ] Final backup exists
```

Everything beyond this is optional for the deadline.

---

# 39. The Single Most Important Instruction

**Do not let Claude Code confuse “complete architecture” with “complete project.”**

A complete architecture can contain:

```text
Redis
Auth
Multi-page
OCR
React
Tailwind
Collaboration
V3 ML
```

and still fail the academic demonstration.

Your current project already has a working central value chain. Protect it, finish the PostgreSQL migration only as far as needed, verify it, freeze it, and submit a reliable system.

The best deadline strategy is:

```text
FINISH
>
EXPAND
```

and:

```text
VERIFY
>
ASSUME
```

and:

```text
STABLE DEMO
>
MORE FEATURES
```

---

# 40. Final Immediate Command

After saving this plan, go back to Claude Code and run **only the Detection prompt in §32**.

Do not ask Claude Code:

```text
"continue the whole plan"
```

Ask it:

```text
"Execute the Detection repository migration only."
```

When that phase is green, move to Boundary.

That controlled sequence is the fastest way to finish without turning the last few days into an uncontrolled rewrite.


---

# Appendix A — Per-Domain Completion Checklist

## Detection

- [ ] Repository contract reviewed
- [ ] JSON adapter reviewed
- [ ] Prisma adapter reviewed
- [ ] model→manual rule preserved
- [ ] originalClassName preserved
- [ ] clearModelDetections preserved
- [ ] contract tests pass
- [ ] API smoke passes
- [ ] core pipeline passes

## Boundary

- [ ] boundary read/write migrated
- [ ] manual boundary behavior preserved
- [ ] Python parity unchanged
- [ ] TypeScript parity unchanged
- [ ] boundary filtering smoke passes

## CodeVersion

- [ ] create version
- [ ] list versions
- [ ] activate
- [ ] immutable rows
- [ ] edited version behavior
- [ ] export uses active version

## Overrides

- [ ] Style
- [ ] Content
- [ ] Geometry
- [ ] Structure
- [ ] detection UUID identity preserved
- [ ] reset behavior preserved

## Training/Corrections

- [ ] correction history persisted
- [ ] training sample persisted
- [ ] original class preserved
- [ ] approval remains explicit

## Export

- [ ] export metadata
- [ ] ZIP path
- [ ] active version
- [ ] source sketch
- [ ] assets
- [ ] README

## Jobs

- [ ] job creation
- [ ] job state
- [ ] failure
- [ ] startup orphan handling
- [ ] detection polling


---

**Document statistics:** approximately 4,326 words. This plan is intentionally deadline-focused and based on the verified current project state rather than the original roadmap alone.
