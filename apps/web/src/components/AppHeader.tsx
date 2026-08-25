import { Link, useNavigate } from "react-router-dom";
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

export function AppHeader({ className }: { className?: string }) {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className={cn("flex items-center justify-between border-b border-border bg-surface px-lg py-md", className)}>
      <Link to="/" className="flex items-center gap-xs text-text-primary transition-colors duration-fast hover:text-primary">
        <BrandMark className="text-primary" />
        <span className="text-lg font-semibold">Sketch2UI</span>
      </Link>
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
