# Sketch2UI Annotation Guide

Plan references: §22.2–22.5 (annotation guidelines), §9.5–9.6 (negatives, annotation
policy), §33 (taxonomy), §46 (documentation plan).

This is the authoritative labelling contract. Every label in `ml/dataset/` must follow
it. §9.6 is explicit: **do not change labelling rules from image to image.** If a rule
here turns out to be wrong, change it *here*, bump the dataset version, and re-label —
do not quietly deviate on one sketch.

The class list and its fixed ID order live in `ml/dataset/classes.txt`, generated from
`ALL_CLASSES` in `packages/shared-types/src/taxonomy.ts`. Class IDs are positional, so
that order is frozen — see `ml/dataset/README.md`.

---

## 1. The three global rules

These three decide most ambiguous cases. Read them before the per-class table.

### Rule A — the nested-child rule (the §22.5 policy decision)

§22.5 requires choosing **one** policy for container children and documenting it,
because labelling card children in some images but not others gives the model
inconsistent supervision. The decision for this project:

> **Label a nested atomic child whenever it is legible as its own element in the
> sketch. When the container's internals are not legible as separate elements, label
> only the container.**
>
> Labelling the container does **not** exempt you from labelling its children, and
> labelling children does **not** exempt you from labelling the container. When both
> are legible, **both** get boxes.

"Legible" means: a human reading the sketch can point at where that child starts and
ends. A card drawn as a rectangle with a squiggle inside is a `card` and nothing else —
the squiggle is not a legible `card_title`. A card drawn with a distinct image box, a
short title line, two body lines and a small button rectangle is five boxes:
`card`, `image`, `card_title`, `card_text`, `card_button`.

This rule applies identically to the other three container/child families:

| Container | Children to label when legible |
|---|---|
| `card` | `image`, `card_title`, `card_text`, `card_button` |
| `navbar` | `nav_item` (one box per item), `menu_button`, `search_box` |
| `form` | `input`, `textarea`, `select`, `button` |
| `list` | `list_item` (one box per item) |

Consistency check before exporting a sketch: if two cards on the *same page* are drawn
at the same level of detail, they must have the same number of child boxes. Differing
child counts on visually identical siblings is the specific failure §22.5 warns about.

### Rule B — the overlap rule

Nested boxes **overlap by design** and that is correct: a `card_title` box sits fully
inside its `card` box, which sits inside a `section`, which sits inside `page`. Do not
shrink a container to avoid overlapping its children, and do not shrink a child to sit
outside its parent.

What is *not* allowed:

- Two boxes of the **same class** overlapping by more than ~50% — that is a
  double-label of one object. Delete one.
- A box that extends beyond its semantic parent (a `nav_item` sticking out of the
  `navbar`). Tighten it.
- Sibling containers overlapping (`section` boxes bleeding into each other). Sections
  should tile the page, not overlap.

The dataset quality gate for extreme overlap is §22 Check 5 (Appendix U).

### Rule C — the page-boundary rule (negatives)

Only label what is **inside the drawn webpage boundary**. Everything outside it is an
explanatory annotation and must be left unlabelled — this is the whole point of §10 and
§9.5. Left unlabelled, these regions act as hard negatives and teach the model to
ignore them.

Never label:

- off-page notes ("this image remains static", "add more sections", "go to page 4");
- callout labels naming a section, and the leader lines/arrows pointing at it;
- arrows, brackets, braces;
- measurements and dimension marks;
- page numbers, titles written outside the page frame;
- decorative strokes, doodles, stray marks;
- notebook grid lines / ruled paper lines / paper edges and shadows.

The `page` class is the drawn page boundary itself. If no page frame is drawn, do not
invent one — omit `page` for that sketch rather than guessing its extent.

---

## 2. Global minimum size

A box smaller than **1% of the image's shorter side** in either dimension is below the
useful resolution for a tiny detector — either draw it more accurately or skip it.

