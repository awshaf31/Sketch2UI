# Layout reconstruction against real detector output

Plan references: §11 (layout reconstruction), §12.2 (each stage independently
inspectable), §51 step 11.

The §11 engine had existed since the skeleton but had only ever run on clean,
hand-placed manual detections. This records what happened the first time it saw real
model output, and what was changed as a result.

## Evidence in this repo

`docs/ml/fixtures/` holds the detection overlays and generated pages referenced below:
`sample_wildcard.overlay.jpg`, `hdwe_radio_heavy.overlay.jpg`,
`sample_community.html`, `sample_carsale.html`.

## Fixtures

Nine real runs of the full Step 9+10 pipeline (detect → boundary filter → layout):
the 5 original sample sketches, plus 4 dense external images
(`hdwe_1000099773`, `hdwe_1000099700`, `hdwe_1000099712`, `wf_0`) chosen for
grids/forms/nav density. Accepted (`status: "active"`) detections only — no synthetic
data.

> Note on the HDWE images: they are **component catalogue sheets** (rows of isolated
> widgets), not page layouts. They exercise duplicate detection, row grouping and the
> new classes well, but carry no page hierarchy to reconstruct — a flat tree is the
> correct output for them, not a bug.

## What broke: duplicate different-class detections

**Confirmed, and fixed.** §11 assumes one drawn element yields one detection. Real
output violates that constantly: the detector fires two *different* classes on one
stroke, because §9.3's ambiguous classes look identical hand-drawn. Per-class NMS inside
the detector cannot suppress this — it only dedupes within a class.

Measured IoU distribution of overlapping pairs across all 9 fixtures:

| IoU band | different-class | same-class |
|---|---:|---:|
| ≥0.9 | 16 | 0 |
| 0.8–0.9 | 1 | 0 |
| 0.7–0.8 | 2 | 0 |
| **0.5–0.7** | **0** | 3 |
| 0.3–0.5 | 2 | 1 |

Examples (all genuine duplicates of one stroke):

```
IoU=0.966  hdwe_checkbox_table   checkbox(0.67) vs text(0.54)
IoU=0.960  hdwe_dense_table      select(0.74)   vs carousel(0.57)
IoU=0.952  hdwe_checkbox_table   radio_button(0.78) vs heading(0.73)
IoU=0.942  hdwe_checkbox_table   input(0.98)    vs button(0.87)
IoU=0.932  sample_carsale        heading(0.71)  vs text(0.62)
IoU=0.924  sample_wildcard       text(0.80)     vs heading(0.55)
```

Two harmful effects, both observed:

1. **Spurious nesting** — the marginally larger twin "contains" the other, so
   `select > textarea`, `heading > text`, `button > carousel` appeared as real hierarchy.
2. **Duplicate siblings** inflating row and grid counts.

### Fix: `resolveOverlappingDetections` (layout.ts)

Runs before tree building. Greedy by confidence descending; a detection is dropped if a
already-kept detection of a **different** class overlaps it at IoU ≥ **0.70**.

**Threshold justification:** 0.70 sits inside the empty 0.5–0.7 band. It captures all 19
observed duplicates (lowest genuine one is 0.727) while staying clear of the 0.3–0.5
region where legitimately distinct elements overlap. Any value in [0.5, 0.727] gives
identical results on this data; 0.70 is the conservative end.

Same-class overlaps are left to the detector's own NMS; none reached 0.70 anyway.

**Effect:**

| fixture | nodes | spurious nestings |
|---|---|---|
| hdwe_checkbox_table | 68 → 62 | 6 → 0 |
| hdwe_dense_table | 78 → 72 | 4 → 0 |
| hdwe_radio_heavy | 62 → 59 | 2 → 0 |
| sample_carsale | 23 → 22 | 1 → 0 |
| sample_wildcard | 13 → 11 | 1 → 0 |
| sample_community / jeffrey / portrait / wf_form | unchanged | 0 → 0 |

**14 spurious nestings → 0.** The four fixtures with no duplicates are byte-identical —
the pass does not disturb what already worked.

## What did NOT break

### Pixel jitter / row fragmentation — checked, not present

§11.6's row tolerance is 0.03 of page height. Across 63 sibling sets:

- every repeated-sibling group that formed had centre-y spread **0.0000–0.0261**, all
  inside tolerance;
- a sensitivity sweep (tol 0.02→0.06) shows row counts changing smoothly, no cliff;
- every sibling set that merges when tolerance is raised 0.03→0.04 is **mixed-type**
  (`[image,button]`, `[group,textarea]`, `[form,textarea,carousel]`) — genuinely
  different rows being over-merged, never a fragmented same-type row being repaired.

**No tuning applied.** Raising the tolerance would over-merge distinct rows.

⚠️ Headroom is thin though: the widest successful group (0.0261) sits 13% under the
limit. Worth re-measuring if sketch photos get more skewed.

### Sparse trees from missed detections — degrades gracefully

287 nodes across all fixtures: **0 malformed** (no duplicate ids, no cycles, no
non-finite or zero-area bboxes), 0 empty trees. Truncated inputs of 0/1/2 detections
produce 0/1/2 root children with no throw and no bogus layout.

The engine renders what it has and does not try to compensate for missing detections —
which is correct: weak recall on `select`/`radio_button`/`carousel` is a Step 8 detection
problem, not something layout reconstruction should paper over.

### New Step 7 classes — generic rules already correct, no special-casing added

| class | observed treatment |
|---|---|
| `table` | leaf everywhere (detector emits no cells); in `CONTAINER_CLASSES` so it *would* accept children; `inferLayout` returns undefined below 2 children, so an empty table gets no bogus layout. A row of 4 tables correctly became one `grid c=4` group. |
| `checkbox` | always atomic leaf, inside `form`/`section`/root. Never force-fit into card/grid container logic. |
| `radio_button` | same; a row of 5 correctly became one grid group. |

No code added for these.

## Known limitation, deliberately not fixed

`sample_carsale` has three card titles side by side that the detector labels
inconsistently — one `text`, two `heading`. `groupRepeatedSiblings` requires all-same-type,
so they do not group, and the section falls back to `flex column`: three titles that
should sit in a row render stacked.

This is the **same category as the sparse-tree case**: the detector gave one visual role
two different labels. Fixing it in layout would mean grouping heterogeneous siblings,
which would wrongly fuse genuinely different elements (a heading followed by a button
becoming a 2-column grid). Left alone; the fix belongs in detection consistency.

## End-to-end

`642be96a` through the live stack (upload → detect → boundary → layout → codegen):
5 sections, 15 images, 1 grid group, 2 grid CSS rules, 2256 bytes HTML. The structure
mirrors the source sketch's five content bands, with a 4-across grid where the sketch has
a 4-card row and 3-across flex rows where it has three.
