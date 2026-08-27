import type { ReactNode } from "react";
import { cn } from "./cn.js";

// Empty State. Icon-agnostic (the caller supplies it) so it can serve Dashboard's "no
// projects" state today and the Layers panel's "nothing drawn yet" state in a later phase
// without duplication.

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2xs px-lg py-2xl text-center", className)}>
      {icon && (
        <div className="mb-xs text-text-muted" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-md font-medium text-text-primary">{title}</p>
      {description && <p className="text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-sm">{action}</div>}
    </div>
  );
}
