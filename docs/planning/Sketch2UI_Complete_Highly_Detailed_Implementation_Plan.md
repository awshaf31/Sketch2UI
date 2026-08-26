---
title: "Sketch2UI Web Application — Complete Highly Detailed Implementation Plan"
project: "Sketch2UI"
target: "Hand-drawn wireframe → HTML/CSS → live preview"
computer_vision: "YOLOv5 tiny-style lightweight UI object detector"
document_version: "1.0"
status: "Implementation blueprint"
---

# Sketch2UI Web Application — Complete Highly Detailed Implementation Plan

> **Scope:** Hand-drawn wireframe sketch → computer-vision detection → layout reconstruction → HTML/CSS generation → live preview, with correction, persistence, export, evaluation, and a future training feedback loop.

## Table of Contents

1. Product Definition and Scope
2. User Personas and User Journeys
3. Functional Requirements
4. System Architecture
5. Recommended Technology Stack
6. Frontend Architecture in Detail
7. Backend Architecture in Detail
8. Database Design and Data Model
9. YOLOv5 Tiny Model Design
10. Page Boundary and External-Annotation Filtering
11. Layout Reconstruction Engine
12. Semantic UI Intermediate Representation
13. HTML Generation Engine
14. CSS Generation Engine
15. Live Preview Architecture
16. Complete Feature List
17. Project Workspace UX
18. API Specification
19. Security and Safety
20. Testing Strategy
21. Evaluation Framework
22. Training and Dataset Management Workflow
23. Repository Structure
24. Implementation Roadmap
25. Detailed Sprint Plan
26. Development Environment Setup
27. Queue and Background Job Implementation
28. Performance Plan
29. Observability and Logging
30. CI/CD Plan
31. Code Quality and Architecture Rules
32. Error Handling Matrix
33. UI Component Class Taxonomy
34. Example: Car Marketplace Sketch Conversion
35. Example: Two-Page Recipe Sketch Conversion
36. Training Feedback Loop
37. Research and Academic Demonstration Plan
38. Recommended MVP Definition
39. Recommended V1 Feature Definition
40. Final End-to-End Architecture
41. Suggested File-by-File Implementation Order
42. Example Data Contracts
43. Database Relationships
44. Deployment Architecture
45. Backup and Recovery
46. Documentation Plan
47. Risk Register
48. Recommended Milestone Demonstrations
49. Final Recommended Product Feature Matrix
50. Final Acceptance Checklist
51. Practical Build Order
52. Suggested Final Technology Decision
53. What “Sketch2UI Complete” Means
54. Appendices

# Sketch2UI Web Application — Complete Highly Detailed Implementation Plan

## Executive summary

**Sketch2UI** is a web application that converts a hand-drawn UI/wireframe sketch into a structured, editable web interface and then generates **HTML + CSS** with a synchronized **live preview**. The core computer-vision component is a custom lightweight **YOLOv5 tiny-style object detector** trained specifically on wireframe UI components. The detector identifies the visible components and their bounding boxes; a separate layout-reconstruction engine converts those detections into a hierarchy; a deterministic code generator converts that hierarchy into HTML/CSS; and the browser renders the result in an isolated preview.

The important architectural decision is to avoid treating the task as a single opaque “image in, code out” model. Instead, Sketch2UI should use a pipeline:

```text
Hand-drawn sketch
        │
        ▼
Image upload / canvas
        │
        ▼
Image preprocessing
        │
        ▼
Page boundary detection
        │
        ▼
YOLOv5 tiny component detection
        │
        ▼
Detection filtering / post-processing
        │
        ▼
Geometric layout reconstruction
        │
        ▼
Semantic UI tree
        │
        ├───────────────┐
        ▼               ▼
   UI inspector     Code generator
                        │
                        ▼
                 HTML + CSS + JS
                        │
                        ▼
                  Live preview
```

The application should also include a manual correction layer. This is essential because handwritten sketches are ambiguous: a detector may identify a box as an image when it is intended as a card, or may miss a faint button. The user must be able to correct the detection and immediately regenerate the page.

The proposed system is intentionally structured so that every major transformation can be inspected:

```text
source image
    ↓
page region
    ↓
raw detections
    ↓
filtered detections
    ↓
layout groups
    ↓
semantic UI tree
    ↓
generated HTML/CSS
    ↓
preview
```

This makes the project much easier to demonstrate academically, debug experimentally, and improve with additional training data.

## Primary goals

1. Detect UI components from hand-drawn wireframes.
2. Ignore explanatory annotations outside the webpage.
3. Preserve approximate positions and sizes.
4. Infer major page sections.
5. Reconstruct hierarchy from spatial relationships.
6. Generate clean semantic HTML.
7. Generate maintainable CSS.
8. Render the generated interface as a live preview.
9. Let users correct components without restarting the entire process.
10. Persist projects and revisions.
11. Keep model versions reproducible.
12. Produce quantitative computer-vision metrics.
13. Create a foundation for future model improvement through corrected samples.

# 1. Product Definition and Scope

### 1.1 Problem statement

A hand-drawn wireframe communicates visual intent but is not directly executable. A designer or student commonly sketches:

- a page boundary;
- a header;
- a logo;
- navigation;
- a hero area;
- images;
- headings;
- paragraphs;
- buttons;
- cards;
- forms;
- lists;
- a footer.

The drawing may also contain external notes such as “this image remains static”, “add more sections”, “go to page 4”, measurements, arrows, and explanations. A naïve vision pipeline may incorrectly classify those notes as UI components.

Sketch2UI addresses this by explicitly separating **webpage content** from **external annotation**.

### 1.2 In-scope functionality

The first full implementation should include:

- user account or local project mode;
- image upload;
- drag-and-drop;
- image preview;
- page boundary identification;
- optional perspective correction;
- YOLOv5 tiny detection;
- confidence filtering;
- detection overlay;
- class editing;
- box editing;
- component insertion;
- component deletion;
- component hierarchy;
- section grouping;
- HTML generation;
- CSS generation;
- live preview;
- desktop/tablet/mobile preview sizes;
- code editor;
- project save/load;
- version history;
- export;
- basic dataset feedback capture.

### 1.3 Out-of-scope for MVP

The following should be deferred:

- full semantic understanding of arbitrary handwriting;
- automatic business-logic generation;
- authentication against complex enterprise identity providers;
- production-grade multi-user collaborative editing;
- arbitrary JavaScript execution from user uploads;
- perfect image-to-image visual matching;
- generation of backend application logic from a sketch;
- automatic conversion to every frontend framework.

### 1.4 Core product workflow

```text
Create Project
    ↓
Upload Sketch
    ↓
Preview / Crop
    ↓
Detect Components
    ↓
Review Detections
    ↓
Fix Missing / Wrong Components
    ↓
Build UI Tree
    ↓
Generate HTML/CSS
    ↓
Open Live Preview
    ↓
Edit / Regenerate
    ↓
Save Version
    ↓
Export Project
```

### 1.5 Quality targets

The system should be evaluated at four levels:

**Vision level**
- object detection precision;
- object detection recall;
- mAP;
- class-specific AP;
- page-boundary accuracy.

**Layout level**
- section detection accuracy;
- parent-child assignment accuracy;
- reading-order accuracy;
- repeated-card grouping accuracy.

**Code level**
- generated HTML validity;
- CSS validity;
- number of runtime errors;
- semantic structure quality.

**Product level**
- time from upload to preview;
- correction time;
- successful export rate;
- user acceptance rate.

# 2. User Personas and User Journeys

### 2.1 Student/developer persona

The student uploads a photographed paper sketch and expects an initial website within a short interaction. They want to inspect the detected components rather than manually code everything.

### 2.2 UI/UX learner persona

This user uses Sketch2UI as a learning tool. They want to see how a visual wireframe becomes:

```text
HTML structure
+
CSS layout
```

They need an educational “explain detection” mode showing why components were recognized.

### 2.3 Dataset annotator persona

The annotator reviews detections and fixes:

- missing boxes;
- incorrect classes;
- inaccurate coordinates;
- outside-page false positives.

The resulting correction becomes a training candidate.

### 2.4 Administrator persona

The administrator manages:

- users;
- trained models;
- dataset versions;
- class definitions;
- failed jobs;
- system health;
- model deployment.

### 2.5 Main user journey

1. Open dashboard.
2. Create a project.
3. Upload a hand-drawn wireframe.
4. See image preview.
5. Click Detect.
6. Wait for model processing.
7. See a page boundary and colored detections.
8. Inspect the detected UI tree.
9. Correct an incorrectly classified component.
10. Add a missing button.
11. Click Generate Code.
12. Open live preview.
13. Modify a style property.
14. Regenerate.
15. Save version.
16. Download the project.

### 2.6 Error journey

If detection fails:

```text
Job failed
    ↓
Show failure stage
    ↓
Show user-readable error
    ↓
Keep original image
    ↓
Allow retry
```

Do not delete the project because one inference job failed.

# 3. Functional Requirements

### 3.1 FR-01 Project management

The system shall allow users to create, rename, open, archive, and delete projects.

Each project stores:

- project name;
- description;
- source image;
- detection result;
- UI tree;
- generated code;
- preview settings;
- model version;
- created date;
- updated date.

### 3.2 FR-02 Image ingestion

The system shall accept supported image files and reject unsupported or unsafe uploads.

Validation must inspect:

- file type;
- file size;
- image dimensions;
- image decode success.

Do not trust the browser-provided MIME type alone.

### 3.3 FR-03 Detection

The system shall run the selected detector and store:

- class;
- class ID;
- confidence;
- normalized bounding box;
- model version;
- inference timestamp.

### 3.4 FR-04 Page boundary

The system shall identify the primary webpage region and use it to suppress external annotations.

### 3.5 FR-05 Human correction

The system shall support creating, changing, moving, resizing, and deleting detections.

### 3.6 FR-06 Layout reconstruction

The system shall create a semantic UI tree from accepted detections.

### 3.7 FR-07 Code generation

The system shall create valid HTML and CSS based on the UI tree.

### 3.8 FR-08 Preview

The system shall render generated code in an isolated preview.

### 3.9 FR-09 Export

The system shall export source code and assets in a downloadable package.

### 3.10 FR-10 Revision history

The system shall save code versions and permit users to reopen earlier versions.

### 3.11 FR-11 Dataset feedback

The system shall permit approved corrections to be exported as future YOLO training samples.

### 3.12 Non-functional requirements

**Performance**
- avoid blocking web server threads on inference;
- use background jobs;
- cache generated artifacts where possible.

**Reliability**
- failed jobs should be retryable;
- database writes should be transactional;
- generated code should be versioned.

**Security**
- validate uploads;
- isolate preview;
- use least-privilege credentials;
- never run untrusted code on the API host.

**Maintainability**
- separate CV, API, UI, and code-generation responsibilities;
- use typed API contracts;
- add automated tests.

**Observability**
- every job should have a correlation ID;
- record stage durations;
- record model version.

# 4. System Architecture

### 4.1 Logical architecture

```text
┌────────────────────────────────────────────────────────────┐
│                        Web Browser                         │
│                                                            │
│  React UI                                                  │
│  ├── Project dashboard                                     │
│  ├── Sketch canvas                                         │
│  ├── Detection overlay                                     │
│  ├── Component tree                                        │
│  ├── Inspector                                              │
│  ├── Code editor                                            │
│  └── Live preview                                           │
└────────────────────────────┬───────────────────────────────┘
                             │ HTTPS
                             ▼
┌────────────────────────────────────────────────────────────┐
│                  Node.js / Express API                    │
│                                                            │
│ Auth • Projects • Uploads • Jobs • Detections • Code       │
└───────────────┬───────────────────┬────────────────────────┘
                │                   │
                │                   ▼
                │             ┌──────────────┐
                │             │ Object Store │
                │             │ Images/ZIPs  │
                │             └──────────────┘
                │
                ▼
          ┌──────────────┐
          │ PostgreSQL   │
          │ Metadata     │
          └──────┬───────┘
                 │
                 ▼
          ┌──────────────┐
          │ Redis / Queue│
          └──────┬───────┘
                 │
                 ▼
     ┌──────────────────────────────┐
     │ Python CV / ML Worker        │
     │                              │
     │ OpenCV                       │
     │ Page boundary preprocessing  │
     │ YOLOv5 tiny inference        │
     │ Post-processing              │
     │ Geometry / layout extraction │
     └──────────────┬───────────────┘
                    │
                    ▼
          ┌───────────────────┐
          │ Layout Engine     │
          │ UI Tree Builder   │
          └─────────┬─────────┘
                    │
                    ▼
          ┌───────────────────┐
          │ HTML/CSS Generator│
          └───────────────────┘
```

