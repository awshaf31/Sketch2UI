import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn.js";

// docs/frontend/component-specification.md — Select. Deliberately a styled shell
// around the native <select> (not a custom listbox) — every current use case (class
// picker, display mode, parent dropdown) is a short flat option list, and native
// selects give correct keyboard/screen-reader behavior for free.

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: "sm" | "md";
}

const SIZE_CLASSES = { sm: "h-7 px-sm text-xs", md: "h-9 px-md text-sm" };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = "sm", className, children, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-sm border border-border bg-surface text-text-primary",
        "transition-colors duration-fast focus:border-primary",
        "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted",
        SIZE_CLASSES[size],
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
