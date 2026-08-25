# Sketch2UI — Deadline Execution Plan for the Remaining Product-Critical Features

**Purpose:** Finish the current Sketch2UI project quickly and safely before the academic deadline.

**Current high-priority gaps from `PROJECT_STATUS.md`:**

1. Authentication / account security
2. YOLO detector quality
3. Multi-page projects
4. CI/CD

The current project already has the core sketch → detect → correct → generate → preview → export pipeline working, PostgreSQL + Prisma fully migrated, all five Inspector groups complete, the frontend redesign complete, and two Playwright suites. The detector remains explicitly experimental; authentication and multi-page projects are not started; background jobs remain in-process; and there is no CI/CD workflow.

---

# 1. Deadline Strategy

Do **not** try to complete every item from the original long-term implementation plan.

Use this sequence:

```text
CURRENT STABLE PRODUCT
        ↓
D1 — Authentication
        ↓
D2 — Detector Quality / Evaluation
        ↓
D3 — Minimum Viable Multi-Page
        ↓
D4 — CI/CD
        ↓
D5 — Full Integration
        ↓
FEATURE FREEZE
        ↓
FINAL DEMO + REPORT
```

If the deadline becomes extremely tight:

```text
Authentication > Model evaluation > CI/CD > Multi-page
```

Move Multi-page to P0 if it is explicitly required by your academic marking scheme.

---

# 2. Verified Current State

According to the current status:

- Core pipeline is done and working end-to-end.
- Detection, Geometry, Structure, Style, and Content inspectors are done.
- Code editing and immutable code versions are done.
- Correction history is done.
- PostgreSQL + Prisma is fully migrated and live.
- All domains are behind repositories.
- Jobs are Postgres-backed but still execute in-process.
- Two Playwright suites exist.
- Frontend redesign is complete.
- Authentication is not started.
- Multi-page projects are not started.
- The YOLO model is still a smoke test: 156 images across 16 of 41 classes.
- No CI/CD workflow exists.

The status explicitly says the current application is a working single-user prototype and that the detector is the one component that is not production-grade yet.

---

# 3. Phase D0 — Safety Baseline

Before starting the four remaining features, run:

```bash
git status
npm run typecheck
npm run test
npm run test:py
npm run build
npm run test:e2e
```

Confirm:

```text
[ ] PostgreSQL runtime works
[ ] project creation works
[ ] upload works
[ ] detection works
[ ] correction works
[ ] code generation works
[ ] preview works
[ ] export works
[ ] frontend regression baseline is green
```

Create a dedicated branch:

```text
feat/deadline-completion
```

Do not mix unrelated frontend polish or V2/V3 research work into this branch.

---

# 4. Phase D1 — Authentication

## Goal

Convert:

```text
single implicit workspace
```

into:

```text
authenticated user
    ↓
owned projects
    ↓
authorized resources
```

## Scope

Implement only:

- User model
- registration
- login
- logout
- current session
- password hashing
- project ownership
- API authorization
- protected frontend routes

Do not implement:

- OAuth
- SSO
- MFA
- password reset email
- collaboration
- enterprise permissions

---

## 4.1 Database

Add:

```text
User
- id
- email
- passwordHash
- displayName
- role
- createdAt
- updatedAt
```

Add ownership:

```text
Project.ownerId
```

Use a controlled migration for all existing projects.

Do not hard-code a personal account.

Use a seeded/configured legacy owner only for migration.

---

## 4.2 Authentication API

Implement:

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

All project/resource routes must enforce authorization.

Minimum ownership rule:

```text
authenticated user
AND
resource.project.ownerId == user.id
```

Use the actual repository layer already present in the project.

Do not query Prisma directly from route handlers.

---

## 4.3 Session

Prefer a secure HTTP-only cookie session for this web app.

Production cookie properties:

```text
HttpOnly
Secure
appropriate SameSite
```

Never store passwords in plaintext.

---

## 4.4 Protected resources

Authorization must apply to:

```text
projects
assets
detections
boundaries
code versions
style overrides
content overrides
geometry overrides
structure overrides
training samples
corrections
exports
jobs
```

A user must not gain access by changing an ID in the URL/request.

---

## 4.5 Frontend

Add:

```text
/login
/register
```

and auth initialization:

