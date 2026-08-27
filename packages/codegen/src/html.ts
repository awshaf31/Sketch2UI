import type { UINode, UIRoot } from "@sketch2ui/shared-types";

/**
 * Resolves the real image source for a node that represents a drawn region.
 *
 * Returns a src string, or `null` to fall back to the symbolic placeholder.
 *
 * This exists so ONE generator serves two very different consumers without forking
 * (plan §15.5 "original extracted image crops"):
 *   - live preview passes a resolver returning API crop URLs, because the iframe runs
 *     in a browser with the API reachable;
 *   - export passes one returning relative paths like `./assets/<id>.png`, because the
 *     ZIP is opened over file:// with no server, and writes matching bytes into the ZIP.
 *
 * codegen stays free of any API/storage knowledge — the caller supplies the policy.
 */
export type AssetResolver = (node: UINode) => string | null;

export interface GenerateHTMLOptions {
  resolveAsset?: AssetResolver;
}

// HTML generation engine — plan section 13. Semantic tags over absolute-positioned divs,
// per-type renderers (NodeRenderer pattern, section 13.5), stable ids and "ui-" prefixed classes.

const TAG_BY_TYPE: Record<string, string> = {
  page: "main",
  group: "div", // synthetic wrapper for repeated siblings — see layout.ts groupRepeatedSiblings
  header: "header",
  section: "section",
  footer: "footer",
  navbar: "nav",
  nav_item: "a",
  carousel: "div",
  sidebar: "aside",
  form: "form",
  card: "article",
  table: "table",
  heading: "h2",
  text: "p",
  link: "a",
  image: "img",
  video: "img",
  icon: "span",
  avatar: "img",
  logo: "a",
  button: "button",
  input: "input",
  textarea: "textarea",
  select: "select",
  menu_button: "button",
  search_box: "input",
  checkbox: "input",
  radio_button: "input",
  carousel_prev: "button",
  carousel_next: "button",
  carousel_indicator: "span",
  card_title: "h3",
  card_text: "p",
  card_button: "button",
  list: "ul",
  list_item: "li",
  breadcrumb: "nav",
  map: "div",
  social_icon: "a",
  newsletter: "form",
  testimonial: "blockquote",
  divider: "hr",
};

const DEFAULT_CONTENT: Record<string, string> = {
  heading: "Heading",
  text: "Your generated description goes here.",
  card_title: "Card title",
  card_text: "Description.",
  button: "Button",
  card_button: "View details",
  link: "Link",
  nav_item: "Nav item",
  logo: "LOGO",
  list_item: "List item",
  testimonial: "Testimonial quote goes here.",
};

const VOID_TAGS = new Set(["img", "input", "hr"]);

/**
 * Classes rendered from a REAL crop of the source sketch when a resolver supplies one.
 *
 * Scope decision (documented deliberately):
 *   image, avatar, video, logo  -> cropped. These are substantial drawn regions where
 *     the sketch's own marks are the content: a picture box, a portrait, a media frame,
 *     a hand-drawn wordmark. Showing the real ink is strictly more faithful than a
 *     generic box or the literal text "LOGO".
 *   icon, social_icon           -> stay SYMBOLIC. These are 12-20px scribbles; a crop at
 *     that size is an illegible smudge, and for social marks a recognisable glyph
 *     communicates far more than a blurry squiggle. Their meaning matters more than
 *     their strokes.
 *   map                         -> stays a styled CSS box; it is a widget placeholder a
 *     user replaces wholesale, not artwork to preserve.
 */
const CROPPABLE_TYPES = new Set(["image", "avatar", "video", "logo"]);

/** Neutral inline placeholder used when no resolver supplies a real crop. Inline so it
 *  works over file:// and inside a sandboxed srcdoc iframe with no network at all. */
const PLACEHOLDER_DATA_URI =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100">' +
      '<rect width="160" height="100" fill="#e9ecef" stroke="#adb5bd" stroke-width="2"/>' +
      '<path d="M2 2 L158 98 M158 2 L2 98" stroke="#ced4da" stroke-width="2" fill="none"/>' +
      "</svg>"
  );

