import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "./AppHeader.js";
import { BrandMark } from "./BrandMark.js";

// Mockup 4 (Auth direction, lowest priority). Replaces Login/Register's floating
// Card-on-tinted-field with two bordered panels + one hairline divider — the app's own
// "borders as structure, not shadow" vocabulary, applied here instead of imported SaaS
// chrome. AppHeader (top nav) is unchanged; only what used to wrap the Card is new. Below
// 640px the left panel is never rendered (not hidden post-stack) — Sketch2UI branding still
// comes from AppHeader at every width, so nothing is lost by dropping it.

function SketchToUIGraphic() {
  return (
    <svg viewBox="0 0 280 100" width="100%" height="auto" aria-hidden="true" className="max-w-[260px]">
      {/* Rough "sketch" rectangle — a hand-jittered path, dashed, in the muted
          border-strong token (the same "not yet real" visual language a draft
          detection box uses elsewhere in the app). */}
      <path
        d="M4,6 L74,4 L76,70 L2,74 Z"
        fill="none"
        strokeWidth={1.5}
        strokeDasharray="3 3"
        className="stroke-border-strong"
      />
      <path d="M14,24 L62,20" strokeWidth={1.5} className="stroke-border-strong" strokeLinecap="round" />
      <path d="M14,38 L54,36" strokeWidth={1.5} className="stroke-border-strong" strokeLinecap="round" />
      <path d="M14,52 L46,54" strokeWidth={1.5} className="stroke-border-strong" strokeLinecap="round" />

      {/* Arrow */}
      <line x1={92} y1={40} x2={148} y2={40} strokeWidth={1.5} className="stroke-primary" />
      <path d="M140,32 L150,40 L140,48" fill="none" strokeWidth={1.5} className="stroke-primary" strokeLinecap="round" strokeLinejoin="round" />

      {/* Crisp "generated UI" rectangle — solid border, a header bar and two content
          lines, no photo/illustration. */}
      <rect x={166} y={4} width={110} height={70} strokeWidth={1.5} className="stroke-border fill-surface" />
      <rect x={166} y={4} width={110} height={16} className="fill-primary-subtle" />
      <line x1={176} y1={34} x2={266} y2={34} strokeWidth={1.5} className="stroke-border-strong" strokeLinecap="round" />
      <line x1={176} y1={46} x2={250} y2={46} strokeWidth={1.5} className="stroke-border-strong" strokeLinecap="round" />
      <rect x={176} y={56} width={40} height={10} rx={2} className="fill-primary" />
    </svg>
  );
}

export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <AppHeader />
      <div className="flex flex-1 items-center justify-center px-lg py-3xl">
        <div className="flex w-full max-w-[860px] overflow-hidden rounded-lg border border-border bg-surface">
          <div className="hidden w-[420px] shrink-0 flex-col justify-center gap-xl border-r border-border bg-surface-sunken p-2xl sm:flex">
            <Link
              to="/"
              className="flex items-center gap-xs text-text-primary transition-colors duration-fast hover:text-primary"
            >
              <BrandMark className="h-7 w-7 text-primary" />
              <span className="text-xl font-semibold">Sketch2UI</span>
            </Link>
            <SketchToUIGraphic />
          </div>
          <div className="w-full p-2xl sm:w-auto sm:flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
