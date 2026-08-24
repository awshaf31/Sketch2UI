# Page boundary and external-annotation filtering

Plan references: §10 (all), Appendix J (filtering pseudocode), §51 step 10.

Sketches routinely carry handwritten notes *outside* the drawn page — "this image stays
static", "go to page 4", arrows, measurements. §10.1: those must not end up in the
accepted detection set. This document covers how that works and, importantly, what it
deliberately does **not** do.

---

## ⚠️ Deliberate scope deferral: no perspective correction or cropping

§10.2's recommended pipeline is:

```
original image → page boundary detector → perspective correction → cropped page image
→ YOLO inference → detections → boundary filtering
```

**The perspective-correction and cropping steps are intentionally not implemented.** This
is a considered deferral, not an oversight or a gap to be found later by accident.

What happens instead: the boundary is detected and reported as a **polygon in the
original image's normalized coordinate space**, and filtering is applied to detections
in that same space. No image is warped, cropped, re-encoded, or re-based.

Why:

- Rectifying the image changes the coordinate space that **every** downstream consumer
  depends on — stored `Detection` bboxes, the canvas overlay in `apps/web`, the asset
  served from `/uploads`, and the UI-IR the code generator builds. Introducing a second
  coordinate space touches all of them at once.
- Inference currently runs on the **original** image, so a cropped-space polygon would
  have to be mapped back anyway.
- Sharing one coordinate space is what makes the client-side re-filter possible: when the
  user drags the boundary, the browser re-partitions accepted/rejected locally with no
  round trip, because polygon and bboxes are directly comparable.
- The filtering value this step exists for — keeping off-page notes out of the generated
  page — is fully delivered without rectification.

Consequence to be aware of: on a **strongly skewed photograph**, the axis-aligned
detection boxes and the skewed page quad are a poorer fit for each other than they would
be after rectification, so the overlap test is less precise at the edges. The manual
boundary adjustment (Strategy C) is the mitigation until rectification is built.

Doing this properly later means: warping the asset, storing both the original and the
rectified image, defining which space `Detection.bbox` lives in, and migrating existing
records. That is its own step.

---

## Strategy (§10.3)

| Strategy | Status |
|---|---|
| **A** — explicit trained `page` class | **Not available.** `ui-detector/v1.0.0` trains on a 16-class subset that excludes `page` for insufficient train/val/test coverage. See `ml/dataset/v1-training-scope.md`. |
| **B** — OpenCV contours | **Primary.** `services/cv-worker/app/preprocessing/page_boundary.py`. |
| **C** — manual correction | **Implemented**, as §10.3 requires ("always provide a fallback in the UI"). Drag/resize the boundary on the annotation canvas. |

### Strategy B pipeline

```
grayscale → Gaussian blur → { Canny + dilate, adaptive threshold + close }
→ findContours → keep contours ≥30% of image area → approxPolyDP toward a 4-point convex quad
→ ink-containment check → score → best quad
```

Two binarizations run in parallel because they fail differently: Canny finds a crisp
paper edge against a contrasting background, adaptive thresholding copes with a page
whose edge is a drawn line rather than a lighting change.

#### The ink-containment guard

A large **drawn component** — a content container, a table, a hero box — reduces to a
clean 4-point convex quad exactly as readily as a sheet of paper does. Area and
rectangularity cannot tell them apart.

This was not theoretical. On the merged dataset's wireframe images, contour detection
confidently (~0.80) returned the main content rectangle as the "page". On `wf_5` that
quad spanned y=0.244–0.875 while the ground-truth `table` sat at y=0.022–0.169 —
**entirely outside it**. Filtering on that boundary would have rejected real page content.

So a candidate quad must additionally contain ≥90% of the image's ink (thresholded
stroke pixels). A real page contains its own drawing; a content container leaves the
header, nav and footer outside. Measured, the separation is stark: sample sketches score
>0.95, the container false positives sat near 0.6. Adding the guard took external-image
false positives from 5-in-30 to 0.

#### No boundary found is a normal outcome

A tightly-cropped digital sketch has no visible paper edge. That returns
`method: "none"`, `confidence: 0.0`, and the full image as the polygon — **not an error**.
Filtering is skipped entirely and every detection stays active. A quad covering ≥98.5% of
the frame is also reported as "none", since it carries no information beyond the image
border.

---

## The hard filtering rule (§10.4)

> Only retain detections that are within the accepted page geometry… Use overlap
> thresholds for boxes that cross the boundary.

**Criterion: the fraction of a detection's area falling inside the polygon, ≥ 0.50.**

Not a center-in-polygon test. A wide header whose center falls just outside the page is
still mostly inside and should be kept; a note whose center drifts just inside should not
be. Appendix J's sample requires the center test *in addition*, which is redundant for a
convex quad at a 0.50 threshold and re-introduces the straddle failure the overlap test
exists to fix — so overlap alone is used, at Appendix J's threshold.

Boundaries below **0.35 confidence** are not applied at all. Silently rejecting
detections on a bad guess is worse than keeping an off-page note.

### Implemented twice, deliberately

| Where | File |
|---|---|
| Worker (at detection time) | `services/cv-worker/app/preprocessing/boundary_filter.py` |
| Client (on every boundary edit) | `packages/shared-types/src/boundary-geometry.ts` |

Both use Sutherland–Hodgman clipping and are verified to agree to floating-point
identity. **They must stay in sync — change one, change the other.** The duplication buys
instant re-filtering when the user drags the boundary, with no server round trip.

---

## Rejected, never deleted (§10.7)

> External notes should remain visible in the source image but not appear in the accepted
> detection set. This is preferable to physically deleting them from the source.

A detection outside the boundary is persisted with `status: "rejected"`, not dropped:

- it stays in the store and in `GET /detections`;
- the canvas renders it **dimmed** and labelled "· outside page", behind a show/hide toggle;
- `packages/codegen` already filters to `status === "active"`, so it never reaches the
  generated page — **no code generator change was needed for this step**;
- dragging the boundary to include it makes it active again immediately, with no re-detect.

Manual detections are **never** re-filtered. The user drew them deliberately; silently
rejecting their own work because a detected quad clipped it would be wrong.

---

## Contracts

Both extensions are **additive** — callers predating this step ignore the new fields.

`POST /detect` (cv-worker) gains:

```json
{
  "pageBoundary": {
    "polygon": [[0.108,0.033],[0.9,0.051],[0.9,0.952],[0.107,0.951]],
    "confidence": 0.9312, "method": "contour",
    "areaFraction": 0.721, "applied": true, "overlapThreshold": 0.5
  },
  "rejectedCount": 1
}
```

and each detection gains `status` and `insideFraction`.

`GET /api/jobs/:jobId` gains `pageBoundary` and `rejectedCount` on completion.

---

## Not implemented

- **Perspective correction / cropping** — see the deferral note above.
- **Multiple pages (§10.5)** — one boundary per asset. The plan itself defers this
  ("a later implementation can support multiple page outputs").
- **Persisting a user-adjusted boundary.** Strategy C edits live in client state for the
  session; they are not stored, so they do not survive a reload. Storing them needs a
  `page_boundaries` record keyed by asset, which is a small separate change.
