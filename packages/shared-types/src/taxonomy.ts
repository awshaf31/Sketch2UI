// UI component class taxonomy — plan section 33.
// Keep this list to reusable UI concepts; do not add one-off classes per sketch.

export const STRUCTURAL_CLASSES = [
  "page",
  "header",
  "section",
  "footer",
  "navbar",
  "sidebar",
  "form",
  "card",
  // Added when the external wireframe datasets were merged in: `table` is a reusable
  // UI concept, not a one-off. Modeled as a structural leaf for now — no per-row or
  // per-cell UI-IR node types.
  "table",
] as const;

export const CONTENT_CLASSES = [
  "logo",
  "heading",
  "text",
  "link",
  "image",
  "video",
  "icon",
  "avatar",
  // nav_item and carousel are absent from the section 33 lists but are part of the
  // Appendix K starter class set and the section 11 layout examples.
  "nav_item",
  "carousel",
] as const;

export const INTERACTION_CLASSES = [
  "button",
  "input",
  "textarea",
  "select",
  "menu_button",
  "search_box",
  "carousel_prev",
  "carousel_next",
  "carousel_indicator",
  // Added alongside `table` when the external wireframe datasets were merged in.
  "checkbox",
  "radio_button",
] as const;

export const REPEATED_CONTENT_CLASSES = [
  "card_title",
  "card_text",
  "card_button",
  "list",
  "list_item",
] as const;

export const SPECIAL_CLASSES = [
  "breadcrumb",
  "map",
  "social_icon",
  "newsletter",
  "testimonial",
  "divider",
] as const;

export const ALL_CLASSES = [
  ...STRUCTURAL_CLASSES,
  ...CONTENT_CLASSES,
  ...INTERACTION_CLASSES,
  ...REPEATED_CONTENT_CLASSES,
  ...SPECIAL_CLASSES,
] as const;

export type UIClassName = (typeof ALL_CLASSES)[number];

// Classes with strong structural/container meaning — plan section 11.4.
export const CONTAINER_CLASSES: ReadonlySet<string> = new Set([
  "page",
  "header",
  "section",
  "footer",
  "card",
  "form",
  "navbar",
  "sidebar",
  "list",
  "carousel",
  // Holds rows/cells conceptually, even though we do not model per-cell structure.
  "table",
]);

// Atomic components that generally become children of a container.
export const ATOMIC_CLASSES: ReadonlySet<string> = new Set([
  "text",
  "heading",
  "icon",
  "button",
  "image",
  "logo",
  "link",
  "avatar",
  "input",
  "textarea",
  "select",
  "card_title",
  "card_text",
  "card_button",
  "list_item",
  "nav_item",
  "divider",
  "checkbox",
  "radio_button",
]);

export function isContainerClass(className: string): boolean {
  return CONTAINER_CLASSES.has(className);
}