### 4.2 Why this architecture

A single service would make development easier initially, but a separated architecture is better for the final system because computer-vision inference has different dependencies and scaling characteristics from normal application requests.

The web API should remain responsive while the model processes an image.

### 4.3 Deployment modes

**Development**

```text
React
Node API
Python worker
PostgreSQL
Redis
local filesystem
```

**Production-like local deployment**

Use Docker Compose:

```text
frontend
api
cv-worker
postgres
redis
```

**Cloud deployment**

Replace local storage with object storage and deploy the API and worker separately.

# 5. Recommended Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- TanStack Query
- Zustand
- React Router
- Monaco Editor
- SVG/Canvas overlays

### Backend

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- Redis
- BullMQ

### ML

- Python
- PyTorch
- YOLOv5 tiny-style model
- OpenCV
- Pillow
- NumPy

### Testing

- Vitest
- React Testing Library
- Playwright
- Jest or Node test runner
- Pytest

### Developer tooling

- ESLint
- Prettier
- Husky/lint-staged
- Docker
- GitHub Actions

### Why HTML/CSS first

HTML and CSS are the most transparent target for an academic prototype. They make it easy to show the transformation:

```text
detected button
        ↓
<button>
        ↓
CSS rule
        ↓
rendered button
```

React export should be implemented after the HTML/CSS path is stable.

# 6. Frontend Architecture in Detail

### 6.1 Frontend directory

```text
frontend/
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── common/
│   │   ├── upload/
│   │   ├── canvas/
│   │   ├── detection/
│   │   ├── inspector/
│   │   ├── tree/
│   │   ├── code/
│   │   └── preview/
│   ├── features/
│   │   ├── projects/
│   │   ├── detection/
│   │   ├── layout/
│   │   ├── generation/
│   │   └── export/
│   ├── hooks/
│   ├── services/
│   ├── stores/
│   ├── types/
│   ├── utils/
│   └── pages/
└── public/
```

### 6.2 State separation

Do not store everything in a single global state object.

Use:

**Server state**
- projects;
- job status;
- detections;
- code versions.

Manage using TanStack Query.

**Local editor state**
- selected object;
- drag state;
- resize state;
- active panel;
- zoom;
- temporary style edits.

Manage using Zustand or local React state.

### 6.3 Upload component

Features:

- drag and drop;
- file picker;
- validation;
- preview;
- cancel;
- replace.

The component should produce a project asset ID rather than passing raw image data around the entire UI.

### 6.4 Canvas renderer

The original image should be displayed as the background.

The overlay uses SVG because SVG makes rectangles, labels, arrows, and handles easy to manipulate.

Example:

```text
<svg>
  <rect ... />
  <text ... />
</svg>
```

### 6.5 Coordinate system

Keep model coordinates normalized.

Convert for display:

```text
screenX = normalizedX * imageWidth
screenY = normalizedY * imageHeight
```

This avoids errors when the browser resizes the image.

### 6.6 Selection system

Clicking an object on canvas should:

- set selected ID;
- highlight object;
- open inspector;
- highlight corresponding tree node.

This is a critical UX connection between visual and structural representations.

### 6.7 Inspector

The inspector should show:

- class;
- confidence;
- parent;
- x;
- y;
- width;
- height;
- content;
- generated HTML role;
- style properties.

### 6.8 Component tree

The tree can be rendered recursively:

```tsx
function TreeNode({ node }) {
  return (
    <div>
      <NodeRow node={node} />
      {node.children?.map(child => (
        <TreeNode key={child.id} node={child} />
      ))}
    </div>
  );
}
```

### 6.9 Code editor

Display:

- generated HTML;
- generated CSS;
- generated JS;
- component JSON.

Use read-only mode initially, then add editable mode.

### 6.10 Live preview

Do not mount generated React directly into the main application DOM. Use an isolated iframe.

For an academic MVP:

```text
iframe
sandbox="allow-scripts"
srcDoc="<generated html>"
```

### 6.11 Responsive controls

The preview toolbar:

```text
Desktop  1440px
Tablet    768px
Mobile    390px
Custom
```

### 6.12 Autosave

Debounce save operations.

For example:

```text
user changes property
    ↓
wait 500–1000 ms
    ↓
save draft
```

Do not save after every mouse movement during dragging.

# 7. Backend Architecture in Detail

### 7.1 Service responsibilities

**API**
- authentication;
- project CRUD;
- upload management;
- job creation;
- result retrieval;
- corrections;
- code generation requests;
- export requests.

**CV Worker**
- image preprocessing;
- page detection;
- YOLO inference;
- postprocessing;
- optional layout calculations.

**Code Generator**
- semantic UI tree → HTML;
- style tree → CSS;
- assets → paths.

### 7.2 API layers

```text
route
 ↓
controller
 ↓
service
 ↓
repository
 ↓
database
```

Avoid putting business logic directly in Express route handlers.

### 7.3 Example controller

Conceptual:

```ts
export async function createProject(req, res) {
  const project = await projectService.create({
    userId: req.user.id,
    name: req.body.name
  });

  res.status(201).json(project);
}
```

### 7.4 Job API

```http
POST /api/projects/:id/detect
```

returns:

```json
{
  "jobId": "job_123",
  "status": "queued"
}
```

The frontend then uses:

```http
GET /api/jobs/job_123
```

### 7.5 WebSocket option

For a smoother interface, use WebSocket or Server-Sent Events for progress updates.

Example:

```text
queued
preprocessing
page_detection
component_detection
layout_inference
code_generation
completed
```

Polling is simpler for the MVP.

### 7.6 Error model

Return consistent errors:

```json
{
  "error": {
    "code": "INVALID_IMAGE",
    "message": "The uploaded file could not be decoded as an image."
  }
}
```

Do not expose Python tracebacks to the browser.

# 8. Database Design and Data Model

### 8.1 Main tables

```text
users
projects
project_assets
jobs
detections
ui_nodes
code_versions
model_versions
annotations
training_samples
exports
audit_logs
```

### 8.2 users

```sql
id UUID PRIMARY KEY
email TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
display_name TEXT
role TEXT NOT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

### 8.3 projects

```sql
id UUID PRIMARY KEY
user_id UUID NOT NULL
name TEXT NOT NULL
description TEXT
status TEXT NOT NULL
active_model_version_id UUID
created_at TIMESTAMP
updated_at TIMESTAMP
```

### 8.4 project_assets

Store metadata only:

```sql
id
project_id
storage_key
mime_type
width
height
file_size
sha256
created_at
```

### 8.5 detections

```sql
id
project_id
source_asset_id
class_id
class_name
confidence
x
y
width
height
status
source
model_version_id
created_at
updated_at
```

`source` values:

```text
model
manual
imported
```

### 8.6 ui_nodes

```sql
id
project_id
parent_id
node_type
display_order
x
y
width
height
content_json
style_json
created_at
updated_at
```

### 8.7 code_versions

```sql
id
project_id
version_number
html
css
javascript
metadata_json
created_at
```

### 8.8 training_samples

```sql
id
project_id
image_asset_id
annotation_asset_key
approved
dataset_split
created_at
```

### 8.9 audit_logs

Store:

- who changed an object;
- what changed;
- when it changed.

This is useful for debugging corrections.

# 9. YOLOv5 Tiny Model Design

### 9.1 Detection responsibility

The model receives an image and returns objects:

```text
class
confidence
x
y
width
height
```

It should focus on visually recognizable elements rather than generating markup.

### 9.2 Recommended first class set

Use common classes to improve consistency:

```text
page
header
footer
section
navbar
nav_item
logo
heading
text
link
button
icon
image
card
card_title
card_text
card_button
list
list_item
input
textarea
select
form
search_box
menu_button
breadcrumb
carousel
carousel_prev
carousel_next
carousel_indicator
video
social_icon
map
divider
newsletter
contact_form
testimonial
```

Start with fewer classes if the dataset is small.

### 9.3 Why fewer classes help

A handwritten “small rectangle” may visually resemble:

- input;
- button;
- image placeholder;
- card;
- select.

With a tiny dataset, too many similar classes increase confusion.

The class vocabulary should be expanded only after the first detector becomes stable.

### 9.4 Dataset requirements

Collect examples with:

- different paper types;
- different pen/pencil thickness;
- different camera angles;
- different lighting;
- different handwriting;
- different UI structures;
- different page lengths;
- different annotation styles.

### 9.5 Negative examples

Negative examples should include:

- outside-page notes;
- arrows;
- random handwriting;
- measurements;
- decorative strokes;
- table grid lines;
- page titles outside the page.

These should not be interpreted as UI components.

### 9.6 Annotation policy

Each object gets one label according to a clear annotation guide.

Do not change labeling rules from image to image.

### 9.7 Dataset split

Use a project-independent split.

Do not put near-identical sketches into both training and test sets.

Recommended starting split:

```text
train 70–80%
validation 10–20%
test 10–15%
```

The exact percentages can be adjusted according to dataset size.

### 9.8 Training process

1. Prepare dataset.
2. Validate labels.
3. Create `data.yaml`.
4. Train from pretrained lightweight weights.
5. evaluate;
6. inspect confusion matrix;
7. identify weak classes;
8. add difficult examples;
9. retrain;
10. freeze the model version.

### 9.9 Metrics

Track:

- precision;
- recall;
- mAP@0.5;
- mAP@0.5:0.95;
- per-class AP;
- false-positive rate;
- false-negative rate;
- latency;
- memory usage.

### 9.10 Model registry

Never store “latest.pt” as the only artifact.

Use:

```text
ui-detector/
├── v1.0.0/
│   ├── weights.pt
│   ├── data.yaml
│   ├── classes.txt
│   ├── metrics.json
│   └── README.md
└── v1.1.0/
```

Record the active model version in the database.

# 10. Page Boundary and External-Annotation Filtering

### 10.1 Motivation

Many sketches have handwritten notes outside the webpage. The detector should not learn those notes as webpage content.

### 10.2 Recommended pipeline

```text
original image
   ↓
page boundary detector
   ↓
perspective correction
   ↓
cropped page image
   ↓
YOLOv5 inference
   ↓
detections
   ↓
boundary filtering
```

### 10.3 Boundary strategies

**Strategy A — explicit page class**

Train `page`.

**Strategy B — OpenCV contours**

Useful when page borders are clear.

**Strategy C — manual correction**

Always provide a fallback in the UI.

### 10.4 Hard filtering rule

Only retain detections that are within the accepted page geometry.

Pseudo-logic:

```python
if not point_inside(page_polygon, detection.center):
    reject()
```

Use overlap thresholds for boxes that cross the boundary.

### 10.5 Multiple pages

If the photo contains two pages:

```text
page 1
page 2
```

the application may create:

```text
Project
 ├── Page 1
 └── Page 2
