import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrandMark } from "./BrandMark.js";
import { Button } from "./Button.js";
import { cn } from "./cn.js";
import { useAuth } from "../context/AuthContext.js";

// docs/frontend/dashboard-design.md — "Top navigation / brand area". Built this phase
// but NOT mounted anywhere yet: see docs/frontend/frontend-implementation-roadmap.md's
// Phase 2B result for why — mounting it above both routes today would either duplicate
// Dashboard's own "Sketch2UI" H1 or push ProjectWorkspace's h-screen layout past the
// viewport. It's wired in by Phase 2C (Dashboard) and Phase 2D (Workspace shell), each
// of which already owns edits to the page that needs it.
//
// Phase D1 — also renders the current user + logout when authenticated. Login/
// Register mount this same header while status is "unauthenticated", so the menu
// simply doesn't render there.
//
// SaaS phase S4 — the brief's app-shell spec calls for a persistent nav (Dashboard/
// Projects/Templates) plus a user profile menu (Account/Logout). Adapted rather than
// copied literally: "Dashboard" and "Projects" are the same screen in this app (there
// is no separate route), so there's one "Projects" link, not two; "Templates" is
// skipped (not implemented, per the brief's own "only if actually implemented" rule).
// The "profile/menu" is flat inline controls (email · Account · Log out), not a new
// dropdown-menu primitive — the app has no such component today, and inventing one
// (focus trap, outside-click, Escape-to-close) for a two-item menu was judged more
// risk than a persistent shell needs on its first pass.

const NAV_LINKS = [
  { to: "/app", label: "Projects" },
  { to: "/app/account", label: "Account" },
] as const;

export function AppHeader({ className }: { className?: string }) {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className={cn("flex items-center justify-between border-b border-border bg-surface px-lg py-md", className)}>
      <div className="flex items-center gap-xl">
        <Link
          to={status === "authenticated" ? "/app" : "/"}
          className="flex items-center gap-xs text-text-primary transition-colors duration-fast hover:text-primary"
        >
          <BrandMark className="text-primary" />
          <span className="text-lg font-semibold">Sketch2UI</span>
        </Link>
        {status === "authenticated" && (
          <nav className="flex items-center gap-lg" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "text-sm font-medium transition-colors duration-fast",
                  location.pathname === link.to
                    ? "text-primary"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
      {status === "authenticated" && user && (
        <div className="flex items-center gap-sm">
          <span className="text-sm text-text-secondary">{user.email}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      )}
    </header>
  );
}
