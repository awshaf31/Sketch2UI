/** @type {import('tailwindcss').Config} */
// Design tokens (Phase 2A). Every value here is additive under `extend` — no top-level
// Tailwind theme key is replaced wholesale, so existing className strings elsewhere in the
// app keep working unchanged while new components (frontend/src/components/*) consume these
// named tokens.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutrals — surfaces, borders, text.
        // 2026-08-27 rebrand: replaced with the "Sketch2UI Color Palette" reference
        // (violet/indigo brand) supplied for the marketing + app-wide redesign. Same
        // token names as before on purpose — every existing className string
        // (Button/Card/Badge/etc.) keeps working unchanged, it just now resolves to
        // the new palette everywhere in the app.
        bg: "#FCFBFD",
        surface: "#FFFFFF",
        "surface-raised": "#FFFFFF",
        "surface-sunken": "#F5F3FA",
        border: "#E5E2EF",
        "border-strong": "#D2CDEA",
        "text-primary": "#081E55",
        "text-secondary": "#33436D",
        // Reference palette specified #687294, which is only 4.31:1 against the new
        // `surface-sunken` (#F5F3FA) — below WCAG AA's 4.5:1 floor for normal text,
        // the same failure mode as the earlier DEF-003 audit (see phase-log). Same
        // hue, darkened just enough to clear 4.5:1 against the harder of the two
        // backgrounds (4.60:1 vs surface-sunken, 5.04:1 vs surface) — verified via the
        // WCAG relative-luminance formula, not eyeballed.
        "text-muted": "#646E8E",
        // Reference palette addition — WCAG contrast doesn't apply to genuinely
        // disabled controls, so this is used only for disabled/inactive states, never
        // as a body-text color.
        "text-disabled": "#A2A9BD",
        "text-inverse": "#FFFFFF",

        // Brand & selection — brand color also serves as the canvas's structural-container
        // color, and selection is a dedicated hue.
        primary: "#5633F8",
        "primary-hover": "#4824E6",
        "primary-active": "#3918C7",
        "primary-subtle": "#EEEBFF",
        "primary-light": "#F4F2FF",
        accent: "#7567FF",
        "accent-soft": "#E7E4FF",
        lavender: "#BEB4FF",
        selection: "#f97316",
        "selection-subtle": "#fef1e6",
        focus: "#5633F8",

        // Detection / canvas state — structurally meaningful, carried forward from the
        // existing hardcoded hex values. Left untouched by the 2026-08-27 rebrand — these
        // encode real CV/annotation semantics, not brand decoration, and detection-model's
        // violet already reads naturally alongside the new palette.
        "detection-model": "#8b5cf6",
        "detection-manual": "#10b981",
        "page-boundary": "#e11d48",

        // Status. Reference palette specified Warning #B66A00 and Info #2878C8, but
        // neither clears 4.5:1 even against pure white (4.16:1 / 4.55:1) — the ceiling
        // for a "subtle" tinted background is always below the ceiling for white, so a
        // tinted badge using those exact values could fail AA for its small-text
        // usage (e.g. Pricing's "Not live" banner). Same hue, darkened to clear 4.5:1
        // vs white with headroom (4.70:1 / 4.75:1); Success/Error verified fine as
        // specified. All four "-subtle" backgrounds recomputed so their paired
        // foreground clears 4.5:1 on top of them.
        success: "#16805B",
        "success-subtle": "#F3F9F7",
        warning: "#A96300",
        "warning-subtle": "#FDFCFA",
        error: "#D93045",
        "error-subtle": "#FEFBFB",
        info: "#2775C3",
        "info-subtle": "#F9FBFD",
      },

      fontFamily: {
        // Overrides Tailwind's default `sans`/`mono` stacks — Tailwind's own preflight
        // sets `html { font-family: theme('fontFamily.sans') }`, so this alone changes
        // the app's base typography without touching any component file. Monaco sets
        // its own internal font stack independent of page CSS, and the sandboxed
        // preview iframe is a separate document — neither is affected.
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", '"SFMono-Regular"', "monospace"],
      },

      fontSize: {
        "2xs": ["11px", { lineHeight: "1.4" }],
        xs: ["12px", { lineHeight: "1.4" }],
        sm: ["13px", { lineHeight: "1.5" }],
        base: ["14px", { lineHeight: "1.5" }],
        md: ["16px", { lineHeight: "1.6" }],
        lg: ["18px", { lineHeight: "1.3" }],
        xl: ["22px", { lineHeight: "1.25" }],
        "2xl": ["28px", { lineHeight: "1.2" }],
      },

      spacing: {
        // Named aliases alongside Tailwind's default numeric scale — purely additive,
        // unlocks e.g. `p-md`/`gap-lg` for new components without touching `p-4` etc.
        "2xs": "2px",
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "48px",
        // Icon sizes reuse the same width/height scale.
        "icon-xs": "12px",
        "icon-sm": "14px",
        "icon-md": "16px",
        "icon-lg": "20px",
      },

      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "10px",
        // 2026-08-27 — additive: used for the marketing page's larger hero/CTA
        // panels only. Existing `lg` (10px) is untouched so Card and every other
        // component keeps its current radius.
        xl: "16px",
        pill: "999px",
      },

      boxShadow: {
        subtle: "0 1px 2px rgba(23,26,33,0.06)",
        elevated: "0 4px 16px -4px rgba(23,26,33,0.14), 0 1px 2px rgba(23,26,33,0.06)",
        modal: "0 16px 48px -12px rgba(23,26,33,0.30)",
      },

      transitionDuration: {
        fast: "100ms",
        normal: "180ms",
        slow: "280ms",
      },

      transitionTimingFunction: {
        decelerate: "cubic-bezier(0.2, 0, 0, 1)",
        accelerate: "cubic-bezier(0.4, 0, 0.8, 1)",
      },
    },
  },
  plugins: [],
};
