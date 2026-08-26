import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark.js";
import { LinkButton } from "./LinkButton.js";
import { useAuth } from "../context/AuthContext.js";

// SaaS phase S3 — public marketing site nav. Shared by Home and Pricing (the only two
// public routes today, per docs/execution/phase-log.md's Phase S3 entry). "Features"
// and "How it works" are same-page anchors on Home ("/#features", "/#how-it-works");
// linking to them from Pricing navigates to Home and Home's own hash-scroll effect
// (see Home.tsx) takes it from there. CTA follows the brief's Phase 1 rule: signed-out
// visitors get Log in / Start Building, signed-in visitors get one "Open App" link —
// never both a marketing CTA and an app CTA at once.

export function MarketingHeader() {
  const { status } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between px-lg py-md">
        <Link to="/" className="flex items-center gap-xs text-text-primary transition-colors duration-fast hover:text-primary">
          <BrandMark className="text-primary" />
          <span className="text-lg font-semibold">Sketch2UI</span>
        </Link>

        <nav className="hidden items-center gap-xl md:flex" aria-label="Primary">
          <Link to="/#features" className="text-sm text-text-secondary transition-colors duration-fast hover:text-text-primary">
            Features
          </Link>
          <Link
            to="/#how-it-works"
            className="text-sm text-text-secondary transition-colors duration-fast hover:text-text-primary"
          >
            How it works
          </Link>
          <Link to="/pricing" className="text-sm text-text-secondary transition-colors duration-fast hover:text-text-primary">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-sm">
          {status === "authenticated" ? (
            <LinkButton to="/app" variant="primary" size="md">
              Open App
            </LinkButton>
          ) : (
            <>
              <LinkButton to="/login" variant="ghost" size="md" className="hidden sm:inline-flex">
                Log in
              </LinkButton>
              <LinkButton to="/register" variant="primary" size="md">
                Start Building
              </LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