At 1024px shorter side that is ~10px. Practical floor: **~12×12 px**, with four
deliberate exceptions that are legitimately tiny: `carousel_indicator`, `social_icon`,
`checkbox` and `radio_button`, which may go down to ~8×8 px.

Box tightness: the box is the **ink bounding box plus the element's drawn border**, with
no more than a few px of slack. Do not include the whitespace a designer left around an
element, and do not clip the element's own drawn frame.

---

## 3. Per-class reference

Classes are grouped as in `taxonomy.ts`. "ID" is the frozen class index used in label
files.

### Structural

| ID | Class | What counts | What does NOT count | Min size | Nested-child note |
|---|---|---|---|---|---|
| 0 | `page` | The drawn webpage frame — the outer rectangle bounding the whole mock page. One per page. | Paper edge; a `section` that happens to be full-width; anything if no frame is drawn. | 25% of image | Contains everything; overlaps all. |
| 1 | `header` | Top band of the page holding logo / title / top nav. | A `navbar` drawn as its own separate band *below* the header — that is `navbar`, not `header`. | 40×20 | Label `logo`, `heading`, `navbar`, `button` inside it when legible. |
| 2 | `section` | A horizontal content band of the page body. Also use for hero areas, feature rows, and content blocks. | `header`; `footer`; a `card` (a card is a bordered item *inside* a section). | 40×20 | Label its children per Rule A. |
| 3 | `footer` | Bottom band, typically links / contact / social / copyright. | The last content `section` when a distinct footer band also exists. | 40×20 | Label `list`, `link`, `social_icon`, `heading`, `text` inside. |
| 4 | `navbar` | A row/column of navigation destinations, drawn as a group. | A single stray link (that is `link`); breadcrumbs (that is `breadcrumb`). | 30×12 | **Always** label each `nav_item` when items are individually legible (Rule A). |
| 5 | `sidebar` | A vertical column beside main content, holding secondary content. | A narrow `card`; a `list` that is merely tall. | 20×40 | Label its children per Rule A. |
| 6 | `form` | A group of one or more inputs plus its submit control, drawn as a unit. | A lone search field (that is `search_box`); a lone newsletter row (that is `newsletter`). | 30×20 | **Always** label `input` / `textarea` / `select` / `button` inside (Rule A). |
| 7 | `card` | A bordered, repeated content tile: image + title + text + optional action. | A plain `image` with no frame; a `section`; a bare bordered rectangle with no internal content (that is `image` if it reads as a placeholder). | 20×20 | See Rule A. Sibling cards must be labelled at equal depth. |
| 8 | `table` | A grid of tabular data: two or more rows crossed by two or more columns, drawn with ruled lines, optionally with a header row. Box the **whole grid including its header row** as one box. | A `list` (single column of repeated lines, no columns); a `card` grid (bordered tiles, not ruled cells); notebook/graph-paper ruling behind the sketch (Rule C); a two-column page *layout*. | 30×20 | **Structural leaf** — do **not** box rows, cells, or the header row separately. See the note below. |

> **`table` is deliberately a leaf.** Sketch2UI does not model per-row or per-cell
> structure, so there are no `table_row` / `table_cell` classes and the code generator
> emits a bare `<table>`. Boxing a table's rows and cells as separate detections would
> stack several differently-classed boxes over the same pixels, which Rule B forbids.
> If per-cell structure is ever needed, it gets added as a deliberate taxonomy change,
> not by improvising sub-boxes.

### Content

