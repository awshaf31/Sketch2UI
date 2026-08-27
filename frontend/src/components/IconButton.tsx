import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.js";

// Icon Button. `aria-label` is required (narrowed from the optional DOM attribute) so an
// icon-only control can never ship without an accessible name — direct fix for the audit's
// §20 "five indistinguishable Apply buttons" finding, generalized as a type-level rule for
// every future usage.

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  icon: ReactNode;
  "aria-label": string;
  size?: "sm" | "md";
  /** Toggled/pressed visual state, e.g. an open dropdown trigger or a collapsed panel's chevron. */
  active?: boolean;
}

const SIZE_CLASSES = { sm: "h-7 w-7", md: "h-8 w-8" };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, size = "md", active, className, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center rounded-sm text-text-secondary transition-colors duration-fast",
        "hover:bg-surface-sunken hover:text-text-primary",
        "disabled:pointer-events-none disabled:opacity-50",
        active && "bg-primary-subtle text-primary hover:bg-primary-subtle",
        SIZE_CLASSES[size],
        className
      )}
      {...rest}
    >
      {icon}
    </button>
  );
});