```

A later implementation can support multiple page outputs.

### 10.6 UI representation

Show page boundary in a distinct color.

Display:

```text
Page detected
Confidence: 0.97
```

Allow the user to resize the boundary.

### 10.7 Annotation exclusion

External notes should remain visible in the source image but not appear in the accepted detection set.

This is preferable to physically deleting them from the source.

# 11. Layout Reconstruction Engine

YOLO produces objects, not a DOM. The layout engine bridges that gap.

### 11.1 Input

A list of detections:

```json
[
  {"class":"header", "bbox":[...]},
  {"class":"logo", "bbox":[...]},
  {"class":"nav_item", "bbox":[...]},
  {"class":"section", "bbox":[...]},
  {"class":"card", "bbox":[...]}
]
```

### 11.2 Output

A semantic tree:

```json
{
  "type": "page",
  "children": [
    {
      "type": "header",
      "children": [
        {"type": "logo"},
        {
          "type": "navbar",
          "children": [
            {"type":"nav_item"}
          ]
        }
      ]
    }
  ]
}
```

### 11.3 Parent inference

A child is a candidate for parent `P` when:

```text
child center is inside parent bbox
AND
parent is semantically plausible
```

Example:

```text
button inside card -> card_button
image inside card  -> card_image
nav_item inside navbar -> child of navbar
```

### 11.4 Semantic priority

Some classes should have stronger structural meaning.

Example:

```text
page
header
section
footer
card
form
navbar
```

These are likely containers.

Atomic components:

```text
text
icon
button
image
```

should generally become children of a container.

### 11.5 Reading order

Within a section:

1. sort by y coordinate;
2. group elements into rows using vertical tolerance;
3. within each row, sort by x coordinate.

### 11.6 Row detection

Two boxes belong to the same row if their vertical center difference is below a tolerance relative to image height.

Conceptually:

```python
abs(center_y_a - center_y_b) < row_threshold
```

### 11.7 Column detection

Within a row, repeated x spacing suggests columns.

### 11.8 Grid inference

Example:

```text
card card card card
card card card card
```

The engine can infer:

```css
display: grid;
grid-template-columns: repeat(4, 1fr);
```

### 11.9 Flex inference

A horizontal navigation with similar-size children may become:

```css
display: flex;
gap: 24px;
align-items: center;
```

### 11.10 Stack inference

Elements separated vertically become:

```css
display: flex;
flex-direction: column;
```

### 11.11 Absolute-position fallback

When spatial relationships are too irregular, use relative/absolute positioning temporarily.

However, the code generator should prefer layout systems over excessive absolute positioning because the output should be maintainable.

# 12. Semantic UI Intermediate Representation (UI-IR)

A stable intermediate representation is the most important non-ML abstraction in the application.

### 12.1 Example

```json
{
  "schemaVersion": "1.0",
  "type": "page",
  "name": "GeneratedPage",
  "viewport": {
    "width": 1440,
    "height": 2400
  },
  "children": [
    {
      "id": "header-1",
      "type": "header",
      "children": [
        {
          "id": "logo-1",
          "type": "logo",
          "content": "LOGO"
        },
        {
          "id": "nav-1",
          "type": "navbar",
          "children": [
            {
              "id": "nav-item-1",
              "type": "nav_item",
              "content": "Home"
            }
          ]
        }
      ]
    }
  ]
}
```

### 12.2 Why UI-IR matters

Without UI-IR:

```text
YOLO → HTML
```

becomes hard to debug.

With UI-IR:

```text
YOLO
 ↓
detections
 ↓
UI-IR
 ↓
HTML/CSS
```

Each step can be tested independently.

### 12.3 UI-IR properties

Recommended fields:

- id;
- type;
- role;
- content;
- children;
- parentId;
- bbox;
- style;
- layout;
- metadata;
- sourceDetectionId.

### 12.4 Source traceability

Each generated node should remember which detection produced it:

```json
{
  "sourceDetectionId": "det_123"
}
```

Then clicking a generated element can highlight the original bounding box.

# 13. HTML Generation Engine

### 13.1 Design goal

Generate semantic and readable HTML rather than a giant block of absolute-positioned divs.

### 13.2 Mapping examples

```text
page       → <main>
header     → <header>
section    → <section>
heading    → <h2>
text       → <p>
image      → <img>
button     → <button>
link       → <a>
navbar     → <nav>
list       → <ul>
list_item  → <li>
footer     → <footer>
form       → <form>
input      → <input>
textarea   → <textarea>
```

### 13.3 Accessibility

Generated code should include:

- labels for inputs;
- `alt` attributes for images;
- button elements for actions;
- navigation landmarks;
- heading hierarchy;
- keyboard-accessible controls.

If content is unknown:

```html
<img src="..." alt="Image placeholder">
```

rather than empty `alt` by default, unless the user explicitly marks it decorative.

### 13.4 IDs and classes

Use stable IDs for generated nodes:

```text
section-hero
card-01
button-hero-cta
```

CSS classes should use predictable prefixes:

```text
ui-header
ui-hero
ui-card
ui-button
```

### 13.5 Code generation strategy

Use templates instead of string concatenation everywhere.

For example:

```text
NodeRenderer
 ├── renderHeader()
 ├── renderSection()
 ├── renderCard()
 ├── renderButton()
 └── renderText()
```

### 13.6 Generated HTML characteristics

The generated output should:

- be indented;
- contain semantic tags;
- use classes;
- include comments only when useful;
- avoid duplicated IDs;
- escape textual content.

# 14. CSS Generation Engine

### 14.1 Design goal

CSS should reconstruct approximate geometry while remaining maintainable and responsive.

### 14.2 CSS variables

Start with a small token system:

```css
:root {
  --ui-space-1: 4px;
  --ui-space-2: 8px;
  --ui-space-3: 12px;
  --ui-space-4: 16px;
  --ui-space-5: 24px;
  --ui-space-6: 32px;
}
```

### 14.3 Layout heuristics

Prefer:

1. flex;
2. grid;
3. normal document flow;
4. absolute positioning only when needed.

### 14.4 Card grid

If four cards are visually arranged evenly:

```css
.cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
}
```

### 14.5 Navigation

```css
.navbar {
  display: flex;
  align-items: center;
  gap: 24px;
}
```

### 14.6 Hero

For two-column hero:

```css
.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: center;
}
```

### 14.7 Responsive fallback

Generated CSS should include a mobile rule:

```css
@media (max-width: 768px) {
  .hero {
    grid-template-columns: 1fr;
  }

  .cards {
    grid-template-columns: 1fr;
  }
}
```

### 14.8 Position-based fallback

If an element cannot be mapped cleanly to a layout system, preserve its relative geometry within a controlled container.

Do not immediately make the entire page absolutely positioned.

### 14.9 Style inference

Initial style inference should be geometric:

- spacing;
- alignment;
- width;
- height;
- columns;
- rows.

Do not try to infer exact colors from grayscale sketches in the first version.

# 15. Live Preview Architecture

### 15.1 Requirement

The preview must show the result without leaving the project.

### 15.2 Recommended architecture

```text
UI-IR
 ↓
HTML generator
 ↓
CSS generator
 ↓
Preview document
 ↓
sandboxed iframe
```

### 15.3 Rendering modes

**Mode A — generated preview**

Uses the generated files.

**Mode B — editable preview**

Allows the user to change simple style properties and regenerate.

### 15.4 Preview isolation

Do not allow arbitrary generated JavaScript to access the parent application.

Use an iframe sandbox.

The initial version can disable JavaScript entirely if JS is not required.

### 15.5 Asset handling

Generated images may be placeholders. The preview should use:

- original extracted image crops;
- object-storage URLs;
- user-selected assets.

### 15.6 Preview errors

Capture iframe errors where practical and show:

```text
Preview Error
------------------
Unexpected token ...
Line 48
```

### 15.7 Device simulation

Use the preview frame to simulate:

- desktop;
- tablet;
- mobile.

The page itself should remain the same generated artifact; only viewport dimensions change.

# 16. Complete Feature List

### Core MVP

- landing page;
- project dashboard;
- sketch upload;
- source image viewer;
- page boundary;
- YOLO detection;
- detection overlay;
- confidence threshold;
- class editing;
- box editing;
- detection deletion;
- add detection;
- UI tree;
- HTML generator;
- CSS generator;
- live preview;
- code viewer;
- project save;
- ZIP export.

### V1 enhanced

- user accounts;
- project history;
- multiple pages;
- camera capture;
- perspective correction;
- automatic layout grouping;
- responsive preview;
- code editor;
- reusable component palette;
- correction history;
- dataset export.

### V2

- collaborative editing;
- React export;
- Tailwind export;
- design tokens;
- theme presets;
- component library;
- style editor;
- AI-assisted text extraction;
- OCR;
- multilingual handwritten text extraction;
- advanced layout learning.

### V3 research extensions

- layout transformer;
- multimodal UI understanding;
- OCR + detection fusion;
- learned layout reconstruction;
- visual similarity optimization;
- active-learning loop;
- automatic hard-example mining.

# 17. Project Workspace UX

### 17.1 Screen layout

```text
┌────────────────────────────────────────────────────────────┐
│ Sketch2UI | Project Name | Save | Detect | Code | Preview │
├────────────────┬─────────────────────────┬─────────────────┤
│ Layers / Tree  │ Sketch / Preview Canvas │ Inspector       │
│                │                         │                 │
│ Page           │                         │ Class           │
│ ├ Header       │                         │ Confidence      │
│ │ ├ Logo       │                         │ Coordinates     │
│ │ └ Navbar     │                         │ Content         │
│ ├ Hero         │                         │ Styles          │
│ └ Footer       │                         │ Parent          │
├────────────────┴─────────────────────────┴─────────────────┤
│ HTML | CSS | JSON | Console | Job Progress                │
└────────────────────────────────────────────────────────────┘
```

### 17.2 Layers panel

Functions:

- expand/collapse;
- select;
- rename;
- reorder;
- delete;
- re-parent.

### 17.3 Inspector grouping

Use:

**Detection**
- class;
- confidence;
- model;
- source.

**Geometry**
- x;
- y;
- width;
- height.

**Structure**
- parent;
- order.

**Content**
- text;
- alt text;
- link.

**Style**
- display;
- gap;
- padding;
- margin;
- font size;
- alignment.

### 17.4 Command history

Support undo/redo for UI changes.

Use a command model:

```text
Command
 ├── execute()
 └── undo()