| ID | Class | What counts | What does NOT count | Min size | Nested-child note |
|---|---|---|---|---|---|
| 9 | `logo` | Brand mark and/or wordmark in header or footer. | Any `image`; a partner/client logo inside a logo wall — those are `image`. | 12×12 | Atomic. |
| 10 | `heading` | A prominent title line: page title, section title, hero headline. | Body copy (`text`); a card's own title (`card_title`). | 20×8 | Atomic. |
| 11 | `text` | Body copy: paragraphs, squiggle-lines standing for prose, taglines, captions. | A heading; a card's body copy (`card_text`); off-page notes (Rule C). | 20×8 | Atomic. |
| 12 | `link` | Inline textual navigation, often underlined or with a trailing arrow. | A `button` (bordered/filled control); a `nav_item` inside a navbar. | 15×8 | Atomic. |
| 13 | `image` | Picture placeholder: framed box, box with a cross/X, or a drawn picture. | `video` (has a play affordance); `avatar` (round, person); `map`; `logo`. | 15×15 | Atomic. |
| 14 | `video` | Media placeholder with a play affordance, or explicitly marked "video". | A plain `image` placeholder with no play marker. | 20×15 | Label a `button` drawn on top of it if legible. |
| 15 | `icon` | Small pictogram standing for a concept (check, tag, magnifier, arrows in a UI control). | `social_icon` (a named social network); `logo`; off-page arrows (Rule C). | 12×12 | Atomic. |
| 16 | `avatar` | Circular/rounded portrait representing a person. | `image`; `logo`. | 12×12 | Atomic. |
| 17 | `nav_item` | One destination inside a `navbar`. | A standalone `link` outside a navbar; a `button`. | 15×8 | Atomic. One box per item. |
| 18 | `carousel` | A slider region: media plus **at least one** prev/next affordance or indicator strip. The affordance is what makes it a carousel rather than a picture. Box the **whole region including the arrows**. | A static `image` (no affordance); a `card` row that merely repeats; a `table`. | 30×20 | **Always** label `carousel_prev` / `carousel_next` / `carousel_indicator` when drawn. **See §4.3 — extent ambiguity is the observed failure here.** |

### Interaction

| ID | Class | What counts | What does NOT count | Min size | Nested-child note |
|---|---|---|---|---|---|
| 19 | `button` | A bordered/filled action control with a label ("Buy now", "Search"). | `link` (bare text); `card_button` (a button *inside* a card); `menu_button`. | 15×10 | Atomic. |
| 20 | `input` | Single-line entry field, usually an empty box with placeholder text. | `search_box`; `textarea`; `select`; a bare rectangle with no entry affordance. | 20×8 | Atomic. |
| 21 | `textarea` | Multi-line entry field — a taller entry box. | `input`; `card`. | 20×20 | Atomic. |
| 22 | `select` | An entry box carrying a **chevron / caret / small triangle**, usually at its right edge. The marker is the whole distinction — box the field **including** it. | `input` (rectangle, no marker); `textarea` (tall, no marker); `button` (contains an action verb); `search_box` (magnifier, not chevron). | 20×8 | Atomic. **See §4.1 — this is the single most-confused class in the model.** |
| 23 | `menu_button` | Hamburger / "≡" menu toggle. | `icon`; `button`. | 12×12 | Atomic. |
| 24 | `search_box` | Search entry field, usually with a magnifier. | A lone magnifier with no field (that is `icon`); `input`. | 20×8 | Label the magnifier `icon` separately only if drawn clearly outside the field's box. |
| 25 | `carousel_prev` | Previous-slide control (left chevron/arrow) belonging to a carousel. | A decorative or off-page arrow (Rule C); `icon`. | 10×10 | Atomic. |
| 26 | `carousel_next` | Next-slide control (right chevron/arrow) belonging to a carousel. | As above. | 10×10 | Atomic. |
| 27 | `carousel_indicator` | The dot strip showing slide position. Box the **strip as one box**, not each dot. | Individual dots as separate boxes; a bulleted `list`. | 8×8 | Atomic. |
| 28 | `checkbox` | A small square (empty, ticked, or crossed) used as a multi-select toggle. Box **only the square**, not its adjacent label text. | `radio_button` (round); a `list_item`'s bullet or check marker — a checked *list* is a `list`, not a row of checkboxes; a small square `image` placeholder; `icon`. | 8×8 | Atomic. Label the adjacent caption separately as `text` when legible. |
| 29 | `radio_button` | A small circle (empty or filled/dotted) used as a single-select toggle. Box **ONLY the circle** — never the circle plus its caption. | `checkbox` (square); `carousel_indicator` (a strip of position dots, boxed as one); a round `avatar`; a bullet marker inside a `list_item`. | 8×8 | Atomic. Label the caption separately as `text`. **See §4.2 — caption-swallowing is the observed failure here.** |

