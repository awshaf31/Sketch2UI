/** @type {import('tailwindcss').Config} */
// Design tokens per docs/frontend/design-tokens.md (Phase 2A). Every value here is
// additive under `extend` — no top-level Tailwind theme key is replaced wholesale, so
// existing className strings elsewhere in the app keep working unchanged while new
// components (apps/web/src/components/*) consume these named tokens.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutrals — surfaces, borders, text
        bg: "#f4f5f7",
        surface: "#ffffff",
        "surface-raised": "#ffffff",
        "surface-sunken": "#eef0f4",
        border: "#dde1e8",
        "border-strong": "#c3c9d4",
        "text-primary": "#171a21",
        "text-secondary": "#4b5262",
        "text-muted": "#848da0",
        "text-inverse": "#ffffff",

        // Brand & selection — see design-tokens.md for why brand blue also serves as
        // the canvas's structural-container color, and why selection is a dedicated hue.
        primary: "#2f5fdd",
        "primary-hover": "#2650bd",
        "primary-active": "#1f429a",
        "primary-subtle": "#e9eefc",
        selection: "#f97316",
        "selection-subtle": "#fef1e6",
        focus: "#2f5fdd",

        // Detection / canvas state — structurally meaningful, carried forward from the
        // existing hardcoded hex values (see docs/frontend/canvas-design.md). Not wired
        // into AnnotationCanvas/PageBoundaryOverlay yet (Phase 2E) — defined now so
        // later phases have a stable token to consume.
        "detection-model": "#8b5cf6",
        "detection-manual": "#10b981",
        "page-boundary": "#e11d48",

        // Status
        success: "#047857",
        "success-subtle": "#e4f5ee",
        warning: "#b45309",
        "warning-subtle": "#faf0dc",
        error: "#dc2626",
        "error-subtle": "#fdecec",
        info: "#0284c7",
        "info-subtle": "#e6f4fc",
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