```

This makes corrections predictable.

# 18. API Specification

### 18.1 Projects

```http
POST /api/projects
GET /api/projects
GET /api/projects/:id
PATCH /api/projects/:id
DELETE /api/projects/:id
```

### 18.2 Upload

```http
POST /api/projects/:id/assets
```

Response:

```json
{
  "assetId": "asset_123",
  "width": 1600,
  "height": 2400
}
```

### 18.3 Detect

```http
POST /api/projects/:id/detection-jobs
```

Response:

```json
{
  "jobId": "job_001"
}
```

### 18.4 Get detections

```http
GET /api/projects/:id/detections
```

### 18.5 Correct detection

```http
PATCH /api/projects/:id/detections/:detectionId
```

Example:

```json
{
  "className": "button",
  "x": 0.54,
  "y": 0.71,
  "width": 0.11,
  "height": 0.05
}
```

### 18.6 Generate code

```http
POST /api/projects/:id/code-generation-jobs
```

### 18.7 Get generated code

```http
GET /api/projects/:id/code
```

### 18.8 Export

```http
POST /api/projects/:id/exports
```

### 18.9 Jobs

```http
GET /api/jobs/:jobId
```

Response:

```json
{
  "status": "processing",
  "stage": "component_detection",
  "progress": 58
}
```

# 19. Security and Safety

### 19.1 Upload security

Validate:

- size;
- MIME;
- image decode;
- dimensions;
- extension.

Generate server-side storage names.

Do not use the original filename directly as a filesystem path.

### 19.2 Preview security

Generated content must be isolated.

The preview iframe should not be granted more permissions than necessary.

### 19.3 Authentication

For a student project, secure cookie sessions or short-lived access tokens can be used.

Store passwords only as secure password hashes.

Never store plaintext passwords.

### 19.4 Authorization

A user must not access another user's project by changing a project ID.

Every project query must include the authenticated user's ownership or an authorized role.

### 19.5 API rate limiting

Protect expensive endpoints:

- detection;
- code generation;
- export.

### 19.6 Model endpoint security

Do not expose the Python worker directly to the public internet.

Only the API/queue layer should communicate with it.

### 19.7 Secrets

Use environment variables:

```text
DATABASE_URL
REDIS_URL
STORAGE_BUCKET
JWT_SECRET
MODEL_PATH
```

Never commit secrets to Git.

# 20. Testing Strategy

### 20.1 Unit tests

Test:

- coordinate conversion;
- page filtering;
- parent inference;
- row grouping;
- column grouping;
- class mapping;
- HTML rendering;
- CSS rendering.

### 20.2 Computer-vision tests

Create a fixed evaluation set containing:

- clean wireframes;
- difficult sketches;
- outside annotations;
- perspective distortion;
- faint pencil;
- dark pencil;
- complex cards.

### 20.3 API integration tests

Test:

- project creation;
- file upload;
- job creation;
- detection persistence;
- correction;
- code generation;
- export.

### 20.4 Frontend tests

Test:

- upload state;
- detection loading;
- selection synchronization;
- inspector edits;
- tree updates;
- code panel;
- preview switching.

### 20.5 End-to-end test

Scenario:

```text
Open application
→ create project
→ upload known sketch
→ run detection
→ verify page boundary
→ verify at least N detections
→ correct button
→ generate code
→ verify preview
→ export ZIP
```

### 20.6 Regression testing

Keep a benchmark set of sketches.

Every new model version must be evaluated against the same benchmark before deployment.

# 21. Evaluation Framework

A strong academic project should report more than one model score.

### 21.1 Detection metrics

Report:

- precision;
- recall;
- mAP@0.5;
- mAP@0.5:0.95;
- class-wise AP;
- confusion matrix.

### 21.2 Page boundary metrics

Measure intersection-over-union for page detection.

### 21.3 Layout metrics

Create an evaluation set with expected structure.

Measure:

- section detection;
- parent assignment;
- repeated-card grouping;
- order consistency.

### 21.4 Code metrics

Possible measurements:

- generated HTML parses successfully;
- CSS parses successfully;
- no duplicate IDs;
- preview loads without runtime error;
- number of unsupported components.

### 21.5 Visual similarity

For a controlled benchmark, compare the generated render against a target reference.

Possible measures include:

- structural similarity;
- image difference;
- layout distance.

Use these only as supplementary indicators because the target is a sketch rather than a pixel-perfect design.

### 21.6 Human evaluation

Ask evaluators to score:

- structural similarity;
- usefulness;
- editability;
- generated-code readability;
- time saved.

### 21.7 End-to-end success metric

A powerful metric is:

```text
percentage of sketches that reach a usable preview
without manual reconstruction from scratch
```

This reflects the actual system objective.

# 22. Training and Dataset Management Workflow

### 22.1 Annotation workflow

```text
Collect sketch
    ↓
Review image
    ↓
Identify page boundary
    ↓
Annotate common components
    ↓
Validate labels
    ↓
Export YOLO labels
    ↓
Quality-check
    ↓
Dataset version
```

### 22.2 Annotation guidelines

Annotators must receive exact examples.

For every class explain:

- what counts;
- what does not count;
- minimum size;
- overlap rule;
- nested object rule.

### 22.3 Example: button

Annotate:

```text
┌───────────────┐
│   BUY NOW     │
└───────────────┘
```

Do not annotate:

- the surrounding card as button;
- text outside button;
- arrows next to button.

### 22.4 Example: card

Annotate the entire card only if the class `card` exists.

Then optionally annotate child objects:

```text
card
 ├ image
 ├ card_title
 ├ card_text
 └ card_button
```

### 22.5 Avoid inconsistent annotation

If card children are labeled in some images and not others, the model receives inconsistent supervision.

Choose one policy and document it.

### 22.6 Dataset versioning

Use:

```text
dataset-v1
dataset-v2
dataset-v3
```

Store:

- class list;
- image count;
- split;
- annotation rules;
- source;
- validation results.

# 23. Repository Structure

Recommended monorepo:

```text
Sketch2UI/
├── apps/
│   ├── web/
│   └── api/
├── services/
│   └── cv-worker/
├── packages/
│   ├── ui-ir/
│   ├── shared-types/
│   ├── codegen/
│   └── config/
├── ml/
│   ├── dataset/
│   ├── training/
│   ├── evaluation/
│   ├── inference/
│   └── models/
├── infra/
│   ├── docker/
│   ├── nginx/
│   └── scripts/
├── docs/
├── tests/
├── data/
│   ├── raw/
│   ├── processed/
│   └── samples/
├── .env.example
├── docker-compose.yml
├── README.md
└── package.json
```

### Frontend

```text
apps/web/
├── src/
│   ├── components/
│   ├── pages/
│   ├── features/
│   ├── hooks/
│   ├── services/
│   ├── stores/
│   ├── types/
│   └── utils/
```

### API

```text
apps/api/
├── src/
│   ├── config/
│   ├── middleware/
│   ├── modules/
│   ├── jobs/
│   ├── db/
│   └── server.ts
```

### Worker

```text
services/cv-worker/
├── app/
│   ├── api/
│   ├── detector/
│   ├── preprocessing/
│   ├── layout/
│   ├── codegen/
│   └── schemas/
├── tests/
└── main.py
```

# 24. Implementation Roadmap

### Phase 0 — Project setup

Deliverables:

- Git repository;
- branch strategy;
- coding standards;
- Docker Compose;
- database;
- frontend shell;
- API shell;
- Python worker shell.

### Phase 1 — Manual wireframe editor foundation

Before ML, implement:

- upload;
- page display;
- manual box creation;
- class list;
- component tree;
- HTML/CSS generation;
- preview.

This establishes the core system independent of model accuracy.

### Phase 2 — Dataset

Deliverables:

- class taxonomy;
- annotation guidelines;
- first dataset;
- validation scripts;
- YOLO labels;
- dataset version.

### Phase 3 — YOLO training

Deliverables:

- training configuration;
- first model;
- evaluation report;
- benchmark images;
- inference script.

### Phase 4 — Automated detection

Integrate:

```text
Upload
→ page detection
→ YOLO inference
→ filtering
→ database
→ frontend overlay
```

### Phase 5 — Layout reconstruction

Implement:

- containment;
- grouping;
- ordering;
- repeated card detection;
- flex/grid inference.

### Phase 6 — Code generation

Implement:

- semantic HTML;
- CSS;
- responsive rules;
- asset references.

### Phase 7 — Live preview

Implement:

- iframe;
- viewport modes;
- code editor;
- preview refresh.

### Phase 8 — Correction and feedback

Implement:

- class correction;
- box correction;
- add/delete;
- feedback save;
- training-sample export.

### Phase 9 — Evaluation

Prepare:

- model metrics;
- end-to-end metrics;
- usability evaluation;
- screenshots;
- demo examples.

### Phase 10 — Deployment

Deploy:

- web;
- API;
- PostgreSQL;
- Redis;
- CV worker;
- object storage.

# 25. Detailed Sprint Plan

### Sprint 1 — Foundation

Tasks:

- initialize monorepo;
- configure TypeScript;
- configure Python environment;
- create Express app;
- create React app;
- create PostgreSQL schema;
- create Docker Compose;
- define environment variables.

Definition of done:

- all services start locally;
- health endpoints work.

### Sprint 2 — Project management

Tasks:

- project CRUD;
- dashboard;
- upload UI;
- image storage.

Definition of done:

- user can create a project and upload an image.

### Sprint 3 — Annotation canvas

Tasks:

- canvas;
- normalized coordinates;
- manual box creation;
- move/resize;
- class selection.

Definition of done:

- user can manually annotate a sketch.

### Sprint 4 — UI tree

Tasks:

- containment;
- tree nodes;
- reorder;
- parent editing.

Definition of done:

- visual boxes correspond to tree nodes.

### Sprint 5 — Code generator

Tasks:

- HTML templates;
- CSS generator;
- code editor;
- preview.

Definition of done:

- manually annotated sketch can become HTML/CSS.

### Sprint 6 — Dataset

Tasks:

- collect images;
- annotate;
- validate;
- split.

### Sprint 7 — Model training

Tasks:

- configure training;
- train;
- evaluate;
- export model.

### Sprint 8 — ML integration

Tasks:

- inference worker;
- queue;
- API job;
- detection persistence;
- overlay.

### Sprint 9 — Page filtering

Tasks:

- page detector;
- crop;
- filtering;
- hard-negative tests.

### Sprint 10 — Layout inference

Tasks:

- row grouping;
- card grouping;
- flex/grid heuristics;
- tree auto-generation.

### Sprint 11 — Correction

Tasks:

- edit detection;
- change class;
- manual add;
- delete;
- save corrections.

### Sprint 12 — Export and polish

Tasks:

- ZIP export;
- responsive preview;
- error messages;
- loading states;
- final tests.

### Sprint 13 — Evaluation

Tasks:

- benchmark;
- metrics;
- screenshots;
- performance analysis;
- final demo.

# 26. Development Environment Setup

### Required software

- Git;
- Node.js;
- npm/pnpm;
- Python;
- virtual environment;
- PostgreSQL;
- Redis;
- Docker Desktop;
- code editor.

### Recommended environment variables

```env
NODE_ENV=development

PORT=4000

DATABASE_URL=postgresql://...

REDIS_URL=redis://...

STORAGE_DRIVER=local
STORAGE_PATH=./storage

CV_WORKER_URL=http://localhost:8001

MODEL_PATH=./models/ui-detector.pt

PREVIEW_ORIGIN=http://localhost:5173
```

### Local services

```text
Frontend: http://localhost:5173
API:      http://localhost:4000
CV:       http://localhost:8001
```

### Health endpoints

```http
GET /health
GET /ready
```

The API should verify database and queue connectivity for readiness.

# 27. Queue and Background Job Implementation

### 27.1 Why queues

Model inference may take longer than a normal HTTP request should block. A queue also makes retries and job state explicit.

### 27.2 Jobs

```text
image_preprocess
detect_components
rebuild_layout
generate_code
create_export
```

### 27.3 Job chaining

```text
preprocess
    ↓
detect
    ↓
layout
    ↓
codegen
    ↓
export
```

The API can create only the first job and allow the worker to chain stages.

### 27.4 Retry strategy

Retry transient failures.

Do not endlessly retry invalid images.

Example:

```text
INVALID_IMAGE       → no retry
MODEL_UNAVAILABLE   → retry
STORAGE_TIMEOUT     → retry
OUT_OF_MEMORY       → fail + operator alert
```

### 27.5 Idempotency

A job should be safe to retry without creating duplicate detections.

Use job IDs and result version IDs.

# 28. Performance Plan

### Frontend

Optimize:

- large-image rendering;
- SVG overlay count;
- unnecessary React re-renders;
- code editor mounting;
- preview reloads.

Use memoization for unchanged detection boxes.

### Backend

Optimize:

- database indexes;
- image metadata queries;
- pagination;
- queue operations.

### Computer vision

Measure:

- preprocessing time;
- inference time;
- post-processing time.

For lightweight inference, keep the model in memory in the worker rather than loading weights for each job.

### Large images

Do not send enormous originals repeatedly between services.

Create:

- source original;
- processing copy;
- thumbnail.

### Caching

Cache:

- generated thumbnail;
- model loaded state;
- unchanged code generation results.

### Database indexing

Useful indexes:

```text
projects(user_id)
detections(project_id)
ui_nodes(project_id, parent_id)
jobs(project_id, status)
code_versions(project_id, version_number)
```

# 29. Observability and Logging

Every project-processing operation should carry:

```text
request_id
project_id
job_id
model_version
```

### Logs

Examples:

```text
INFO detection job queued
INFO preprocessing completed
INFO inference completed
INFO 42 detections accepted
INFO layout reconstruction completed
INFO code generated
```

### Metrics

Track:

- inference duration;
- average detections per image;
- job failure rate;
- queue wait time;
- code generation duration;
- preview errors.

### Error tracking

Keep structured error records:

```json
{
  "code": "MODEL_INFERENCE_FAILED",
  "stage": "component_detection",
  "projectId": "...",
  "jobId": "..."
}
```

# 30. CI/CD Plan

### Pull request checks

Run:

1. lint;
2. type-check;
3. unit tests;
4. API tests;
5. frontend build;
6. Python tests.

### ML checks

A model should not become active merely because the training script completed.

Require:

- evaluation artifact;
- metric thresholds;
- class-list compatibility;
- inference smoke test.

### Deployment stages

```text
development
    ↓