> **`checkbox` vs `radio_button` vs `list` markers.** Shape decides between the first
> two: square is `checkbox`, round is `radio_button`. But a column of ticked lines that
> reads as *content* rather than *controls* is a `list` with `list_item`s — the marker is
> part of the item, not its own box. Ask whether a user would click it to change a form
> value; if not, it is list content.

### Repeated content

| ID | Class | What counts | What does NOT count | Min size | Nested-child note |
|---|---|---|---|---|---|
| 30 | `card_title` | The title line **inside a card**. | A section `heading` outside a card. | 15×8 | Requires an enclosing `card`. |
| 31 | `card_text` | Body copy **inside a card**. | `text` outside a card. | 15×8 | Requires an enclosing `card`. |
| 32 | `card_button` | An action control **inside a card**. | `button` outside a card. | 15×8 | Requires an enclosing `card`. |
| 33 | `list` | A group of bulleted/checked/dashed repeated lines. | A `navbar`; stacked `text` paragraphs with no bullet/check markers. | 20×20 | **Always** label each `list_item` when items are individually legible (Rule A). |
| 34 | `list_item` | One row of a list, including its bullet/check marker. | A `nav_item`; a `text` paragraph. | 15×8 | Requires an enclosing `list`. |

> The `card_*` classes exist **only** inside a `card`. If you find yourself labelling a
> `card_title` with no `card` around it, the right labels are `heading`/`text`/`button`.

### Special

| ID | Class | What counts | What does NOT count | Min size | Nested-child note |
|---|---|---|---|---|---|
| 35 | `breadcrumb` | A trail of ancestor links, usually separated by `/` or `>`. | `navbar`; `link`. | 20×8 | Atomic — do not label its segments as `nav_item`. |
| 36 | `map` | A map placeholder — outline with pins/markers. | `image`. | 20×20 | Atomic. |
| 37 | `social_icon` | A single identifiable social network mark (f, bird, camera, ▶). | Generic `icon`; a whole social row — label **each mark separately**. | 8×8 | Atomic, one box per mark. |
| 38 | `newsletter` | An email-capture row: email field + subscribe control, drawn as a unit. | A general `form`; a lone `input`. | 30×15 | Label the `input` and `button` inside it (Rule A). |
| 39 | `testimonial` | A quoted customer statement block, often with quote marks and/or avatar. | `card`; `text`. | 30×15 | Label `avatar` / `text` / `icon` inside when legible. |
| 40 | `divider` | A horizontal rule or wave separating sections. | A section border; an underline under a heading; a table line (Rule C). | 20×2 | Atomic. Exempt from the min-height floor (it is intentionally thin). |

---

## 4. Ambiguity tie-breakers

§9.3 warns that a hand-drawn "small rectangle" plausibly reads as `input`, `button`,
`image`, `card` or `select`. Resolve in this order:

1. **Content beats shape.** A rectangle containing an action verb ("Search", "Login") is
   a `button`. Containing placeholder/greyed prompt text ("Enter your email") it is an
   `input`. Containing an X/cross or a drawing it is an `image`.
2. **Affordance beats content.** A chevron makes it a `select`. A magnifier makes it a
   `search_box`. A play marker makes it a `video`.
3. **Context beats both.** Inside a `card`, a button is `card_button`. Inside a
   `navbar`, a text destination is `nav_item`. Inside a `form`, an entry box is `input`.
4. **Still unsure?** Prefer the **more general** class (`image` over `card`, `text` over
   `heading`, `button` over `card_button`) and note the sketch in the dataset review
   log. §9.3: a smaller, cleaner class set beats a large confused one.

