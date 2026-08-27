import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "./cn.js";

// Card. `interactive` adds the hover/focus "lift" (border-strong + shadow-subtle) for a
// card that's a click target, e.g. Dashboard's ProjectCard — kept deliberately subtle per
// the elevation philosophy.

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive, className, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-border bg-surface p-lg shadow-none transition-all duration-fast",
        interactive &&
          "hover:border-border-strong hover:shadow-subtle focus-within:border-border-strong focus-within:shadow-subtle",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
