import { Link, useLocation } from "react-router-dom";
import { Badge } from "./Badge.js";
import { BrandMark } from "./BrandMark.js";
import { Button } from "./Button.js";
import { cn } from "./cn.js";
import { useAuth } from "../context/AuthContext.js";

// SaaS phase S6 — the admin shell's own layout/nav, deliberately separate from
// AppHeader (Phase 7 of the brief: "Admin dashboard ≠ user dashboard. Use separate
// layout/navigation."). Same design tokens as the rest of the app (still "Precision
// Studio," not a different visual system) but with its own nav list and an "Admin"
// badge so it's never confused with the user-facing header at a glance.
//
// NAV_LINKS grew one entry per admin phase (S7 Users, S8 Projects, S9 Jobs/Models/
// Training, S10 Audit Logs) — each phase added its own link in the same change that
// added the page it points to, same discipline as AppHeader's NAV_LINKS.

const NAV_LINKS = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/projects", label: "Projects" },
  { to: "/admin/jobs", label: "Jobs" },
  { to: "/admin/models", label: "Models" },
  { to: "/admin/training", label: "Training Data" },
  { to: "/admin/audit-logs", label: "Audit Logs" },
] as const;

export function AdminHeader() {
  const { user, logout } = useAuth();
  const location = useLocation();

  async function handleLogout() {
    await logout();
  }

  return (
    // SaaS phase S13 (visual QA) — at tablet width (768px) this row previously had no
    // overflow strategy at all: flex children just got squeezed until individual link
    // text wrapped mid-phrase ("Exit to" / "app", "Audit" / "Logs"), producing a
    // cramped, broken-looking two-line header. Seven nav links plus brand/badge/exit/
    // email/logout is genuinely more content than a phone-width screen can show on
    // one line — per the brief's own Phase 20 ("Admin: Desktop-first, responsive
    // enough for basic management," no mobile-editing promise), the fix is a single
    // horizontally-scrollable row (whitespace-nowrap + overflow-x-auto), not a
    // hamburger menu or a redesigned mobile nav.
    <header className="flex items-center justify-between gap-lg overflow-x-auto border-b border-border bg-surface px-lg py-md">
      <div className="flex shrink-0 items-center gap-xl whitespace-nowrap">
        <div className="flex items-center gap-sm">
          <Link to="/admin" className="flex items-center gap-xs text-text-primary transition-colors duration-fast hover:text-primary">
            <BrandMark className="text-primary" />
            <span className="text-lg font-semibold">Sketch2UI</span>
          </Link>
          <Badge tone="brand">Admin</Badge>
        </div>
        <nav className="flex items-center gap-lg" aria-label="Admin">
          {NAV_LINKS.map((link) => {
            // "/admin" itself needs an exact match (every other admin route also
            // starts with "/admin"); every other link is a subtree, so a prefix match
            // keeps it active on its own detail pages (e.g. /admin/projects/:id).
            const active =
              link.to === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "text-sm font-medium transition-colors duration-fast",
                  active ? "text-primary" : "text-text-secondary hover:text-text-primary"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-sm whitespace-nowrap">
        <Link to="/app" className="text-sm text-text-secondary transition-colors duration-fast hover:text-text-primary">
          Exit to app
        </Link>
        <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
        <span className="text-sm text-text-secondary">{user?.email}</span>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
