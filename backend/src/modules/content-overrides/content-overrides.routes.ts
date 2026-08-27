import { Router } from "express";
import type { ContentOverride } from "@sketch2ui/shared-types";
import { contentFieldsFor } from "@sketch2ui/shared-types";
import { sendError } from "../../middleware/apiError.js";
import type { PageParams } from "../../types.js";
import { getRepositories } from "../../repositories/index.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";
import { requirePageInProject } from "../../middleware/requirePageInProject.js";

// Per-node content overrides — plan §17.3 Content group, Appendix Q.
//
// Mirrors style-overrides.routes.ts one-for-one: keyed on detection uuid, stored via
// ContentOverrideRepository, applied at generation time. The validation is stricter
// here because text and href reach the DOM as attribute values / text nodes, so any
// injection surface needs a hard boundary at the write, not only at render.

export const contentOverridesRouter = Router({ mergeParams: true });
contentOverridesRouter.use(requireProjectOwnership);
contentOverridesRouter.use(requirePageInProject);

interface OverrideParams extends PageParams {
  detectionId: string;
}

// Belt: reject `<`/`>` in prose before storage. Braces: escapeHtml also runs at render
// time (see html.ts's renderNode + extraAttrs). Storing raw is preferable to
// storing pre-escaped — one canonical form in the database, one escape at the boundary.
const HTML_METACHARS = /[<>]/;
const MAX_TEXT_LEN = 500;
const MAX_HREF_LEN = 2048;

// Allowlist of URL schemes an inspector-authored href may use. Anything with a scheme
// not in this set is refused so `javascript:`, `data:`, `vbscript:`, and future
// exotic schemes cannot reach an `href` attribute.
const HREF_ALLOWED_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/**
 * True when the href is a bare fragment/relative path, or an absolute URL with an
 * allowlisted scheme. `#foo`, `/foo`, `./foo`, `../foo`, `foo/bar` are relative;
 * `https://…` etc pass through the URL parser to catch malformed URLs.
 *
 * SECURITY (QA audit, DEF-001): the scheme-detection regex below only recognizes an
 * unbroken run of letters/digits before `:` as a scheme. A tab/newline/CR/leading-space
 * embedded in the scheme (e.g. `"java\nscript:alert(1)"`) broke that match, so the "no
 * scheme found → treat as a relative path → allow" branch fired instead of ever reaching
 * the URL-parser check below it. Browsers strip exactly those characters from a URL during
 * parsing regardless of position (WHATWG URL spec), so the stored href still resolved to
 * `javascript:alert(1)` on click — a confirmed stored-XSS bypass of this allowlist.
 * Legitimate URLs never contain a literal embedded whitespace/control character (a real
 * space would be percent-encoded), so rejecting any href containing one, before the scheme
 * regex ever runs, closes the bypass without narrowing any real use case.
 */
const HREF_UNSAFE_CHARS = /[\s\x00-\x1f]/;

function isSafeHref(raw: string): boolean {
  if (raw.length === 0 || raw.length > MAX_HREF_LEN) return false;
  if (HREF_UNSAFE_CHARS.test(raw)) return false;
  if (raw.startsWith("#") || raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")) return true;
  // No scheme separator at all → treat as a relative path segment.
  if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(raw)) return true;
  try {
    const url = new URL(raw);
    const scheme = url.protocol.replace(/:$/, "").toLowerCase();
    return HREF_ALLOWED_SCHEMES.has(scheme);
  } catch {
    return false;
  }
}

function validateProseValue(prop: string, raw: unknown): string | { error: string } {
  if (typeof raw !== "string") return { error: `${prop} must be a string.` };
  if (raw.length > MAX_TEXT_LEN) return { error: `${prop} must be ${MAX_TEXT_LEN} characters or fewer.` };
  if (HTML_METACHARS.test(raw)) {
    return { error: `${prop} may not contain '<' or '>'.` };
  }
  return raw;
}

// GET /api/projects/:id/pages/:pageId/content-overrides — full map for the page.
contentOverridesRouter.get<PageParams>(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getRepositories().contentOverrides.mapForPage(req.params.pageId));
  })
);

// PUT /api/projects/:id/pages/:pageId/content-overrides/:detectionId — upsert.
// Body: { text?, altText?, href? } — contentState is server-controlled, always
// "user-edited" whenever this endpoint stores anything. An empty write (all fields
// blank or absent) is a delete, matching the style-overrides Reset flow.
contentOverridesRouter.put<OverrideParams>(
  "/:detectionId",
  asyncHandler(async (req, res) => {
    const detection = await getRepositories().detections.findInPage(req.params.pageId, req.params.detectionId);
    if (!detection) return sendError(res, 404, "NOT_FOUND", "Detection not found on this page.");

    const applicable = new Set(contentFieldsFor(detection.className));
    const body = (req.body ?? {}) as Record<string, unknown>;

    const cleaned: ContentOverride = { contentState: "user-edited" };
    for (const [prop, value] of Object.entries(body)) {
      if (prop === "contentState") continue; // server-controlled; ignore any client value
      if (prop !== "text" && prop !== "altText" && prop !== "href") {
        return sendError(res, 400, "VALIDATION_FAILED", `Unknown content field: ${prop}`);
      }
      // Applicability check: a text override on a card container, an href on a heading,
      // etc. — refused so an unsupported combination cannot silently persist and then
      // be surprising to the next reader. See CONTENT_APPLICABILITY in shared-types.
      if (!applicable.has(prop)) {
        return sendError(
          res,
          400,
          "VALIDATION_FAILED",
          `Content field '${prop}' does not apply to a '${detection.className}' — accepts: ${[...applicable].join(", ") || "none"}.`
        );
      }
      // Empty string clears the field within an otherwise-present record; treated the
      // same as a missing key.
      if (value === "" || value === null || value === undefined) continue;

      if (prop === "href") {
        if (typeof value !== "string") {
          return sendError(res, 400, "VALIDATION_FAILED", "href must be a string.");
        }
        if (!isSafeHref(value)) {
          return sendError(res, 400, "VALIDATION_FAILED", "href must be a relative path or http(s)/mailto/tel URL.");
        }
        cleaned.href = value;
      } else {
        const validated = validateProseValue(prop, value);
        if (typeof validated !== "string") {
          return sendError(res, 400, "VALIDATION_FAILED", validated.error);
        }
        if (prop === "text") cleaned.text = validated;
        if (prop === "altText") cleaned.altText = validated;
      }
    }

    // No text/altText/href set → the repository's own emptiness check deletes and
    // returns null, matching the pre-migration Reset behaviour.
    const stored = await getRepositories().contentOverrides.put(req.params.id, req.params.pageId, detection.id, cleaned);
    res.json({ detectionId: detection.id, override: stored });
  })
);

// DELETE /api/projects/:id/pages/:pageId/content-overrides/:detectionId — revert to
// placeholder.
contentOverridesRouter.delete<OverrideParams>(
  "/:detectionId",
  asyncHandler(async (req, res) => {
    await getRepositories().contentOverrides.remove(req.params.id, req.params.detectionId);
    res.status(204).send();
  })
);