Do **not** invent a class to resolve an ambiguity. `taxonomy.ts` is the closed
vocabulary; §33 explicitly forbids one-off classes like `hero_heading_1` or
`left_text`. If a genuinely new reusable UI concept appears repeatedly across sketches,
add it to `taxonomy.ts` in the semantically correct group, regenerate `classes.txt`,
**re-export every existing label file**, and bump the dataset version.

Adding a class mid-list renumbers every class after it, which silently invalidates
label files written under the old numbering. Appending at the very end of `ALL_CLASSES`
avoids that, but forces a class into the wrong semantic group. This project prefers the
correct group and pays the re-export cost — the exporter's drift guard makes the
required re-export impossible to forget. `table`, `checkbox` and `radio_button` were
added this way.

### Known aliases

Wireframes and earlier reference renders use names outside the taxonomy. Map them:

| Seen as | Label as |
|---|---|
| `hero_section`, `content_block`, `cards_row`, `portfolio_row`, `logo_cloud`, `footer_column` | `section` |
| `hero_text`, `tagline` | `text` |
| `hero_image`, `image_placeholder` | `image` |
| `section_heading` | `heading` |
| `nav_menu` | `navbar` |
| `menu_icon` | `menu_button` |
| `search_icon` | `icon` (or fold into `search_box` if it sits in the field) |
| `video_thumbnail` | `video` |
| `portfolio_item` | `card` |
| `social_icons` (a row) | one `social_icon` per mark |
| `counter`, `date` | `text` (no taxonomy class; do not invent one) |
| `label` (off-page callout naming a section) | **do not label** — Rule C |

---

## 4b. The three hardest classes — deep dive

These three carry the model's worst measured accuracy (test AP@0.5 **0.36–0.54**, see
`ml/models/ui-detector/v1.0.0/README.md`). §22.5's warning about inconsistent labelling
bites hardest here: they are drawn ambiguously *and* labelled inconsistently, so every
new annotation either helps a lot or actively poisons the class.

The guidance below is derived from the **actual test-split confusion matrix**, not from
intuition about what might be confusing.

### 4b.1 `select` — AP 0.364, only 1 of 16 correct

What it is actually predicted as:

| predicted | share |
|---|---:|
| `textarea` | 37.5% |
| `input` | 25.0% |
| `button` | 18.8% |
| `select` ✓ | 6.2% |

**81% of the error lands on the three other rectangle classes.** This is §9.3's
"a hand-drawn small rectangle is genuinely ambiguous" realised exactly.

**Decision order — apply strictly, top to bottom:**

1. **Is there a chevron, caret, triangle or "v" mark, usually right-aligned inside or
   just outside the box?** → `select`. Nothing else here has one.
2. Is there a magnifier? → `search_box`.
3. Does it contain an **action verb** ("Submit", "Search", "Login", "Buy")? → `button`.
4. Is it **taller than roughly 2.5× a single text line**, or does it carry a resize
   corner / multiple ruled lines? → `textarea`.
5. Otherwise, a plain single-line rectangle → `input`.

**Box the chevron INSIDE the select's box.** Cropping it off removes the only feature
that distinguishes the class, which is precisely how the model learned not to see it.

**Do not label a `select` you are inferring from context.** A rectangle next to a label
reading "Country" is an `input` unless a marker is actually drawn. Guessing from
semantics is how inconsistent supervision enters.

### 4b.2 `radio_button` — AP 0.499

| predicted | share |
|---|---:|
| `radio_button` ✓ | 37.5% |
| `heading` | 37.5% |
| `checkbox` | 25.0% |

Two distinct failures, with two distinct rules:

**Against `heading` (37.5%) — the caption-swallowing failure.** Radio buttons sit beside
their caption ("○ Express delivery"). The model is boxing the control *plus* its text as
one region, which then reads as a line of text. The fix is a hard rule:

