import type { BBox } from "./detection.js";

// Semantic UI Intermediate Representation — plan section 12.
// This is the stable contract between the layout engine and the code generators.

export interface UINodeLayout {
  display?: "flex" | "grid" | "block";
  direction?: "row" | "column";
  columns?: number;
  gap?: number;
}

export interface UINode {
  id: string;
  type: string; // e.g. "header", "card", "button" — see taxonomy.ts
  role?: string;
  content?: string;
  /**
   * `alt` attribute for image/avatar/logo, populated by the content inspector. Kept
   * separate from `content` because a logo's visible label and its image alt text are
   * genuinely different strings — folding them together would let a text edit change
   * the alt or vice versa.
   */
  altText?: string;
  /**
   * `href` for link/logo, populated by the content inspector. The API validates the
   * scheme (no javascript:/data:) before this ever reaches the tree; html.ts escapes
   * it as an attribute value.
   */
  href?: string;
  bbox: BBox;
  style?: Record<string, string>;
  layout?: UINodeLayout;
  metadata?: Record<string, unknown>;
  sourceDetectionId?: string;
  children: UINode[];
}

export interface UIRoot {
  schemaVersion: "1.0";
  type: "page";
  name: string;
  viewport: {
    width: number;
    height: number;
  };
  layout?: UINodeLayout;
  children: UINode[];
}