staging
    ↓
production
```

### Model promotion

```text
trained
 ↓
evaluated
 ↓
approved
 ↓
registered
 ↓
staging
 ↓
production
```

Model weights should be immutable after registration.

# 31. Code Quality and Architecture Rules

### Rule 1

Do not couple UI components directly to database APIs.

### Rule 2

Do not put ML-specific logic in React components.

### Rule 3

Do not let the generator depend directly on YOLO output.

The generator consumes UI-IR.

### Rule 4

Do not let the Python worker write arbitrary database records without an explicit API/data contract.

### Rule 5

Do not store generated code without a version.

### Rule 6

Do not silently discard model failures.

### Rule 7

Do not allow external sketch notes to enter the accepted component graph.

### Rule 8

Every important object should have a stable ID.

### Rule 9

Every generated UI element should be traceable to source input where possible.

### Rule 10

Prefer deterministic transformations for layout and code generation before adding additional AI components.

# 32. Error Handling Matrix

| Error | Cause | User action | System action |
|---|---|---|---|
| INVALID_IMAGE | unsupported/corrupt file | upload another | reject immediately |
| TOO_LARGE | file too large | compress image | reject |
| PAGE_NOT_FOUND | boundary unclear | adjust crop | show manual crop |
| MODEL_FAILED | worker failure | retry | log + retry if transient |
| NO_DETECTIONS | poor sketch/model mismatch | manual annotate | keep project |
| LAYOUT_FAILED | conflicting geometry | review tree | fall back to flat tree |
| CODEGEN_FAILED | unexpected node | edit component | preserve prior version |
| PREVIEW_FAILED | invalid generated code | inspect error | isolate failure |
| EXPORT_FAILED | storage issue | retry | keep code version |

# 33. UI Component Class Taxonomy for the First Dataset

Use common classes and consistent labels.

### Structural classes

```text
page
header
section
footer
navbar
sidebar
form
card
```

### Content classes

```text
logo
heading
text
link
image
video
icon
avatar
```

### Interaction classes

```text
button
input
textarea
select
menu_button
search_box
carousel_prev
carousel_next
carousel_indicator
```

### Repeated-content classes

```text
card_title
card_text
card_button
list
list_item
```

### Special classes

```text
breadcrumb
map
social_icon
newsletter
testimonial
divider
```

Do not introduce classes such as `hero_heading_1`, `left_text`, or `small_button` merely because they appear in one sketch. Class names should describe reusable UI concepts.

# 34. Example: Car Marketplace Sketch Conversion

Input sketch contains:

```text
Header
 ├ logo
 ├ navbar
 │  ├ Home
 │  ├ Browse Cars
 │  ├ Sell Your Car
 │  ├ About Us
 │  └ Contact
 └ login button

Hero
 ├ car image
 ├ previous arrow
 ├ next arrow
 ├ heading
 ├ text
 ├ select
 ├ select
 ├ select
 ├ select
 └ search button

Featured section
 ├ card
 ├ card
 ├ card
 └ card

Feature section
 ├ icon + heading + text
 ├ icon + heading + text
 ├ icon + heading + text
 └ icon + heading + text

Footer
 ├ heading
 ├ text
 ├ input
 ├ subscribe button
 └ social icons
```

The layout engine can infer:

```text
header:
  display: flex

hero:
  display: grid
  columns: 1fr 1fr

featured:
  display: grid
  columns: repeat(4, 1fr)

features:
  display: grid
  columns: repeat(4, 1fr)

footer:
  display: flex
```

The generated HTML can then be structurally meaningful instead of being an exact coordinate dump.

# 35. Example: Two-Page Recipe Sketch Conversion

For a two-page recipe sketch:

```text
Project
 ├ Page 1
 │  ├ Header
 │  ├ Hero
 │  ├ Preparation Time
 │  ├ Recipe Image
 │  ├ Ingredients
 │  └ Instructions
 │
 └ Page 2
    ├ Steps
    ├ Share
    ├ Tips
    ├ Nutrition
    └ Essential Items
```

Each page should have its own coordinate system.

Store:

```json
{
  "pageId": "page-1",
  "width": 1200,
  "height": 1800
}
```

Do not combine normalized coordinates from two separate pages.

# 36. Training Feedback Loop

The long-term improvement architecture should be:

```text
user corrections
      ↓
approved training samples
      ↓
dataset version
      ↓
retraining
      ↓
evaluation
      ↓
new model version
      ↓
deployment
      ↓
new corrections
```

### Active learning

Prioritize:

- low-confidence detections;
- frequently corrected classes;
- images with many false positives;
- images with no detections;
- unusual drawing styles.

This allows new annotation effort to focus on difficult cases rather than randomly labeling more easy samples.

# 37. Research and Academic Demonstration Plan

For a final-year project, structure the demonstration around measurable stages.

### Demo 1 — Raw sketch

Show the original image.

### Demo 2 — Page isolation

Show the page boundary and excluded external annotations.

### Demo 3 — Detection

Show YOLO boxes.

### Demo 4 — Layout reconstruction

Show the generated UI tree.

### Demo 5 — Code

Show HTML and CSS.

### Demo 6 — Live preview

Show the rendered website.

### Demo 7 — Correction

Change a wrong class.

### Demo 8 — Regeneration

Show that the preview updates.

### Demo 9 — Evaluation

Display:

- mAP;
- precision;
- recall;
- inference time;
- end-to-end success rate.

This narrative demonstrates both machine learning and software engineering rather than presenting the application as a simple image uploader.

# 38. Recommended MVP Definition

The MVP is complete when a user can:

1. open Sketch2UI;
2. create a project;
3. upload a wireframe image;
4. identify/crop the page;
5. run YOLOv5 tiny detection;
6. see only accepted detections inside the page;
7. correct the boxes;
8. see the UI tree;
9. generate HTML;
10. generate CSS;
11. render a live preview;
12. save the result;
13. download an HTML/CSS package.

The MVP should not wait for advanced AI features. Everything after this can be layered on top.

# 39. Recommended V1 Feature Definition

V1 should add:

- account management;
- project history;
- multiple pages;
- responsive preview;
- code editor;
- style inspector;
- dataset correction export;
- model versioning;
- improved page detection;
- stronger layout inference;
- test suite;
- Docker deployment.

V1 is the version suitable for a strong university demonstration.

# 40. Final End-to-End Architecture

The final architecture should be understood as six layers.

### Layer 1 — Input

```text
image
camera
canvas
```

### Layer 2 — Computer vision

```text
preprocessing
page detection
YOLOv5 tiny
post-processing
```

### Layer 3 — Structural intelligence

```text
containment
grouping
ordering
layout inference
UI-IR
```

### Layer 4 — Generation

```text
HTML
CSS
optional JavaScript
optional React
```

### Layer 5 — Runtime

```text
live preview
responsive viewport
code editor
```

### Layer 6 — Learning system

```text
corrections
training samples
dataset versions
model versions
evaluation
```

The central architecture is:

```text
                      ┌───────────────┐
                      │ Hand Sketch   │
                      └───────┬───────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Preprocessing    │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ Page Detection   │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ YOLOv5 Tiny      │
                    │ UI Detection     │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ Filtering        │
                    │ + Corrections    │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ Layout Engine    │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ UI Intermediate  │
                    │ Representation   │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ HTML/CSS Codegen │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ Live Preview     │
                    └──────────────────┘
```

# 41. Suggested File-by-File Implementation Order

### Repository root

Create:

```text
README.md
.env.example
docker-compose.yml
package.json
```

### Frontend first files

```text
apps/web/src/main.tsx
apps/web/src/app/router.tsx
apps/web/src/pages/Dashboard.tsx
apps/web/src/pages/Project.tsx
apps/web/src/components/upload/UploadPanel.tsx
apps/web/src/components/canvas/SketchCanvas.tsx
apps/web/src/components/canvas/DetectionOverlay.tsx
apps/web/src/components/tree/ComponentTree.tsx
apps/web/src/components/inspector/Inspector.tsx
apps/web/src/components/code/CodePanel.tsx
apps/web/src/components/preview/PreviewFrame.tsx
```

### API files

```text
apps/api/src/server.ts
apps/api/src/app.ts
apps/api/src/modules/projects/project.routes.ts
apps/api/src/modules/projects/project.controller.ts
apps/api/src/modules/projects/project.service.ts
apps/api/src/modules/detection/detection.routes.ts
apps/api/src/modules/detection/detection.service.ts
apps/api/src/jobs/detection.job.ts
```

### Worker files

```text
services/cv-worker/main.py
services/cv-worker/app/inference.py
services/cv-worker/app/page_detection.py
services/cv-worker/app/postprocess.py
services/cv-worker/app/layout.py
services/cv-worker/app/schemas.py
```

### Shared UI-IR

```text
packages/ui-ir/src/types.ts
packages/ui-ir/src/validate.ts
packages/ui-ir/src/index.ts
```

### Code generation

```text
packages/codegen/src/html/render.ts
packages/codegen/src/css/render.ts
packages/codegen/src/templates.ts
```

# 42. Example Data Contracts

### Detection contract

```ts
type Detection = {
  id: string;
  classId: number;
  className: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  source: "model" | "manual";
  status: "accepted" | "ignored";
  modelVersion?: string;
};
```

### UI node

```ts
type UINode = {
  id: string;
  type: string;
  parentId?: string;
  children: string[];
  bbox?: BBox;
  content?: {
    text?: string;
    src?: string;
    href?: string;
  };
  layout?: {
    display?: "block" | "flex" | "grid";
    direction?: "row" | "column";
    columns?: number;
  };
  style?: Record<string, string | number>;
  sourceDetectionId?: string;
};
```

### Job

```ts
type Job = {
  id: string;
  projectId: string;
  type: "detect" | "layout" | "codegen" | "export";
  status: "queued" | "processing" | "completed" | "failed";
  stage?: string;
  progress: number;
  errorCode?: string;
};
```

# 43. Database Relationships

```text
User
 │
 └──< Project
        │
        ├──< Asset
        │
        ├──< Job
        │
        ├──< Detection
        │
        ├──< UINode
        │
        ├──< CodeVersion
        │
        ├──< Correction
        │
        └──< Export

ModelVersion
 │
 └──< Detection

Asset
 │
 └──< TrainingSample
```

### Deletion policy

Avoid physical deletion when reproducibility matters.

Possible approach:

- projects → soft delete;
- assets → mark deleted and later purge;
- code versions → immutable;
- audit logs → immutable.

# 44. Deployment Architecture

### Docker Compose topology

```text
docker network: sketch2ui

web
 ↓
api
 ├── postgres
 ├── redis
 └── cv-worker
```

### Production-like topology

```text
Internet
   │
Reverse Proxy
   │
   ├── Web
   └── API
          │
          ├── PostgreSQL
          ├── Redis
          ├── Object Storage
          └── CV Worker