> Box **only the circle**. The caption is a **separate** `text` box, or no box at all if
> it is not legible. A radio_button box should be roughly **square** and roughly as tall
> as one text line. If your box is more than ~3× wider than tall, you have swallowed the
> caption — redraw it.

**Against `checkbox` (25%) — shape.** Square → `checkbox`. Round → `radio_button`.
When a hand-drawn shape is genuinely ambiguous (a hasty rounded square), use the
**group's semantics**: mutually exclusive options (pick one country, one size) are radio
buttons; independently tickable options (accept terms, subscribe) are checkboxes. If
neither is determinable, prefer `checkbox` and note the sketch — consistency beats a
coin flip.

**Not a radio_button:** a bullet marker in a `list_item`; a dot in a
`carousel_indicator` strip (boxed as one strip, never per dot); a round `avatar`.

### 4b.3 `carousel` — AP 0.539, and 46% missed entirely

| predicted | share |
|---|---:|
| `background` (**missed**) | 46.2% |
| `textarea` | 23.1% |
| `carousel` ✓ | 23.1% |
| `navbar` | 7.7% |

A different failure mode from the other two: nearly half the time the model does not
fire at all. `carousel` is a **container whose extent is genuinely ambiguous** — it
overlaps the content it contains, so there is no single obvious rectangle.

**Extent rule — this is the fix:**

> The carousel box spans from the **left edge of the prev affordance** to the **right
> edge of the next affordance**, and vertically encloses the media **and** the indicator
> strip if one is drawn. When only indicators exist (no arrows), span the media plus the
> indicator strip.

**Requires an affordance.** A framed picture with no arrows and no dots is an `image`,
however slider-like it looks. Do not label intent.

**Also label the parts** (Rule A): `carousel_prev`, `carousel_next`,
`carousel_indicator`. The indicator strip is **one** box, never one per dot.

**Not a carousel:** a row of repeated `card`s (that is a card row — the cards get boxed
individually and the layout engine groups them); a `table`; a single static `image`.

### 4b.4 If you are drawing new sketches for these classes

The most valuable thing you can draw is **contrast within one sketch**: put a `select`,
an `input`, a `textarea` and a `button` side by side, at similar sizes, so the chevron is
the only difference. Same for a row of `checkbox` beside a row of `radio_button`. That
forces the distinguishing feature to carry the signal instead of size or position.

Vary what §9.4 asks for — pen thickness, paper, lighting, angle, handwriting — and draw
each class at more than one size.

## 5. Per-sketch workflow

Follows §22.1.

1. **Review** the sketch full-size. Identify the page boundary first.
2. **Label the frame**: `page`, then the top-level bands (`header`, `section`s,
   `footer`) so every part of the page is covered by exactly one band.
3. **Label containers** inside each band (`card`, `form`, `navbar`, `list`, `carousel`).
4. **Label atomic children** per Rule A, container by container, so sibling containers
   get equal treatment.
5. **Sweep for negatives**: confirm nothing outside the page frame got a box (Rule C).
6. **Validate**: run the dataset checks (Appendix U) — no invalid class, no degenerate
   or out-of-range box, no same-class >50% overlap, no orphan `card_*`/`list_item`/
   `nav_item` without its parent.
7. **Export** with `npm run export:dataset`, then quality-check the printed per-class
   counts.

The labelling tool is the existing Sketch2UI annotation canvas in `apps/web` — drawing a
box and picking a taxonomy class there produces exactly the `Detection` records the
exporter consumes. There is no separate labelling tool to install.

---

## 6. What this guide does not cover yet

- **Multi-page sketches** (two page frames on one photo). Current rule: label both
  `page` boxes; the layout engine already treats `page` as a container. Revisit if
  multi-page sketches become common.
- **Perspective-distorted photos.** Label in the image's own coordinate frame; the
  preprocessing step (§Appendix S) rectifies before training.
- **`contact_form`**, listed in §9.2 but deliberately absent from `taxonomy.ts` — use
  `form`. Revisit only if contact forms need to be distinguished from other forms.