```text
loading
authenticated
unauthenticated
error
```

Application flow:

```text
not authenticated
    ↓
login
    ↓
dashboard
```

Do not render the Dashboard before auth status is known.

---

## 4.6 Authentication acceptance criteria

```text
[ ] register
[ ] duplicate email handling
[ ] login
[ ] invalid password handling
[ ] logout
[ ] refresh keeps session
[ ] protected route
[ ] project ownership
[ ] cross-user project GET blocked
[ ] cross-user PATCH blocked
[ ] cross-user DELETE blocked
[ ] cross-user asset access blocked
[ ] legacy projects assigned safely
```

---

## 4.7 Claude Code Prompt — D1

```text
EMERGENCY DEADLINE MODE — PHASE D1 AUTHENTICATION

Read first:
- PROJECT_STATUS.md
- docs/execution/phase-log.md
- current Prisma schema
- repository contracts
- all project/resource API routes
- frontend router
- API service layer

Do not implement any other feature.

Current gap:
there are no users/sessions/ownership checks and any API caller can access any project.

Implement the smallest secure authentication system needed for the academic deadline.

BACKEND:
- User model
- register
- login
- logout
- current-user endpoint
- secure password hashing
- secure HTTP-only session cookie
- auth middleware
- Project.ownerId
- project ownership checks

Apply authorization to all project-owned resources:
projects
assets
detections
boundaries
code versions
style/content/geometry/structure overrides
training/corrections
exports
jobs

FRONTEND:
- login page
- register page
- auth initialization
- protected application routes
- logout

DO NOT implement:
OAuth
SSO
MFA
password reset
collaboration
complex RBAC

PRESERVE:
- PostgreSQL
- repository layer
- detection model→manual behavior
- code version immutability
- preview sandbox
- export
- all existing frontend behavior

TESTS:
- auth unit tests
- API auth tests
- cross-user authorization tests
- frontend auth tests
- existing Playwright golden path updated to authenticate

Run:
npm run typecheck
npm run test
npm run test:py
npm run build
npm run test:e2e

Do not weaken any existing security rule.

Stop after Phase D1 and report:
files changed
migration
routes
security decisions
tests
regression results
known limitations
next action.
```

---

# 5. Phase D2 — YOLO Detector Quality

## Current reality

The detector is explicitly marked:

```text
status = smoke_test
```

and is trained on:

```text
156 images
16 of 41 classes
```

The current model is YOLOv8-nano, not literal YOLOv5.

The status reports per-class AP varying substantially, with classes such as select/radio_button/carousel performing poorly.

---

## 5.1 Deadline decision

First determine whether **new labeled data actually exists**.

```text
New meaningful labels?
        │
       NO
        ↓
Evaluate v1.0
Document limitations
Keep v1.0
        │
       YES
        ↓
Validate dataset
Train candidate v1.1
Compare to baseline
Promote only if justified
```

Do not retrain on the same 156-image corpus simply to create a new version number.

---

## 5.2 Data priorities

If new labels exist, prioritize:

1. weak classes
2. common UI classes
3. difficult photographed sketches
4. external handwritten notes / arrows as hard negatives
5. page-boundary edge cases

Use the existing active-learning report to choose samples.

---

## 5.3 Training artifacts

Every candidate must preserve:

```text
weights
classes.txt
dataset version
training configuration
metrics
evaluation report
qualitative predictions
```

Keep v1.0 immutable.

Candidate:

```text
ui-detector/v1.1.0-candidate
```

---

## 5.4 Promotion gate

Do not promote based only on mAP.

Check:

```text
precision
recall
mAP@0.5
mAP@0.5:0.95
per-class AP
false positives
false negatives
page-boundary filtering
external-note rejection
inference latency
```

Do not promote if a critical class regresses materially.

---

## 5.5 Claude Code Prompt — D2