```

### Scaling

Web and API can scale horizontally.

CV workers can scale independently depending on inference load.

The queue protects the API from spikes.

# 45. Backup and Recovery

Back up:

- PostgreSQL;
- original source images;
- trained model weights;
- dataset versions;
- generated exports if they are important.

A model file without the matching class list and evaluation report is not a reproducible model artifact.

Store:

```text
weights
classes
training config
dataset version
metrics
commit hash
```

For project recovery, the minimum required data is:

```text
project metadata
source image
model version
detections
UI-IR
code version
```

# 46. Documentation Plan

The repository should contain:

```text
docs/
├── architecture.md
├── api.md
├── database.md
├── ml/
│   ├── dataset.md
│   ├── annotation-guide.md
│   ├── training.md
│   └── evaluation.md
├── frontend.md
├── codegen.md
├── preview-security.md
├── deployment.md
└── troubleshooting.md
```

### Annotation guide

This document is especially important.

For each class show:

- definition;
- positive example;
- negative example;
- nested-child rule;
- overlap rule.

### Training report

Record:

- dataset size;
- classes;
- training configuration;
- validation metrics;
- test metrics;
- qualitative examples;
- error analysis.

# 47. Risk Register

### Risk: detector misses components

Mitigation:
- expand dataset;
- improve augmentation;
- use correction workflow;
- inspect class confusion.

### Risk: outside annotations are detected

Mitigation:
- explicit page boundary;
- crop;
- polygon filtering;
- hard negatives.

### Risk: code is visually poor

Mitigation:
- UI-IR;
- layout heuristics;
- grid/flex inference;
- manual style editing.

### Risk: inference is slow

Mitigation:
- lightweight model;
- warm worker;
- image resizing;
- asynchronous jobs.

### Risk: too many classes

Mitigation:
- reduce taxonomy;
- combine visually ambiguous classes;
- add classes gradually.

### Risk: preview security issue

Mitigation:
- iframe isolation;
- limited sandbox permissions;
- no server-side execution of generated code.

### Risk: model version breaks old projects

Mitigation:
- immutable model version;
- project-level model reference;
- migration only when explicitly requested.

# 48. Recommended Milestone Demonstrations

### Milestone A

Manual sketch → manual boxes → HTML/CSS → preview.

This proves the editor and generator.

### Milestone B

Sketch → YOLO detection → boxes.

This proves the computer-vision pipeline.

### Milestone C

Sketch → detection → UI tree.

This proves layout reconstruction.

### Milestone D

Sketch → detection → tree → HTML/CSS → preview.

This is the complete core product.

### Milestone E

Correction → training sample.

This demonstrates the learning loop.

# 49. Final Recommended Product Feature Matrix

| Feature | MVP | V1 | Future |
|---|---:|---:|---:|
| Image upload | ✅ | ✅ | ✅ |
| Drag/drop | ✅ | ✅ | ✅ |
| Page boundary | ✅ | ✅ | ✅ |
| YOLOv5 tiny | ✅ | ✅ | ✅ |
| Detection overlay | ✅ | ✅ | ✅ |
| Manual correction | ✅ | ✅ | ✅ |
| UI tree | ✅ | ✅ | ✅ |
| HTML generation | ✅ | ✅ | ✅ |
| CSS generation | ✅ | ✅ | ✅ |
| Live preview | ✅ | ✅ | ✅ |
| Responsive preview | | ✅ | ✅ |
| Project history | | ✅ | ✅ |
| Code editor | | ✅ | ✅ |
| ZIP export | ✅ | ✅ | ✅ |
| React export | | | ✅ |
| Tailwind export | | | ✅ |
| OCR | | | ✅ |
| Camera capture | | ✅ | ✅ |
| Multiple pages | | ✅ | ✅ |
| Collaboration | | | ✅ |
| Active learning | | | ✅ |

# 50. Final Acceptance Checklist

### Product

- [ ] User can create a project.
- [ ] User can upload a sketch.
- [ ] User can see the original image.
- [ ] User can identify the page boundary.
- [ ] External notes are excluded from accepted detections.
- [ ] YOLOv5 tiny model runs.
- [ ] Detections have class and confidence.
- [ ] User can correct detections.
- [ ] UI tree is created.
- [ ] HTML is generated.
- [ ] CSS is generated.
- [ ] Live preview works.
- [ ] Preview is isolated.
- [ ] User can save the project.
- [ ] User can export HTML/CSS.

### Computer vision

- [ ] Dataset is versioned.
- [ ] Class list is documented.
- [ ] Annotation guide exists.
- [ ] Train/val/test split is documented.
- [ ] Evaluation set is fixed.
- [ ] mAP is reported.
- [ ] precision is reported.
- [ ] recall is reported.
- [ ] class confusion is analyzed.
- [ ] outside-page false positives are evaluated.

### Software engineering

- [ ] API is typed.
- [ ] Database migrations are tracked.
- [ ] Background jobs are used.
- [ ] Errors are structured.
- [ ] Logs include project/job IDs.
- [ ] Preview is sandboxed.
- [ ] CI runs tests.
- [ ] Deployment documentation exists.

### Academic demonstration

- [ ] Explain problem.
- [ ] Explain dataset.
- [ ] Explain model.
- [ ] Show training.
- [ ] Show evaluation.
- [ ] Show page filtering.
- [ ] Show layout reconstruction.
- [ ] Show generated HTML/CSS.
- [ ] Show live preview.
- [ ] Show user correction.
- [ ] Show improvement path.

# 51. Practical Build Order — What You Should Actually Do First

Do not start by training the YOLO model. Build the complete software skeleton first.

### Step 1

Create the repository and folders.

### Step 2

Build the React project workspace.

### Step 3

Implement manual bounding-box annotation.

### Step 4

Implement the UI tree.

### Step 5

Implement HTML/CSS generation from the manual tree.

### Step 6

Implement live preview.

At this point you already have a functional sketch-to-code engine where the “sketch interpretation” is manual.

### Step 7

Build the YOLO dataset.

### Step 8

Train the lightweight detector.

### Step 9

Integrate automated detection into the existing annotation system.

This is much safer than developing the ML and UI simultaneously.

### Step 10

Implement page filtering.

### Step 11

Implement automatic layout reconstruction.

### Step 12

Add correction feedback and evaluation.

This sequence reduces project risk because every stage has a working fallback.

# 52. Suggested Final Technology Decision

For a practical university implementation, the recommended baseline is:

```text
Frontend
React + TypeScript + Vite
Tailwind CSS
TanStack Query
Zustand
SVG overlay
Monaco Editor

Backend
Node.js
Express
TypeScript
Prisma
PostgreSQL
Redis
BullMQ

Computer Vision
Python
PyTorch
YOLOv5 tiny-style lightweight detector
OpenCV
Pillow
NumPy

Runtime
Docker Compose
Object storage
Sandboxed iframe preview
```

### System responsibility map

```text
React
  → user interaction

Node/Express
  → application API

PostgreSQL
  → metadata and project state

Redis
  → job queue

Python worker
  → computer vision

Layout engine
  → structural reconstruction

Code generator
  → HTML/CSS

iframe
  → live preview
```

This division gives each technology a clear job and makes the final architecture easy to explain in a project defense.

# 53. What “Sketch2UI Complete” Means

Sketch2UI should not be defined as “YOLO detects rectangles.”

The complete application is a chain of coordinated systems:

```text
1. Visual input
2. Page isolation
3. Component detection
4. Detection validation
5. Manual correction
6. Layout understanding
7. UI intermediate representation
8. HTML generation
9. CSS generation
10. Live rendering
11. Export
12. Persistence
13. Evaluation
14. Training feedback
```

The detector is an important part, but it is not the entire product.

The strongest implementation is therefore one where:

- YOLO is measurable;
- the page filter is explainable;
- layout logic is deterministic enough to test;
- generated HTML/CSS is readable;
- preview is isolated;
- corrections are persisted;
- model versions are reproducible;
- the project can be evaluated quantitatively.

# Appendix A — Example HTML Generation Result

A simple generated page can look like:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sketch2UI Generated Page</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <header class="ui-header">
    <a class="ui-logo" href="#">LOGO</a>

    <nav class="ui-navbar" aria-label="Primary">
      <a href="#">Home</a>
      <a href="#">About</a>
      <a href="#">Services</a>
      <a href="#">Contact</a>
    </nav>

    <button class="ui-button">Get Started</button>
  </header>

  <main>
    <section class="ui-hero">
      <div class="ui-hero-content">
        <h1>Headline</h1>
        <p>Your generated description goes here.</p>
        <button class="ui-button">Learn More</button>
      </div>

      <div class="ui-hero-media">
        <img src="./assets/hero.png" alt="Hero" />
      </div>
    </section>

    <section class="ui-section">
      <h2>Our Services</h2>

      <div class="ui-grid">
        <article class="ui-card">
          <img src="./assets/card-1.png" alt="Service" />
          <h3>Service One</h3>
          <p>Description.</p>
          <button class="ui-button">View Details</button>
        </article>
      </div>
    </section>
  </main>

  <footer class="ui-footer">
    <p>© Sketch2UI</p>
  </footer>
</body>
</html>
```

The exact content can be replaced with recognized or user-edited text.

# Appendix B — Example Generated CSS

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: #1f2937;
  background: #ffffff;
}

.ui-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
}

.ui-navbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.ui-hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
  padding: 4rem 6vw;
  align-items: center;
}

.ui-hero-media img {
  width: 100%;
  display: block;
}

.ui-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-5);
}

.ui-card {
  padding: var(--space-4);
  border: 1px solid #ddd;
  border-radius: 12px;
}

.ui-button {
  border: 0;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  cursor: pointer;
}

@media (max-width: 768px) {
  .ui-header {
    flex-direction: column;
  }

  .ui-navbar {
    flex-wrap: wrap;
    justify-content: center;
  }

  .ui-hero {
    grid-template-columns: 1fr;
  }

  .ui-grid {
    grid-template-columns: 1fr;
  }
}
```

# Appendix C — Suggested Academic Evaluation Table

| Metric | Baseline | Improved | Target |
|---|---:|---:|---:|
| Page detection IoU | measure | measure | high |
| Component precision | measure | measure | high |
| Component recall | measure | measure | high |
| mAP@0.5 | measure | measure | high |
| mAP@0.5:0.95 | measure | measure | high |
| Average inference time | measure | measure | low |
| External annotation false positives | measure | measure | low |
| Correct parent assignment | measure | measure | high |
| Successful code generation | measure | measure | high |
| Preview load success | measure | measure | near 100% |
| Manual correction time | measure | measure | decreasing |

# Appendix D — Final Architecture Diagram for the Project Report

```text
                           SKETCH2UI
                               │
              ┌────────────────┴────────────────┐
              │                                 │
        Presentation Layer                 ML Layer
              │                                 │
        React Web App                    Python Worker
              │                                 │
     ┌────────┼─────────┐             ┌─────────┼─────────┐
     │        │         │             │         │         │
  Upload    Canvas    Preview      OpenCV     YOLO      Layout
     │        │         │             │         │         │
     └────────┼─────────┘             └─────────┼─────────┘
              │                                 │
              └──────────────┬──────────────────┘
                             │
                        Node.js API
                             │
              ┌──────────────┼──────────────┐
              │              │              │
          PostgreSQL       Redis       Object Storage
              │              │              │
              └──────────────┼──────────────┘
                             │
                         Code Engine
                             │
                     ┌───────┴────────┐
                     │                │
                    HTML             CSS
                     │                │
                     └───────┬────────┘
                             │
                       Live Preview
```

# Appendix E — Definition of Done for the Entire Project

The project can be considered complete when all of the following are true:

### Input

A user can upload a hand-drawn webpage sketch and the application preserves the original image.

### Page isolation

The system can establish the webpage region and prevent outside handwritten notes from entering the accepted component dataset.

### Detection

The YOLOv5 lightweight detector identifies the documented common UI classes and returns confidence and bounding boxes.

### Editing

A user can correct class labels and geometry.

### Layout

The system converts accepted detections into a hierarchical UI representation.

### Generation

The system generates valid HTML and CSS from the UI representation.

### Preview

The generated page renders inside a sandboxed live preview.

### Persistence

Projects, detections, UI nodes, model versions, and code versions are stored.

### Export

The user can download the generated HTML/CSS package.

### Evaluation

The system has a reproducible test dataset, model metrics, and an end-to-end benchmark.

### Reproducibility

The final project can answer:

- which image was used;
- which model version was used;
- which detections were produced;
- which corrections were made;
- which UI tree was generated;
- which code version was exported.

That traceability is what turns Sketch2UI from a simple demo into a well-engineered software system.

# Appendix F — Implementation Cookbook and Engineering Decisions

### F.1 Build the vertical slice before polishing

The first end-to-end vertical slice should support one user, one uploaded image, one detection job, one UI tree, one HTML/CSS result, and one live preview. Do not spend weeks building a dashboard before proving that the core pipeline works.

Recommended proof:

```text
upload.png
   ↓
