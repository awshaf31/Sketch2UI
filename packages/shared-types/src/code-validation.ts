// Generated-code validation — plan §21.4 (code metrics).
//
// Extracted from scripts/src/evaluate.ts so the SAME checks run in three places:
//   - the §21 evaluation harness (where they started),
//   - backend, before persisting a hand-edited code version,
//   - frontend, for instant feedback before the user hits Save.
//
// Same reasoning as the split hash (Step 12) and the boundary geometry: one behaviour
// should have one implementation. A validator that disagrees with the metric it is named
// after would be worse than no validator.
//
// These are deliberately lightweight structural checks, not a full HTML5 parser. They
// catch the failures a hand-edit actually produces — an unclosed tag, a stray brace, a
// duplicated id — without pulling a parser into the browser bundle.

export type CodeIssueCode =
  | "HTML_UNBALANCED_TAG"
  | "HTML_UNCLOSED_TAG"
  | "CSS_UNBALANCED_BRACE"
  | "DUPLICATE_ID";

export interface CodeIssue {
  code: CodeIssueCode;
  message: string;
}

export interface CodeValidationResult {
  ok: boolean;
  htmlParses: boolean;
  cssParses: boolean;
  duplicateIds: string[];
  issues: CodeIssue[];
}

/** Void elements never need a closing tag. */
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;

/** Strip comments, <script> and <style> bodies — their contents are not markup. */
function stripNonMarkup(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "<script></script>")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "<style></style>");
}

function checkHtml(html: string): { parses: boolean; issues: CodeIssue[] } {
  const issues: CodeIssue[] = [];
  const source = stripNonMarkup(html);
  const stack: string[] = [];

  let match: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(source)) !== null) {
    const [, closing, rawName, selfClose] = match;
    const name = rawName.toLowerCase();
    if (name === "!doctype" || VOID_ELEMENTS.has(name) || selfClose === "/") continue;

    if (closing) {
      const open = stack.pop();
      if (open !== name) {
        issues.push({
          code: "HTML_UNBALANCED_TAG",
          message: open
            ? `Closing </${name}> does not match the open <${open}>.`
            : `Closing </${name}> has no matching opening tag.`,
        });
        return { parses: false, issues };
      }
    } else {
      stack.push(name);
    }
  }

  if (stack.length > 0) {
    issues.push({
      code: "HTML_UNCLOSED_TAG",
      message: `Unclosed tag${stack.length > 1 ? "s" : ""}: ${stack
        .slice(-5)
        .map((t) => `<${t}>`)
        .join(", ")}.`,
    });
    return { parses: false, issues };
  }

  return { parses: true, issues };
}

function checkCss(css: string): { parses: boolean; issues: CodeIssue[] } {
  // Ignore braces inside strings and comments so a content: "}" rule does not trip it.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""');

  let depth = 0;
  for (const ch of source) {
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth < 0) {
        return {
          parses: false,
          issues: [{ code: "CSS_UNBALANCED_BRACE", message: "A closing '}' has no matching '{'." }],
        };
      }
    }
  }

  if (depth !== 0) {
    return {
      parses: false,
      issues: [
        {
          code: "CSS_UNBALANCED_BRACE",
          message: `${depth} unclosed '{' — every rule needs a closing '}'.`,
        },
      ],
    };
  }

  return { parses: true, issues: [] };
}

function findDuplicateIds(html: string): string[] {
  const ids = [...html.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]);
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

/**
 * Validate a generated or hand-edited page. `ok` is false when the code must not be
 * persisted — a duplicate id makes the preview's DOM invalid, which is why it blocks
 * alongside outright parse failures (the §21.7 "usable preview" definition treats it
 * the same way).
 */
export function validateGeneratedCode(html: string, css: string): CodeValidationResult {
  const htmlResult = checkHtml(html);
  const cssResult = checkCss(css);
  const duplicateIds = findDuplicateIds(html);

  const issues = [...htmlResult.issues, ...cssResult.issues];
  if (duplicateIds.length > 0) {
    issues.push({
      code: "DUPLICATE_ID",
      message: `Duplicate element id${duplicateIds.length > 1 ? "s" : ""}: ${duplicateIds
        .slice(0, 5)
        .join(", ")}.`,
    });
  }

  return {
    ok: htmlResult.parses && cssResult.parses && duplicateIds.length === 0,
    htmlParses: htmlResult.parses,
    cssParses: cssResult.parses,
    duplicateIds,
    issues,
  };
}