```text
EMERGENCY DEADLINE MODE — PHASE D2 MODEL QUALITY

Read:
- PROJECT_STATUS.md
- docs/ml/model-decision.md
- docs/eval/baseline-v1.0.0.json
- active-learning report
- current dataset scope
- current training scripts
- current model registry

FIRST determine:
- number of new labeled images
- classes covered
- annotation quality
- whether there is enough new information to justify retraining

If no meaningful new data exists:
DO NOT retrain.

Instead:
- run baseline evaluation
- produce qualitative prediction examples
- document smoke-test limitations
- keep v1.0.0 active
- stop Phase D2

If meaningful new data exists:
1. validate labels
2. create a new dataset version
3. prioritize weak/high-value classes
4. train candidate v1.1
5. evaluate against baseline-v1.0.0.json
6. produce per-class metrics
7. inspect false positives/false negatives
8. test outside-page filtering
9. measure inference latency
10. save reproducible artifacts

Do not silently switch YOLOv8-nano to YOLOv5.
If architecture changes, document the decision first.

Only promote v1.1 if the evidence supports it.

Run existing tests and keep the application integration working.

Stop after Phase D2 and report:
data change
model change
metrics
qualitative results
promotion decision
limitations.
```

---

# 6. Phase D3 — Minimum Viable Multi-Page Projects

## Why

Current model:

```text
one project = one sketch = one page
```

This is a genuine usage ceiling.

However, do not build a full site-builder CMS.

Implement the smallest useful model:

```text
Project
 ├ Page 1
 ├ Page 2
 └ Page N
```

---

## 6.1 Data model

Add:

```text
Page
- id
- projectId
- name
- order
- sourceAssetId
- createdAt
- updatedAt
```

Page-level data:

```text
asset
boundary
detections
overrides
corrections
code versions
```

Project-level data:

```text
owner
name
metadata
```

---

## 6.2 Backward compatibility

Every current single-page project must automatically become:

```text
Project
  └── Page 1
```

No existing data should be lost.

The current image/detections/code versions must be linked to Page 1.

---

## 6.3 Frontend

Do not rebuild Workspace.

Add only:

```text
Pages
----------------
Page 1
Page 2
+
```

Actions:

```text
Add
Rename
Switch
Delete
```

Require confirmation before deleting a page containing work.

---

## 6.4 Preview and code

Generate separate pages:

```text
index.html
page-2.html
page-3.html
styles.css
assets/
```

Use relative links:

```html
<a href="./page-2.html">About</a>
```

Do not add a new routing framework to generated sites.

---

## 6.5 Multi-page acceptance criteria

```text
[ ] old project opens as Page 1
[ ] add page
[ ] upload page
[ ] detect page
[ ] edit page
[ ] switch pages
[ ] previous page state preserved
[ ] generate page code
[ ] preview current page
[ ] export all pages
[ ] existing single-page workflow still passes
```

---

## 6.6 Claude Code Prompt — D3

```text
EMERGENCY DEADLINE MODE — PHASE D3 MULTI-PAGE

Read:
- PROJECT_STATUS.md
- Prisma schema
- repository interfaces
- current ProjectWorkspace
- code generation
- export logic
- docs/frontend/workspace-design.md

Implement the smallest usable multi-page architecture.

Target:
Project → Page[]

Each Page owns:
- source asset
- boundary
- detections
- overrides
- corrections
- code versions

Backward compatibility:
every existing one-page project must become Page 1 automatically.

Do not rewrite:
- canvas
- UI tree
- Inspector
- code editor
- preview

Add only a compact page selector to the existing Workspace.

Support:
- add page
- switch page
- rename page
- delete page

Each page must maintain independent state.

Export:
index.html
page-2.html
page-3.html
styles.css
assets/

Use relative links between pages.

DO NOT implement:
CMS
collaboration
React export
advanced routing
templates

Tests:
- existing projects migrate to Page 1
- add/switch/delete
- per-page upload
- per-page detection
- per-page code
- per-page export
- existing golden path still passes

Run:
npm run typecheck
npm run test
npm run test:py
npm run build
npm run test:e2e

Stop after D3.
```

---

# 7. Phase D4 — CI/CD

## Goal

Create a minimal automated quality gate.

Create:

```text
.github/workflows/ci.yml
```

Required:

```text
typecheck
Vitest
Pytest
build
Playwright
```

Do not run ML training in normal CI.

Do not configure production deployment unless explicitly required.

---

## 7.1 CI structure

```text
checkout
   ↓
Node setup
   ↓
npm ci
   ↓
typecheck
   ↓
Vitest
   ↓
Python setup
   ↓
Pytest
   ↓
build
   ↓
Playwright
```

Use isolated test storage/database.

Never connect CI to development PostgreSQL.