detector
   ↓
detections.json
   ↓
ui-tree.json
   ↓
index.html + styles.css
   ↓
preview
```

Once this works, replace each manual or mocked stage with the real implementation.

### F.2 Keep model inference deterministic where possible

Record:

- model version;
- input dimensions;
- confidence threshold;
- IoU threshold;
- preprocessing options.

This lets you reproduce a project.

### F.3 Normalize coordinates everywhere

Use:

```text
0.0 ≤ x,y,width,height ≤ 1.0
```

for the storage model.

Only convert to pixels at the presentation boundary.

### F.4 Keep the source image immutable

Never modify the original uploaded photo to “remove” external notes.

Instead create derived artifacts:

```text
original
processed
page-cropped
annotated
```

### F.5 Keep generation deterministic

Given the same UI-IR and generator version, the system should produce equivalent HTML/CSS.

Record:

```text
generator_version
ui_ir_schema_version
```

in every code version.

### F.6 Separate visual detection from text extraction

The initial detector should classify `heading`, `text`, `button`, etc. It does not need to read exact handwritten words. OCR can be a separate later pipeline.

This separation reduces the need to solve handwriting recognition at the same time as object detection.

### F.7 Design for imperfect recognition

Generated code should still be usable when:

- one image is missing;
- a button is misclassified;
- text is absent;
- a section boundary is uncertain.

Use graceful defaults.

### F.8 Use a confidence-aware editor

The UI should visually distinguish:

```text
high confidence
medium confidence
low confidence
```

This can help users prioritize corrections.

### F.9 Store correction provenance

Every correction should contain:

```text
who
when
old class
new class
old bbox
new bbox
```

This becomes valuable training data later.

### F.10 Build benchmark fixtures

Store a small collection of canonical sketches:

```text
benchmarks/
├── simple-landing-page/
├── ecommerce/
├── recipe/
├── portfolio/
├── nonprofit/
├── car-marketplace/
└── multi-page/
```

Each benchmark should have:

```text
source.png
expected_page.json
expected_tree.json
```

The expected artifacts need not be perfect pixel matches; they should encode the structural components that matter.

### F.11 Minimum viable generator templates

Support these first:

```text
page
header
navbar
hero_section
section
card
footer
form
button
image
heading
text
link
```

Every other class can initially degrade to a generic element.

### F.12 Generic fallback

For an unknown node:

```html
<div class="ui-component">
  ...
</div>
```

The UI tree should retain the original class name so the user can fix it.

### F.13 Avoid premature microservices

Although the architecture has a separate Python worker, do not split every domain into a separate service. One API, one worker, one frontend, one database, and one queue are sufficient for the initial system.

### F.14 Make the database boring

The database should store structured project state rather than large model outputs or binary images.

### F.15 Make object storage boring too

Use predictable keys:

```text
projects/{projectId}/source/original.png
projects/{projectId}/source/page.png
projects/{projectId}/results/annotated.png
projects/{projectId}/exports/v3.zip
```

### F.16 Treat code generation as a compiler

Think of:

```text
detected UI → IR → HTML/CSS
```

as a compiler pipeline.

That mental model encourages clear stages:

```text
lexical/visual input
→ structural analysis
→ intermediate representation
→ target code
```

### F.17 Keep model upgrades independent

A better detector should not require a rewrite of the UI generator.

The only contract needed is the detection schema.

### F.18 Keep class names stable

If `button` becomes `cta_button` halfway through the dataset, every downstream component breaks.

Use class IDs and versioned class maps.

### F.19 Have a migration process

If you add a class:

```text
v1 classes → v2 classes
```

write a dataset migration script.

### F.20 Document assumptions

Examples:

- page is approximately rectangular;
- each screenshot represents one primary webpage unless multi-page mode is enabled;
- text extraction is not guaranteed;
- image placeholders are treated as `image` or `image_placeholder`;
- external annotations are rejected using page geometry;
- code generation is structural rather than pixel-perfect.

Clear assumptions are a strength, not a weakness.

# Appendix O1 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O2 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O3 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O4 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O5 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O6 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O7 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O8 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O9 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O10 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O11 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O12 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O13 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O14 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O15 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O16 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O17 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O18 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O19 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.

# Appendix O20 — Additional Engineering Notes

### Implementation notes

A robust Sketch2UI implementation should preserve a clear distinction between data used for model training and data used for application runtime. Runtime inference should never modify the approved training dataset directly. Instead, corrected examples should enter a review queue. This allows the system to maintain reproducible dataset versions and makes it possible to compare a model trained on dataset version N against a model trained on version N+1.

The frontend should treat detections as immutable server records plus temporary visual state. When a user drags a box, the application can update local state immediately for responsive feedback, then persist the final state when the drag ends. The same principle should be used for resizing, changing class labels, and reordering components. This avoids excessive API traffic and makes the editor feel interactive.

The layout reconstruction engine should use deterministic rules before any learned layout model is added. Deterministic rules are easier to inspect when a generated page is wrong. For example, if four cards have similar widths and aligned y coordinates, the rule can confidently create a four-column grid. If the layout is irregular, the engine should preserve geometry rather than inventing a strong structure. A controlled fallback is preferable to a visually impressive but unstable guess.

The code generator should operate only on the validated UI-IR. This creates a stable contract between perception and generation. It also makes it possible to test the HTML/CSS generator with hand-created UI trees, which is extremely useful when the YOLO model is still being trained.

During evaluation, record both successful and failed examples. The failed examples are often more useful than average metrics because they reveal systematic weaknesses such as confusion between `image`, `card`, and `section`, or false positives caused by arrows and handwritten margin notes. The project should maintain an error taxonomy and track how many failures belong to each category.

The project should also keep a changelog for classes, model versions, UI-IR schema, and code-generator versions. A change to the class taxonomy may affect training, inference, layout reconstruction, and code generation simultaneously. Versioning prevents silent incompatibilities.

Finally, keep the first production-like deployment intentionally simple. One React frontend, one Node API, one Python inference worker, PostgreSQL, Redis, and object storage are enough. Additional services should only be introduced when there is an actual operational reason. This keeps the project understandable while still demonstrating a real multi-component architecture.



# Appendix G — Concrete 12-Week Implementation Schedule

## Week 1 — Architecture and repository

**Objectives**

- freeze MVP scope;
- initialize repository;
- define class taxonomy;
- create database schema;
- create React shell;
- create Node API shell;
- create Python worker shell;
- make Docker Compose startup work.

**Outputs**

```text
Sketch2UI/
  apps/web
  apps/api
  services/cv-worker
  packages/ui-ir
  packages/codegen
```

**Acceptance**

Running one command starts all required development services.

## Week 2 — Upload and project workspace

Build:

- project creation;
- project dashboard;
- upload screen;
- source image viewer;
- project persistence.

Do not implement ML yet.

The goal is to have a reliable visual workspace.

## Week 3 — Manual annotation

Build:

- page rectangle;
- component rectangles;
- class picker;
- move and resize;
- deletion;
- save annotation.

At the end of Week 3, the user should be able to manually annotate any sample sketch.

## Week 4 — UI tree and code generation

Build:

- containment inference;
- tree panel;
- manual re-parenting;
- HTML renderer;
- CSS renderer.

At the end of Week 4:

```text
manual sketch annotation
→ UI tree
→ HTML/CSS
→ preview
```

must already work.

## Week 5 — Dataset engineering

Collect and annotate the first dataset.

Deliver:

- annotation guide;
- class list;
- train/validation/test split;
- label validator;
- dataset statistics.

Create a report with:

- total images;
- objects per class;
- average objects/image;
- class imbalance.

## Week 6 — YOLO training

Run baseline training.

Inspect:

- precision;
- recall;
- mAP;
- confusion matrix;
- missed objects.

Create a hard-example list.

## Week 7 — Inference integration

Connect Python worker to the queue.

Flow:

```text
API
 ↓
job
 ↓
worker
 ↓
model
 ↓
detections
 ↓
database
 ↓
frontend
```

The user should now be able to run automated detection.

## Week 8 — Page filtering and hard negatives

Implement:

- page detection;
- perspective correction;
- crop;
- outside-page filtering;
- hard-negative tests.

Create screenshots showing:

```text
outside note → rejected
inside button → accepted
```

## Week 9 — Layout inference

Implement:

- reading order;
- row grouping;
- column grouping;
- repeated card detection;
- parent-child relationships.

Compare automatic UI tree to hand-corrected tree.

## Week 10 — Live preview and code editing

Add:

- Monaco editor;
- preview refresh;
- device presets;
- code versioning.

Implement safe iframe preview.

## Week 11 — Feedback loop and export

Add:

- add/correct/delete detection;
- correction history;
- training sample export;
- ZIP export;
- annotated-image export.

## Week 12 — Evaluation and presentation

Prepare:

- final benchmark;
- metrics;
- screenshots;
- architecture diagram;
- sequence diagram;
- demonstration script;
- limitations;
- future work.

# Appendix H — Core Sequence Diagrams

## H.1 Upload sequence

```text
User
 │
 │ POST image
 ▼
Frontend
 │
 │ multipart request
 ▼
API
 │
 ├── validate
 ├── create asset
 └── store object
 │
 ▼
Database
 │
 ▼
Frontend
 │
 └── display project image
```

## H.2 Detection sequence

```text
User
 │
 │ click Detect
 ▼
Frontend
 │
 │ POST detection job
 ▼
API
 │
 │ enqueue
 ▼
Redis
 │
 ▼
CV Worker
 │
 ├─ preprocess
 ├─ page detect
 ├─ YOLO
 ├─ filter
 └─ save detections
 │
 ▼
Database
 │
 ▼
Frontend
 │
 └─ render boxes
```

## H.3 Code-generation sequence

```text
User
 │
 │ Generate Code
 ▼
API
 │
 ├─ load accepted detections
 ├─ load layout
 └─ invoke codegen
 │
 ▼
UI-IR
 │
 ▼
HTML/CSS Generator
 │
 ▼
Code Version
 │
 ▼
Database
 │
 ▼
Frontend
 │
 └─ preview iframe
```

# Appendix I — Example Layout Heuristic Pseudocode

```python
def build_ui_tree(detections, page_bbox):
    accepted = filter_inside_page(detections, page_bbox)

    containers = [
        d for d in accepted
        if d.class_name in {
            "header",
            "section",
            "footer",
            "navbar",
            "card",
            "form",
            "sidebar"
        }
    ]

    atoms = [
        d for d in accepted
        if d not in containers
    ]

    tree = create_page_root(page_bbox)

    for container in sort_by_area_ascending(containers):
        parent = find_best_parent(container, tree)
        attach(parent, container)

    for atom in atoms:
        parent = find_best_parent(atom, tree)
        attach(parent, atom)

    infer_reading_order(tree)
    infer_rows_and_columns(tree)
    infer_layout_modes(tree)

    return tree
```

# Appendix J — Example Page Filtering Pseudocode

```python
def accepted_detection(det, page_polygon):
    cx = det.x + det.width / 2
    cy = det.y + det.height / 2

    if not point_inside_polygon((cx, cy), page_polygon):
        return False

    overlap = intersection_area(det, page_polygon) / max(
        area(det),
        1e-9
    )

    return overlap >= 0.50
