import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.js";

// Button. Variants/sizes/states match that spec's table; tinted color groups reuse the
// existing per-action hues (Detect/Approve/ Export) formalized as tokens instead of inline
// Tailwind color-utility strings.

export type ButtonVariant = "primary" | "secondary" | "tinted" | "destructive" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonTint = "brand" | "violet" | "success" | "info" | "error";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Only used when variant="tinted" — picks which semantic hue outlines the button. */
  tint?: ButtonTint;
  loading?: boolean;
  /** Shown in place of children while loading, e.g. "Saving…" — mirrors the
   * present-participle pattern already used throughout the app today. */
  loadingLabel?: ReactNode;
}

export const BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-7 px-sm text-xs gap-2xs",
  md: "h-8 px-md text-sm gap-xs",
  lg: "h-10 px-lg text-md gap-xs",
};

export const BUTTON_VARIANT_CLASSES: Record<Exclude<ButtonVariant, "tinted">, string> = {
  primary: "bg-primary text-text-inverse hover:bg-primary-hover active:bg-primary-active",
  secondary: "bg-surface text-text-primary border border-border hover:border-border-strong",
  destructive: "bg-transparent text-text-muted hover:text-error",
  ghost: "bg-transparent text-text-secondary hover:bg-surface-sunken",
};

const SIZE_CLASSES = BUTTON_SIZE_CLASSES;
const VARIANT_CLASSES = BUTTON_VARIANT_CLASSES;

const TINT_CLASSES: Record<ButtonTint, string> = {
  brand: "border border-primary/30 bg-primary-subtle text-primary-active hover:bg-primary-subtle/70",
  violet: "border border-detection-model/30 bg-detection-model/10 text-detection-model hover:bg-detection-model/15",
  success: "border border-success/30 bg-success-subtle text-success hover:bg-success-subtle/70",
  info: "border border-info/30 bg-info-subtle text-info hover:bg-info-subtle/70",
  error: "border border-error/30 bg-error-subtle text-error hover:bg-error-subtle/70",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", tint = "brand", loading, loadingLabel, disabled, className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-sm font-sans font-medium transition-colors duration-fast",
        "disabled:pointer-events-none disabled:opacity-50",
        SIZE_CLASSES[size],
        variant === "tinted" ? TINT_CLASSES[tint] : VARIANT_CLASSES[variant],
        className
      )}
      {...rest}
    >
      {loading ? loadingLabel ?? children : children}
    </button>
  );
});
