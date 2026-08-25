---
title: "Sketch2UI — Inspector Design"
deliverable: "Phase 2, Deliverable 8"
current_implementation: "apps/web/src/features/inspector/InspectorPanel.tsx (1,050 lines, all sections always-expanded)"
---

# Inspector Design

The Inspector's underlying contract — per-section local draft, dirty check against
persisted state, Apply persists + regenerates, Reset clears the override and
regenerates — is sound (Phase 1 audit §24) and **is not changed**. This spec changes
only how the six sections are presented: accordion instead of always-expanded, and a
shared visual language for status/dirty/error across all six instead of each section
reimplementing it.

## Shell: accordion, not always-expanded

Six sections, same order as `InspectorPanel.tsx` today: **Detection → Style →
Geometry → Structure → Content → History**. Each is a collapsible `AccordionSection`
(see [component-specification.md](component-specification.md)):

- Detection and History default **expanded** on first selecting a node (Detection
  because it's the identity of what you're looking at; History because it's read-only
  and cheap to glance at). Style/Geometry/Structure/Content default **collapsed**.
- A section that has an **applied override** shows a small `color-selection` dot next
  to its header even while collapsed — so "this node has custom style" is visible
  without opening every section, which is the direct fix for the audit's §16 "no way
  to tell which section has your latest change."
- A section with an **unapplied (dirty) draft** shows a `color-warning` dot instead,
  taking priority over the applied-dot if both would apply — dirty state is more
  urgent than "has a saved override."
- Opening a section is `motion-normal` (180ms) height transition; multiple sections
  can be open simultaneously (this is an accordion for scannability, not a
  mutually-exclusive tab set — a user actively comparing Style and Geometry can keep
  both open).

## Shared per-section footer

Every section keeps its existing Apply/Reset footer pattern, restyled onto one
component (`InspectorSectionFooter`) instead of six hand-written copies:

| State | Left-side caption | Right-side buttons |
|---|---|---|
| No override, clean | "No override" (`text-xs`, `color-text-muted`) | Reset disabled, Apply disabled |
| Dirty (unapplied draft) | "Unapplied" (`text-xs`, `color-warning`) | Reset enabled if an override exists, Apply enabled |
| Applied, clean | "Applied" or a group-specific variant (e.g. Content's `· {contentState}`) (`text-xs`, `color-success`) | Reset enabled, Apply disabled |
| Applying (busy) | "Working…" (`text-xs`, `color-text-muted`) + small inline spinner | Both disabled |
| Error | Error banner above the footer (`color-error`, `text-sm`, `color-error` 8%-tint background) | Buttons re-enabled so the user can retry |

This is a literal restyle of the exact state machine every section already implements
locally (`styleDirty`/`hasStyleOverride`/`busy` and its four siblings) — no new states,
one shared component instead of five duplicated ones.

## Detection section

| Field | Spec |
|---|---|
| Class | `<select>` styled as system `Select` component, same `ALL_CLASSES` taxonomy as `ClassPicker` |
| Confidence | Read-only, `font-mono text-sm`, `{Math.round(confidence*100)}%` — **never editable**, preserved exactly per the plan's explicit "do not let users falsify the model's confidence" rule |
| Model version | Read-only, `font-mono text-xs`, shown only when `modelVersionId` is set |
| Source | Read-only badge: "model" (violet-tinted) or "manual" (blue/emerald-tinted, matching canvas semantics) |
| Original model class | Shown only when `originalClassName` is present: "Model originally proposed: `{value}`" in `font-mono text-xs` |
| Revert to model | Secondary button, shown only when `originalClassName` is present — resubmits the original class via the same `onChangeClass` handler, unchanged |
| Apply | Enabled only when the class draft differs from `selected.className` |

## Geometry section

| Field | Spec |
|---|---|
| x / y / width / height | Four numeric inputs, `font-mono text-sm`, 2×2 grid, placeholder = current detection bbox value formatted to 4 decimals (unchanged "blank = inherit" convention) |
| Helper text | "Normalized [0..1] relative to the sketch. Leave a field blank to inherit the detection's stored value." — unchanged copy |
| Validation | Client-side via the existing shared `validateGeometryOverride` — same rules, same error message text, surfaced in the shared error-banner slot instead of a bespoke one |

## Structure section

| Field | Spec |
|---|---|
| Parent | `<select>`: "Auto (from containment)", "Root (page)", then `parentCandidates` — unchanged data/logic, restyled as system `Select` |
| Order | Numeric input, placeholder "Auto" — unchanged |
| Helper text | "Reparent this node or pin its position among its siblings. Leave a field blank to keep auto-inferred behaviour." — unchanged |

## Style section

| Field | Spec |
|---|---|
| display | `<select>`: Auto / block / flex / grid / inline-block — unchanged options |
| gap, padding, margin, font-size | Text inputs, `font-mono text-sm` (these are CSS value strings — mono is correct here per the type direction), unchanged placeholders |
| text-align | `<select>`: Auto / left / center / right — unchanged |
| Allowlist note | The six properties shown are **exactly** the server's `ALLOWED_PROPERTIES` set — this spec adds no new style fields, since doing so would require an API change out of scope for a frontend redesign |

## Content section

| Field | Spec |
|---|---|
| Applicability | Only fields in `contentFieldsFor(selected.className)` render — unchanged (Appendix P class→field mapping) |
| text | Textarea, 3 rows, `font-sans` (this is prose content, not a code value) |
| altText | Text input, `font-sans` |
| href | Text input, `font-mono text-sm` (a URL/path reads as data) |
| Not-applicable state | "Content editing does not apply to `{className}`." — unchanged copy, shown in place of the fields |
| Security | Client never needs new validation beyond what exists — the server's `<`/`>` rejection and href-scheme allowlist are unchanged and must continue to be the enforcement point (see [README.md](README.md)'s non-negotiable constraints table) |

## History section

Read-only, unchanged data source (`corrections` filtered to `selectedId`,
oldest-first). Presentation change only: each row becomes a small timeline item —
`font-mono text-xs` timestamp in a left rail, description text (`describeCorrection()`,
unchanged) to its right, connected by a thin `color-border` vertical line — a purely
visual upgrade from today's plain `<li>` list, same data, same empty-state copy ("No
corrections recorded yet.").

**Scope reminder carried from `docs/execution/phase-log.md` Phase 4:** History only
ever contains Detection/Geometry/Structure-originated records (create, delete, class
change, bbox change, parent change, order change) — Style and Content overrides are
deliberately excluded from correction history by the API itself. This spec does not
add Style/Content rows to History; that would require a backend change out of scope
here.

## Collapsed / expanded / loading / dirty / applying / error / success — summary

All six states above are defined once, generically, in this document's shared-footer
table and the accordion-dot rules — not redefined per section — because the current
implementation's worst structural problem (Phase 1 audit §16) was exactly that every
section reinvented this state machine slightly differently. The redesign's Inspector
has **one** state machine, applied six times.
