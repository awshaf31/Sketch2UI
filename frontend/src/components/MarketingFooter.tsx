import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark.js";
import { useAuth } from "../context/AuthContext.js";

// SaaS phase S3 — deliberately minimal. Only links to routes that actually exist (the "do
// not invent features" constraint) — no /about or /contact, since there is no real
// company/support content to put there yet.

export function MarketingFooter() {
  const { status } = useAuth();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-lg px-lg py-2xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-xs text-text-secondary">
          <BrandMark className="text-text-muted" />
          <span className="text-sm">Sketch2UI</span>
        </div>
        <nav className="flex flex-wrap items-center gap-lg" aria-label="Footer">
          <Link to="/#features" className="text-sm text-text-muted transition-colors duration-fast hover:text-text-primary">
            Features
          </Link>
          <Link
            to="/#how-it-works"
            className="text-sm text-text-muted transition-colors duration-fast hover:text-text-primary"
          >
            How it works
          </Link>
          <Link to="/pricing" className="text-sm text-text-muted transition-colors duration-fast hover:text-text-primary">
            Pricing
          </Link>
          <Link
            to={status === "authenticated" ? "/app" : "/login"}
            className="text-sm text-text-muted transition-colors duration-fast hover:text-text-primary"
          >
            {status === "authenticated" ? "Open App" : "Log in"}
          </Link>
        </nav>
        <p className="text-xs text-text-muted">© 2026 Sketch2UI</p>
      </div>
    </footer>
  );
}