```

For difficult photographs, use the page polygon after perspective correction instead of the original image boundary.

# Appendix K — Recommended First 25 Common Classes

If the dataset is too small for the complete taxonomy, use:

```text
0  page
1  header
2  footer
3  section
4  navbar
5  nav_item
6  logo
7  heading
8  text
9  image
10 button
11 link
12 icon
13 card
14 card_title
15 card_text
16 card_button
17 input
18 form
19 list
20 list_item
21 search_box
22 menu_button
23 carousel
24 divider
```

This reduced set provides a much easier starting point for a tiny model.

# Appendix L — Recommended Demonstration Images

Your dataset and final demo should include examples representing:

1. clean digital-looking wireframe;
2. rough pencil sketch;
3. graph-paper sketch;
4. photographed page;
5. perspective-distorted page;
6. external annotations;
7. external arrows;
8. multiple cards;
9. form;
10. carousel;
11. footer;
12. long single page;
13. two-page design;
14. car marketplace;
15. recipe page;
16. portfolio page;
17. nonprofit page.

This variety supports a convincing claim that the application handles more than one fixed template.

# Appendix M — Feature Prioritization Rule

Use the following priority:

### P0 — Must work

- upload;
- page boundary;
- YOLO detection;
- correction;
- UI tree;
- HTML;
- CSS;
- preview.

### P1 — Strongly recommended

- project history;
- code editor;
- responsive preview;
- ZIP export;
- dataset feedback;
- model versioning.

### P2 — Future

- OCR;
- React;
- Tailwind;
- camera;
- multiple-page management;
- collaboration;
- active learning.

A feature should not become P0 merely because it sounds impressive. It should be P0 only if the core product cannot demonstrate its value without it.

# Appendix N — Final Project Statement

The final Sketch2UI system can be described as:

> **A computer-vision-assisted web application that interprets hand-drawn webpage wireframes, detects common UI components using a custom lightweight YOLOv5 detector, filters external annotations using page-boundary awareness, reconstructs a hierarchical UI representation from spatial relationships, generates semantic HTML and CSS, and renders the resulting interface through an interactive live preview with manual correction and export capabilities.**

This statement accurately separates the contribution into:

- computer vision;
- geometric/layout reasoning;
- code generation;
- interactive software engineering.

That separation should also guide the implementation, testing, and project report.


---

**Document statistics:** approximately 20,014 words. The content is organized as an implementation blueprint rather than a high-level concept note.




# Appendix P — Detailed Component-to-Code Mapping Rules

The code generator should have an explicit mapping table instead of relying on ad-hoc conditional statements. A mapping layer makes the system extensible and allows the same detector classes to be reused for multiple code-generation targets later.

## Structural mapping

```text
page              → <main>
header            → <header>
footer            → <footer>
section           → <section>
navbar            → <nav>
sidebar           → <aside>
form              → <form>
card              → <article>
list              → <ul>
list_item         → <li>
```

## Content mapping

```text
logo              → <a> or <div> containing <img>
heading           → <h1>/<h2>/<h3> based on hierarchy
text              → <p>
link              → <a>
image             → <img>
video             → <video> or placeholder container
icon              → <span> or SVG placeholder
avatar            → <img>
```

## Interaction mapping

```text
button            → <button>
input             → <input>
textarea          → <textarea>
select            → <select>
checkbox          → <input type="checkbox">
radio             → <input type="radio">
menu_button       → <button>
search_box        → <input type="search">
```

## Fallback policy

If the class has no direct HTML equivalent, generate a neutral container and preserve its semantic type in a data attribute:

```html
<div
  class="ui-component"
  data-ui-type="testimonial"
>
  ...
</div>
```

This allows future generators to support more advanced component types without losing the original detection information.

# Appendix Q — Content Extraction Strategy

The first version should not make OCR a hard dependency for generating the page. A hand-drawn label can be detected as `heading` without being perfectly read.

Use three content states:

```text
known
unknown
user-edited
```

For example:

```json
{
  "type": "heading",
  "text": null,
  "contentState": "unknown"
}
```

The preview can use:

```text
Heading
```

as a placeholder.

Later, OCR can update the same field:

```json
{
  "text": "Find Your Perfect Car",
  "contentState": "recognized"
}
```

The user can then edit it:

```json
{
  "text": "Find Your Perfect Car Today",
  "contentState": "user-edited"
}
```

This approach prevents OCR errors from blocking the rest of the pipeline.

# Appendix R — Multi-Stage Detection Strategy

For complex sketches, consider using multiple detection passes.

## Pass 1 — Macro components

Detect:

```text
page
header
section
footer
hero_section
navbar
sidebar
```

## Pass 2 — Atomic components

Crop or mask the macro regions and detect:

```text
heading
text
image
button
icon
link
card
input
```

This can improve detection in crowded layouts because the detector does not need to reason about every object at the same scale.

## Pass 3 — Repeated structures

Run a geometric algorithm over detections to find:

```text
cards
columns
rows
carousel items
feature groups
```

The final result is then passed to the UI-IR builder.

This multi-stage approach is especially useful when the full-page image contains very small components that a lightweight model may otherwise miss.

# Appendix S — Resolution and Image Preprocessing Rules

The source may be a small phone photo or a large scanned page. Normalize it before inference.

Recommended processing stages:

```text
decode
→ orientation correction
→ resize
→ optional deskew
→ contrast normalization
→ page detection
→ crop
→ detector input
```

Preserve the original dimensions for final coordinate conversion.

Keep a metadata object such as:

```json
{
  "originalWidth": 1536,
  "originalHeight": 2048,
  "processedWidth": 1280,
  "processedHeight": 1707,
  "scaleX": 1.2,
  "scaleY": 1.2
}
```

If perspective correction is applied, also store the transformation matrix so that detections can be mapped back to the original image when the user wants to compare results.

# Appendix T — User Correction Workflow in Detail

A good correction workflow is more important than attempting perfect initial detection.

### Wrong class

User clicks:

```text
image
```

and selects:

```text
card
```

The app updates the UI tree immediately.

### Missing object

User clicks “Add component”, draws a box, selects:

```text
button
```

and saves.

### False positive

User selects a detected object located over an external handwritten annotation and clicks:

```text
Ignore
```

The object is marked as ignored rather than physically removed from the source image.

### Wrong box

User drags a handle.

The system updates normalized coordinates and re-runs local parent inference if necessary.

### Re-run layout

After corrections, provide:

```text
Rebuild UI Tree
```

rather than automatically rewriting the entire tree after every drag.

This gives the user control over when structural changes occur.

# Appendix U — Training Dataset Quality Gates

Before a dataset version is used for training, run automated checks.

## Check 1 — Missing label file

Every image that should be annotated must have a corresponding label file.

## Check 2 — Invalid class

Reject class IDs outside the declared class range.

## Check 3 — Invalid coordinates

Reject:

```text
x < 0
y < 0
x > 1
y > 1
width <= 0
height <= 0
```

## Check 4 — Degenerate boxes

Reject boxes smaller than the dataset minimum unless intentionally allowed.

## Check 5 — Extreme overlap

Flag suspicious cases where dozens of unrelated boxes overlap heavily.

## Check 6 — Duplicate images

Use image hashes to identify accidental duplicates.

## Check 7 — Split leakage

Do not allow near-duplicate photos or the same page captured multiple times into train and test.

## Check 8 — Class imbalance

Generate a report:

```text
class                 objects
--------------------------------
page                  480
header                460
button                1275
image                 1820
...
```

Classes with extremely low frequency should be merged, increased through collection, or deferred.

# Appendix V — Model Error Analysis Workflow

After every training run:

1. export validation predictions;
2. sort by lowest confidence;
3. inspect false positives;
4. inspect false negatives;
5. review confusion matrix;
6. identify the top five error patterns;
7. add representative samples;
8. retrain;
9. compare against the same benchmark.

Example:

```text
Problem:
external handwritten note detected as text.

Root cause:
model sees high-contrast handwriting outside page.

Intervention:
add external-note hard negatives;
improve page-cropping;
filter detections by page polygon.

Result:
compare false-positive rate before/after.
```

This is much more informative in an academic report than simply saying the model was retrained.

# Appendix W — Recommended UI-IR Validation

Validate the generated tree before code generation.

Rules can include:

```text
page must have at most one primary header
page may have one or more sections
footer should normally be near the end
nav_item should be inside navbar
card_title should normally be inside card
card_button should normally be inside card
carousel_prev should normally be inside carousel
carousel_next should normally be inside carousel
```

If a rule is violated, show a warning rather than failing the entire generation.

Example:

```text
Warning:
nav_item "Home" is not inside a navbar.

Action:
Re-parent automatically
or
Keep current structure
```

The user should be able to choose.

# Appendix X — Generated CSS Layout Decision Tree

Use the following decision process.

```text
Are there multiple child elements?
        │
       yes
        │
Are they aligned horizontally?
        │
       yes
        │
Are widths approximately equal?
   │                 │
  yes                no
   │                  │
grid likely        flex likely
```

For vertical groups:

```text
elements stacked vertically
→ flex column or normal block flow
```

For repeated equal cards:

```text
repeated geometry + equal spacing
→ grid
```

For overlay elements:

```text
element overlaps another by design
→ relative parent + absolute child
```

The engine should prefer the simplest layout that explains the observed geometry.

# Appendix Y — Code Generator Versioning

Generated artifacts should include:

```json
{
  "modelVersion": "ui-detector-1.2.0",
  "uiIrVersion": "1.0",
  "generatorVersion": "1.1.0",
  "generatedAt": "timestamp"
}
```

This makes old exports traceable.

If the generator changes, the project can be regenerated while retaining the previous code version.

# Appendix Z — Complete Definition of the First Production-Like Demo

The final demo should start with a real hand-drawn sketch containing:

- a header;
- logo;
- navigation;
- hero;
- image;
- heading;
- paragraph;
- button;
- card grid;
- footer;
- handwritten annotations outside the page.

The system should then demonstrate:

```text
1. Upload
2. Page boundary
3. Ignore outside annotations
4. YOLO detection
5. Confidence display
6. Component correction
7. UI tree
8. HTML
9. CSS
10. Live preview
11. Responsive preview
12. Export
```

The presenter should also show one intentionally difficult image in which the model makes a mistake, correct that mistake, and explain how the correction can become future training data. This demonstrates that the application is designed as an improving system rather than a one-shot demo.

# Appendix AA — Final Architectural Principles

The following principles should remain true throughout development:

1. **Detection is not generation.** The detector finds objects; the generator builds code.
2. **The page boundary is first-class.** External annotations must be filtered before structural reasoning.
3. **The UI-IR is the contract.** It decouples machine learning from frontend generation.
4. **Corrections are valuable data.** Preserve them with provenance.
5. **Lightweight models need a focused taxonomy.** Do not create dozens of visually ambiguous classes prematurely.
6. **Prefer deterministic geometry before adding another neural model.**
7. **Use semantic HTML and maintainable CSS.**
8. **Isolate preview execution.**
9. **Version models, datasets, schemas, and generators.**
10. **Measure the complete pipeline, not only the detector.**

With these principles, Sketch2UI can be implemented as a coherent computer-vision and web-engineering system rather than a collection of disconnected features.



# Appendix AB — Additional Operational Checklist

Before declaring the implementation finished, verify the complete chain with a clean environment rather than only the developer machine. Clone the repository into a fresh environment, install the documented dependencies, start the services from the documented commands, apply database migrations, load the registered model, and execute the end-to-end benchmark. Confirm that a new user can create a project, upload an image, run detection, inspect accepted detections, correct at least one component, rebuild the UI tree, generate HTML/CSS, open the preview, and export the result without manual intervention from the developer.

Also verify that deleting a project does not accidentally delete shared model files, that a failed inference job does not corrupt a project, that a missing image asset produces a visible fallback rather than a broken preview, and that a model-version mismatch is reported explicitly. Keep the final demo data, sample screenshots, benchmark results, architecture diagram, and model metrics in a dedicated `docs/demo` directory so the final presentation can be reproduced.

The most important implementation milestone is not the number of classes or features. It is a stable end-to-end pipeline in which the original sketch remains traceable through page isolation, YOLO detection, layout reconstruction, UI-IR, HTML/CSS generation, preview, and export. Once that path works reliably, additional classes, OCR, React export, better models, collaboration, and advanced AI-assisted design features can be added without rewriting the foundation.
