import type { ReactNode } from "react";
import { cn } from "./cn.js";

// docs/frontend/component-specification.md — Field. Owns the label→control→helper/
// error spacing so it's defined once instead of re-typed at every Inspector call site.
// `layout="inline-80"` matches the Inspector's existing grid-cols-[80px_1fr] rows — a
// Field in that mode renders its label and control as two direct grid children (via
// `display: contents`) so it can drop into that grid unchanged.

interface FieldProps {
  label: string;
  htmlFor: string;
  helperText?: string;
  errorText?: string;
  layout?: "stacked" | "inline-80";
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, helperText, errorText, layout = "stacked", className, children }: FieldProps) {
  const note = errorText ? (
    <p className="mt-2xs text-xs text-error">{errorText}</p>
  ) : helperText ? (
    <p className="mt-2xs text-xs text-text-muted">{helperText}</p>
  ) : null;

  if (layout === "inline-80") {
    return (
      <div className={cn("contents", className)}>
        <label htmlFor={htmlFor} className="self-center text-xs text-text-secondary">
          {label}
        </label>
        <div>
          {children}
          {note}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-xs", className)}>
      <label htmlFor={htmlFor} className="text-xs text-text-secondary">
        {label}
      </label>
      {children}
      {note}
    </div>
  );
}
