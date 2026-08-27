import { useState } from "react";
import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar.js";
import { useMediaQuery } from "./useMediaQuery.js";
import { cn } from "./cn.js";

// The app shell — the frame every authenticated non-editor page renders inside. It owns
// exactly two things: where the rail goes, and how wide the content column is. Page content
// is untouched by it.
//
// Uses the same useMediaQuery breakpoint tiers as WorkspaceBody, so there's no drift
// between what this and CSS breakpoint classes elsewhere consider "mobile".

interface AppShellProps {
  children: ReactNode;
  /** Max width of the content column. Dashboard is wider than Account. */
  maxWidth?: string;
}

export function AppShell({ children, maxWidth = "max-w-[880px]" }: AppShellProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [navOpen, setNavOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <AppSidebar mobile open={navOpen} onToggle={() => setNavOpen((v) => !v)} />
        <main className={cn("mx-auto w-full px-lg pb-3xl pt-xl", maxWidth)}>{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <AppSidebar />
      {/* min-w-0 so a wide child (a long table, a code block) scrolls inside the
          content column instead of pushing the rail off-screen (§9). */}
      <main className="min-w-0 flex-1 overflow-x-auto">
        <div className={cn("mx-auto w-full px-xl pb-3xl pt-2xl", maxWidth)}>{children}</div>
      </main>
    </div>
  );
}

/**
 * Page header — H1 + supporting line on the left, primary action on the right.
 * §3.2: `action` is the ONE primary control for the page; anything else belongs in
 * the content below.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-lg">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
        {description && <p className="mt-xs text-md text-text-secondary">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
