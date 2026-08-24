# Generated-page assets: crops vs. symbols

Plan references: §15.5 (asset handling — "original extracted image crops"), §13.2.

## The bug this fixes

`packages/codegen` emitted `src="./assets/${node.id}.png"` for every image-class node —
a path derived from the UI-IR node id, pointing at nothing. codegen had no reference to
the uploaded sketch, no crop, no storage URL.

**Both consumers were broken, in different ways:**

- **Live preview** — every `<img>` failed to load. The preview iframe uses
  `srcDoc` + `sandbox=""`, which gives it an **opaque origin with no base URL**, so a
  relative path cannot resolve at all. Images rendered as broken-image icons showing the
  alt text, and because they collapsed to zero height the card grid lost its structure
  too. This had never been checked.
- **Export ZIP** — the same dead paths 404'd over `file://`. Worked around in the export
  step with a labelled placeholder file.

## How one generator serves both

Preview needs **absolute API URLs** (a running server); export needs **relative paths**
(a static bundle opened over `file://`). Rather than fork codegen, the caller supplies
the policy:

```ts
export type AssetResolver = (node: UINode) => string | null;
generateHTML(root, { resolveAsset })
```

| Caller | Resolver returns | Why |
|---|---|---|
| live preview | `http://…/api/projects/:id/detections/:detId/crop.png` | absolute — the sandboxed iframe has no base URL |
| export | `./assets/<nodeId>.png`, recording nodeId→detectionId | relative — must work with no server |
| none (tests, eval) | `null` → inline SVG data-URI placeholder | renders anywhere, needs no network |

`codegen` stays free of API/storage knowledge. The node→detection map is persisted on the
`CodeVersion` (§8.7 `metadata_json`), so an export built from an older immutable version
still crops the right regions.

## Class scope — an explicit decision

| Class | Treatment | Reasoning |
|---|---|---|
| `image` | **crop** | §15.5 names it. A large drawn picture region — the ink is the content. |
| `avatar` | **crop** | Same; a drawn portrait. Previously an equally-broken `<img>`. |
| `video` | **crop** | A drawn media frame. Now renders as `<img>` rather than an empty `<video>` with no `src`, which was invisible. |
| `logo` | **crop** | A hand-drawn wordmark is exactly what you want preserved; the literal text "LOGO" was itself a placeholder. The crop nests inside the existing anchor so link semantics survive, falling back to text when no crop exists. |
| `icon` | **symbolic** | 12–20px scribbles. A crop at that size is an illegible smudge, and these are usually affordances (chevron, magnifier) where meaning beats strokes. Now a visible bordered box — previously an empty `<span>` that rendered as nothing. |
| `social_icon` | **symbolic** | Same, more so: a recognisable glyph communicates far more than a blurry squiggle of a brand mark. Now a visible circle — previously an empty `<a>`. |
| `map` | **symbolic** | Already a styled CSS box; a widget placeholder a user replaces wholesale, not artwork to preserve. |

Everything else (`text`, `heading`, `button`, form controls, …) is text or CSS and has no
image to resolve.

## Crop mechanics

`apps/api/src/modules/crops/crop.service.ts`, shared by the preview route and the ZIP
builder so both emit byte-identical output.

- Normalized bbox → pixels using the asset's **stored** `width`/`height` (§8.4), not a
  re-probe, so the maths matches the coordinate space the detections were recorded in.
- 2% padding keeps strokes sitting right on the box edge.
- Regions under 8px in either dimension fall back to the placeholder.
- A crop that cannot be produced (missing source, degenerate box) falls back to the
  placeholder rather than failing the whole export.

## Known artifact of the current sample corpus

The five sample sketches are **annotated expectation renders** — they have coloured
detection boxes and confidence labels burned into the pixels. Crops therefore include
those overlays (you can see `hero_image 0.95` above the cropped character). That is a
property of this corpus, not a cropping defect; a clean sketch photo crops cleanly.
