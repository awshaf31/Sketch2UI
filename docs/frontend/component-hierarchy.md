---
title: "Sketch2UI — Frontend Component Hierarchy"
deliverable: "Phase 2, Deliverable 12"
---

# Component Hierarchy

Adapted from the repository's actual structure (not a generic template) — new
components are marked **NEW**; everything else maps directly onto an existing file
(see [design-to-code-mapping.md](design-to-code-mapping.md) for exact paths).

```
App
├── AppHeader                              NEW — extracted, shared by both routes
│   └── BrandMark                          NEW
│
├── Dashboard                              (pages/Dashboard.tsx)
│   ├── ProjectCreateForm                  NEW — extracted from inline JSX
│   │   ├── Field                          NEW (shared)
│   │   └── Button                         NEW (shared)
│   ├── ProjectList                        NEW — extracted, grid instead of <ul>
│   │   └── ProjectCard[]                  NEW
│   │       └── ConfirmDialog              NEW (shared) — delete confirmation
│   ├── EmptyState                         NEW (shared)
│   └── ErrorState                         NEW (shared)
│
└── ProjectWorkspace                       (pages/ProjectWorkspace.tsx)
    ├── WorkspaceToolbar                   NEW — extracted from inline header JSX
    │   ├── Button ×4                      (Detect, Approve, Export, Save version)
    │   └── VersionBadge                   NEW — "v3 · generated · active"
    │
    ├── StatusBar                          NEW — replaces 4 stacked banner <div>s
    │   ├── DetectJobSegment               NEW — wraps existing useDetectionJob state
    │   ├── PageBoundarySegment            NEW — wraps existing boundary state
    │   ├── RejectedCountSegment           NEW
    │   ├── ActiveVersionSegment           NEW
    │   └── ExportsPopover                 NEW — was an inline strip
    │
    ├── UploadDropzone                     (features/upload/UploadDropzone.tsx — UNCHANGED, shown when !asset)
    │
    └── WorkspaceBody                      NEW — grid shell for the 4 regions below
        │
        ├── LayersPanel                    NEW — was tree's parent <div> in ProjectWorkspace
        │   ├── Panel                      NEW (shared shell)
        │   └── UITree                     (features/tree/UITreePanel.tsx — logic UNCHANGED)
        │       └── TreeNode[]             (same file — restyled: icons + collapse, per component-specification.md)
        │
        ├── CanvasPanel                    NEW — was the canvas's parent <div>
        │   ├── CanvasToolbar              NEW — ClassPicker + zoom/pan controls
        │   │   └── ClassPicker            (features/annotation/ClassPicker.tsx — UNCHANGED)
        │   ├── SketchCanvas               (features/annotation/AnnotationCanvas.tsx — pointer math UNCHANGED, rendering restyled)
        │   │   ├── PageBoundaryOverlay    (features/detection/PageBoundaryOverlay.tsx — UNCHANGED)
        │   │   └── DetectionOverlay[]     (inline in AnnotationCanvas today — may stay inline or extract, see mapping doc)
        │   └── CanvasLegend               NEW
        │
        ├── InspectorPanel                 (features/inspector/InspectorPanel.tsx — restructured internally)
        │   ├── Panel                      NEW (shared shell)
        │   ├── AccordionSection ×6        NEW (shared) — wraps each existing section
        │   │   ├── DetectionSection       (same file, same logic — extracted into its own render function/component)
        │   │   ├── StyleSection           (same file, same logic — extracted)
        │   │   ├── GeometrySection        (same file, same logic — extracted)
        │   │   ├── StructureSection       (same file, same logic — extracted)
        │   │   ├── ContentSection         (same file, same logic — extracted)
        │   │   └── HistorySection         (same file, same logic — extracted)
        │   └── InspectorSectionFooter     NEW (shared) — replaces 5 duplicated Apply/Reset blocks
        │
        └── BottomDock                     NEW — was the fixed w-[480px] column
            ├── DockHeader                 NEW
            │   ├── Tabs                   NEW (shared) — Preview / Code
            │   └── VersionSelect          NEW — pill row or dropdown, see code-preview-design.md
            ├── PreviewPane                (features/preview/PreviewPane.tsx — UNCHANGED contract, restyled chrome)
            └── CodePanel                  (features/code/CodePanel.tsx — UNCHANGED contract, Monaco theme flips to light)

Cross-cutting (mounted once, near App root):
├── ToastStack                             NEW — replaces window.alert() call sites
└── DialogHost                             NEW — replaces window.confirm() call site + any future dialogs
```

## What does NOT change shape

Per [README.md](README.md)'s non-negotiable constraints, these keep their current
external contract (props in, behavior out) regardless of where they're mounted in the
tree above:

- `AnnotationCanvas` — pointer-event handlers, coordinate transform functions
- `PageBoundaryOverlay` — same
- `useDetectionJob` — same hook, same polling contract
- `services/api.ts` — zero changes
- `stores/projectStore.ts` — zero changes
- `utils/tree.ts` (`buildTreeAndCode`) — zero changes
- `PreviewPane`'s `sandbox=""` iframe contract — zero changes