---

## 7.2 Claude Code Prompt — D4

```text
EMERGENCY DEADLINE MODE — PHASE D4 CI/CD

Read:
- PROJECT_STATUS.md
- package.json
- apps/web/package.json
- apps/api/package.json
- Python test configuration
- Playwright configuration

Create the smallest reliable GitHub Actions CI pipeline.

Create:
.github/workflows/ci.yml

Required checks:
- typecheck
- Vitest
- Pytest
- production build
- Playwright E2E

Use the exact existing project commands.

Use isolated test data.
Never use development credentials.
Never connect to the real dev database.

Do NOT train YOLO in CI.
Do NOT add automatic production deployment.

Use clear job names.

Validate the workflow and run local equivalents before declaring it complete.

Stop after D4.
```

---

# 8. Phase D5 — Final Integration

After D1–D4:

## Authentication

```text
Register
 ↓
Login
 ↓
Dashboard
```

## Core

```text
Create project
 ↓
Page 1
 ↓
Upload
 ↓
Boundary
 ↓
Detect
 ↓
Correct
 ↓
Generate
 ↓
Preview
```

## Multi-page

```text
Add Page 2
 ↓
Upload
 ↓
Detect
 ↓
Generate
 ↓
Switch Page 1/Page 2
 ↓
Export
```

## Security

```text
Logout
 ↓
Protected resource rejected
```

---

# 9. Final Regression Matrix

## Authentication

```text
[ ] Register
[ ] Login
[ ] Logout
[ ] Refresh session
[ ] Protected route
[ ] User ownership
[ ] Cross-user GET blocked
[ ] Cross-user PATCH blocked
[ ] Cross-user DELETE blocked
```

## Detection

```text
[ ] Detect
[ ] external notes filtered
[ ] correction → manual
[ ] re-detection preserves manual
```

## Multi-page

```text
[ ] Page 1
[ ] Page 2
[ ] add
[ ] rename
[ ] switch
[ ] delete
[ ] page-specific state
[ ] multi-page export
```

## Core

```text
[ ] upload
[ ] page boundary
[ ] UI tree
[ ] HTML
[ ] CSS
[ ] preview
[ ] code edit
[ ] version activation
[ ] style
[ ] content
[ ] geometry
[ ] structure
[ ] export
```

## CI

```text
[ ] typecheck
[ ] Vitest
[ ] Pytest
[ ] build
[ ] E2E
```

---

# 10. Deadline Timeboxes

Use hard limits.

| Feature | Suggested timebox |
|---|---:|
| Authentication | 4–8 hours |
| Model evaluation / retrain | 2–8 hours |
| Multi-page | 6–10 hours |
| CI/CD | 2–4 hours |
| Final integration | 3–6 hours |

If a feature exceeds its timebox significantly, stop and reassess instead of continuously expanding scope.

---

# 11. If You Have Only 24 Hours

Use this emergency order:

```text
Hour 0–1
Baseline + branch

Hour 1–6
Authentication

Hour 6–10
Full regression + auth fixes

Hour 10–12
Model evaluation
(no retrain unless new data already exists)

Hour 12–16
CI/CD

Hour 16–20
Final integration

Hour 20–22
Demo + screenshots + report evidence

Hour 22–24
Feature freeze + final verification
```

Defer Multi-page unless it is explicitly required by assessment.

---

# 12. If You Have 48–72 Hours

Use:

```text
Day 1:
Authentication
Model evaluation

Day 2:
Multi-page
CI/CD

Day 3:
Integration
Testing
Report
Demo
```

---

# 13. Model Allocation for Claude Code

Use:

```text
Opus
    Auth architecture
    Security review
    Multi-page schema
    Model strategy
    Final integration debugging

Sonnet
    Main implementation
    API
    React
    Prisma
    CV integration

Haiku
    Repetitive tests
    CI YAML
    Dataset statistics
    Documentation cleanup
```

The expensive model should reason about architecture; it should not write every repetitive test or YAML line.

---

# 14. Final Release Definition

For the deadline release, the project is complete when:

