// Per-node content overrides — plan §17.3 Content group, Appendix Q state model.
//
// Text, alt text, and href are stored on the Project map (keyed on detection uuid —
// same stability reasoning as styleOverrides in project.ts), applied by codegen so
// the generated HTML emits the user-edited value instead of the placeholder.

export type ContentState =
  | "known"       // reserved for a future OCR/import flow that supplies a "real" value
  | "unknown"     // no override; codegen falls back to DEFAULT_CONTENT (Appendix Q "Heading")
  | "user-edited";

export interface ContentOverride {
  text?: string;
  altText?: string;
  href?: string;
  contentState: ContentState;
}

/**
 * Which content fields make sense for which UI classes — plan Appendix P mapping.
 * The API validator refuses to store a field the class does not accept (a text
 * override on a card container is a 400, not a silently-ignored no-op), AND the
 * codegen applier double-checks the same table before writing to the node, so a
 * stale override left behind by a detection-class change never leaks into the output.
 *
 * Keep this table small and explicit rather than "any class with a text default":
 * link/logo need href because they navigate, image/avatar/logo need alt for
 * accessibility, and text/heading/link have prose that a user actually authors. A
 * card_button or a nav_item has text too but the plan reserves this feature for the
 * six classes above.
 */
export type ContentField = "text" | "altText" | "href";

export const CONTENT_APPLICABILITY: Record<string, ReadonlyArray<ContentField>> = {
  text: ["text"],
  heading: ["text"],
  link: ["text", "href"],
  image: ["altText"],
  avatar: ["altText"],
  logo: ["altText", "href"],
};

export function contentFieldsFor(className: string): ReadonlyArray<ContentField> {
  return CONTENT_APPLICABILITY[className] ?? [];
}