function toClassName(type: string): string {
  return `ui-${type.replace(/_/g, "-")}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function indent(depth: number): string {
  return "  ".repeat(depth);
}

function extraAttrs(node: UINode, resolved: string | null): string {
  switch (node.type) {
    case "image":
    case "avatar":
    case "video": {
      // Real crop when the caller supplied one; otherwise an inline symbolic box that
      // still renders (the old `./assets/<id>.png` path resolved to nothing in both
      // the sandboxed preview iframe and a file:// export).
      // altText override wins over any auto default — that IS the point of the field.
      const alt =
        node.altText ?? node.content ?? (resolved ? "Sketch region" : "Image placeholder");
      return ` src="${resolved ?? PLACEHOLDER_DATA_URI}" alt="${escapeHtml(alt)}"`;
    }
    case "input":
      return ` type="text" placeholder="${escapeHtml(node.content ?? "")}" aria-label="${escapeHtml(node.content || node.type)}"`;
    case "search_box":
      return ` type="search" placeholder="Search" aria-label="Search"`;
    case "checkbox":
      return ` type="checkbox" aria-label="${escapeHtml(node.content || "Checkbox")}"`;
    case "radio_button":
      return ` type="radio" aria-label="${escapeHtml(node.content || "Radio button")}"`;
    case "textarea":
      return ` aria-label="${escapeHtml(node.content || "Text area")}"`;
    case "logo":
      // Content applicability is alt + href for logo (Appendix P); text is not accepted.
      return ` href="${escapeHtml(node.href ?? "#")}"`;
    case "icon":
      // Symbolic by decision (see CROPPABLE_TYPES): a glyph reads better than a
      // sub-20px crop. Given real content so it is no longer an invisible empty span.
      return ` aria-hidden="true"`;
    case "link":
      return ` href="${escapeHtml(node.href ?? "#")}"`;
    case "nav_item":
    case "social_icon":
      // Not in the content-override applicability set; href stays hardcoded here
      // rather than becoming another user-input surface.
      return ` href="#"`;
    case "navbar":
    case "breadcrumb":
      return ` aria-label="${node.type === "breadcrumb" ? "Breadcrumb" : "Primary"}"`;
    case "menu_button":
      return ` aria-label="Menu"`;
    case "divider":
      return ` aria-hidden="true"`;
    default:
      return "";
  }
}

function renderNode(node: UINode, depth: number, resolve?: AssetResolver): string {
  const tag = TAG_BY_TYPE[node.type] ?? "div";
  const className = toClassName(node.type);
  const pad = indent(depth);
  const resolved =
    resolve && CROPPABLE_TYPES.has(node.type) ? resolve(node) : null;
  const attrs = ` id="${node.id}" class="${className}"${extraAttrs(node, resolved)}`;

  if (VOID_TAGS.has(tag)) {
    return `${pad}<${tag}${attrs} />`;
  }

  // A logo is an anchor, so its crop goes INSIDE it rather than replacing it — the link
  // semantics and the drawn wordmark both survive. Falls back to the "LOGO" text when
  // no crop is available. altText override wins over content and default.
  if (node.type === "logo" && resolved) {
    const logoAlt = node.altText ?? node.content ?? "Logo";
    return (
      `${pad}<a${attrs}>\n` +
      `${pad}  <img class="ui-logo-image" src="${resolved}" alt="${escapeHtml(logoAlt)}" />\n` +
      `${pad}</a>`
    );
  }

  const content = node.content ?? DEFAULT_CONTENT[node.type];
  const childrenHtml = node.children.map((child) => renderNode(child, depth + 1, resolve)).join("\n");

  const innerParts: string[] = [];
  if (content) innerParts.push(`${pad}  ${escapeHtml(content)}`);
  if (childrenHtml) innerParts.push(childrenHtml);

  if (innerParts.length === 0) {
    return `${pad}<${tag}${attrs}></${tag}>`;
  }

  return `${pad}<${tag}${attrs}>\n${innerParts.join("\n")}\n${pad}</${tag}>`;
}

export function generateHTML(root: UIRoot, options: GenerateHTMLOptions = {}): string {
  const body = root.children
    .map((child) => renderNode(child, 1, options.resolveAsset))
    .join("\n\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(root.name)}</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
${body}
</body>
</html>
`;
}