```text
AUTH
✅ register
✅ login
✅ logout
✅ protected app
✅ project ownership

AI
✅ detector works
✅ evaluation evidence exists
✅ limitations honestly documented
✅ improved model promoted only if justified

MULTI-PAGE
✅ project can contain pages
✅ each page maintains state
✅ multi-page export

CI
✅ typecheck
✅ tests
✅ pytest
✅ build
✅ Playwright

CORE
✅ sketch
✅ detect
✅ correct
✅ UI tree
✅ HTML
✅ CSS
✅ preview
✅ versioning
✅ export

REGRESSION
✅ final test suite green
✅ final manual walkthrough green

DELIVERABLES
✅ final screenshots
✅ architecture diagram
✅ model evaluation
✅ known limitations
✅ demo script
```

---

# 15. What Must Stay Deferred

Do not start these before the final release unless explicitly required:

```text
OAuth
SSO
MFA
team collaboration
React export
Tailwind export
OCR
multilingual OCR
camera capture
perspective correction
themes
advanced component palette
layout transformer
multimodal model
automatic active-learning loop
cloud autoscaling
```

---

# 16. Master Claude Code Prompt

```text
EMERGENCY DEADLINE MODE — FINAL SKETCH2UI COMPLETION

Read:
- PROJECT_STATUS.md
- docs/execution/phase-log.md
- docs/execution/current-baseline.md
- docs/execution/regression-checklist.md
- docs/frontend/README.md
- docs/ml/model-decision.md

The project is already a working prototype.

DO NOT rebuild:
- sketch→detect→correct→generate→preview→export
- PostgreSQL/Prisma
- Inspector
- frontend design
- repository layer
- code versioning
- export

REMAINING PRODUCT-CRITICAL FEATURES:
D1 Authentication
D2 Detector quality/evaluation
D3 Minimum multi-page
D4 CI/CD
D5 Final integration

RULE:
ONE PHASE AT A TIME.

For every phase:
1. inspect
2. define smallest change
3. implement
4. test
5. build
6. E2E
7. regression
8. report
9. STOP

D1:
Implement minimal secure authentication and project ownership.

D2:
Do not retrain unless meaningful new labeled data exists.
If no new data exists, evaluate v1.0.0 and document its limitations.

D3:
Implement Project → Page[] with automatic Page 1 for existing projects.
Do not redesign Workspace.

D4:
Create CI for typecheck + Vitest + Pytest + build + Playwright.
Do not run model training in CI.

D5:
Run full end-to-end integration.

ABSOLUTE RULES:
- preserve current API contracts
- preserve repositories
- preserve model→manual
- preserve manual corrections
- preserve immutable code versions
- preserve boundary filtering
- preserve preview sandbox
- preserve existing frontend design
- do not add unrelated features
- do not make unsupported accuracy claims
- do not make destructive migrations without tests
- never use real development data in CI tests

DEADLINE PRIORITY:
correctness > regression safety > security > demo reliability > extra features

When all P0 acceptance criteria pass:
STOP FEATURE DEVELOPMENT.
Prepare release report, demo, screenshots, and known limitations.
```

---

# 17. Immediate Next Action

Start with **D1 Authentication**.

Do not ask Claude Code:

```text
"finish the remaining project"
```

Instead use:

```text
"Execute Phase D1 — Authentication only."
```

After D1 passes completely, execute D2.

The current status explicitly identifies authentication as the largest gap for turning the current single-user prototype into a multi-user product, while detector quality remains the main product-quality limitation. Multi-page is a genuine usage ceiling, and CI/CD is an engineering reliability gap.

The key deadline rule is:

> **Finish the smallest defensible version of each product-critical feature, verify it, then freeze. Do not turn the last few days into a rewrite.**


---

# 18. Final Day Freeze Checklist

```text
[ ] Git status reviewed
[ ] Development database backed up/verified
[ ] Auth tests pass
[ ] Cross-user authorization tests pass
[ ] Model evaluation report saved
[ ] Multi-page migration tested if implemented
[ ] CI workflow passes
[ ] npm run typecheck
[ ] npm run test
[ ] npm run test:py
[ ] npm run build
[ ] npm run test:e2e
[ ] final manual regression complete
[ ] final demo fixture frozen
[ ] screenshots captured
[ ] known limitations documented
[ ] final commit/tag created
```

When this checklist is complete:

```text
FEATURE FREEZE
```

Only release-blocking bug fixes are allowed after the freeze.


---

**Document statistics:** approximately 2,724 words.
