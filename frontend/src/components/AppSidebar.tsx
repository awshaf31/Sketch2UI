import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrandMark } from "./BrandMark.js";
import { Button } from "./Button.js";
import { cn } from "./cn.js";
import { useAuth } from "../context/AuthContext.js";

// The persistent left rail that replaces AppHeader on /app and /app/account. AppHeader
// itself is NOT deleted: Login/Register still mount it while unauthenticated, and the
// workspace deliberately has neither (§4 — the editor keeps its full horizontal budget and
// escapes via its own toolbar's "← Projects" link).
//
// Composition is taken from the SaaS reference in uiux/ (brand at top, primary nav in
// the middle, user identity pinned to the bottom); nothing else about that reference
// is reproduced. Active row is `primary`, never `selection` — selection orange stays
// reserved for the canvas and the layer tree (§11.5).

const RAIL_WIDTH = "w-56"; // 224px per §5

function ProjectsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h2.2a1 1 0 0 1 .8.4l.7.9a1 1 0 0 0 .8.4h3.5A1.5 1.5 0 0 1 13 7.2v4.3A1.5 1.5 0 0 1 11.5 13h-8A1.5 1.5 0 0 1 2 11.5z" strokeLinejoin="round" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.2a5 5 0 0 1 10 0" strokeLinecap="round" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M8 2l4.5 1.8v3.6c0 2.6-1.8 5-4.5 5.8-2.7-.8-4.5-3.2-4.5-5.8V3.8z" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {open ? (
        <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
      ) : (
        <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" strokeLinecap="round" />
      )}
    </svg>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: () => JSX.Element;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/app", label: "Projects", icon: ProjectsIcon },
  { to: "/app/account", label: "Account", icon: AccountIcon },
];

const ADMIN_ITEM: NavItem = { to: "/admin", label: "Admin", icon: AdminIcon };

function NavRow({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-sm rounded-md px-sm py-xs text-sm font-medium transition-colors duration-fast",
        // §3.6 — the active row is not communicated by color alone: it also carries
        // aria-current (above) and a filled ground, so it survives a grayscale render.
        active
          ? "bg-primary-subtle text-primary"
          : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
      )}
    >
      <span className={cn("shrink-0", active ? "text-primary" : "text-text-muted")}>
        <Icon />
      </span>
      {item.label}
    </Link>
  );
}

/** Shared brand lockup — links to the public homepage from both layouts. */
function Brand() {
  return (
    <Link
      to="/"
      className="flex items-center gap-xs text-text-primary transition-colors duration-fast hover:text-primary"
    >
      <BrandMark className="text-primary" />
      <span className="text-lg font-semibold">Sketch2UI</span>
    </Link>
  );
}

export function AppSidebar({ mobile, open, onToggle }: { mobile?: boolean; open?: boolean; onToggle?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const items = user?.role === "admin" ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  // A route is active when it matches exactly, except /admin, which owns a whole
  // subtree and should stay lit on /admin/users etc.
  function isActive(to: string) {
    return to === "/admin" ? location.pathname.startsWith("/admin") : location.pathname === to;
  }

  const nav = (
    <nav aria-label="Primary" className="flex flex-col gap-2xs">
      {items.map((item) => (
        <NavRow key={item.to} item={item} active={isActive(item.to)} onNavigate={mobile ? onToggle : undefined} />
      ))}
    </nav>
  );

  const identity = user && (
    <div className="flex flex-col gap-xs">
      {/* title= carries the untruncated address; the visible row is clipped so a long
          email can never widen the rail (§9 — no horizontal overflow at any width). */}
      <span className="truncate text-xs text-text-muted" title={user.email}>
        {user.email}
      </span>
      <Button variant="ghost" size="sm" className="justify-start" onClick={handleLogout}>
        Log out
      </Button>
    </div>
  );

  // §5 — below 768px the rail becomes a top bar with a disclosure that reveals the
  // same list vertically. Deliberately not the app's Drawer: a two-to-three item menu
  // doesn't justify a focus trap, and this keeps the DOM order readable.
  if (mobile) {
    return (
      <div className="border-b border-border bg-surface">
        <div className="flex items-center justify-between gap-lg px-lg py-md">
          <Brand />
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!!open}
            aria-controls="app-sidebar-mobile-nav"
            aria-label={open ? "Close navigation" : "Open navigation"}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors duration-fast hover:bg-surface-sunken hover:text-text-primary"
          >
            <MenuIcon open={!!open} />
          </button>
        </div>
        {open && (
          <div id="app-sidebar-mobile-nav" className="flex flex-col gap-md border-t border-border px-lg py-md">
            {nav}
            <div className="border-t border-border pt-md">{identity}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    // Visual QA 2026-08-26: the rail stretched to the full document height, so on a
    // tall page (the Dashboard's create form + grid) the pinned identity block — and
    // with it "Log out" — sat below the fold. sticky+h-screen+self-start keeps the
    // whole rail in view while only `main` scrolls, which is what "pinned to the
    // bottom" is supposed to mean.
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col self-start border-r border-border bg-surface",
        RAIL_WIDTH
      )}
    >
      <div className="px-lg py-md">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto px-sm">{nav}</div>
      <div className="border-t border-border px-sm py-md">{identity}</div>
    </aside>
  );
}
