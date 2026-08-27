import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn.js";

// Input / Field. `mono` switches to font-mono for data fields (Geometry x/y/w/h, href) per
// the typography direction; prose fields (Content text/altText) leave it off.

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "sm" | "md";
  invalid?: boolean;
  mono?: boolean;
}

const SIZE_CLASSES = { sm: "h-7 px-sm text-xs", md: "h-9 px-md text-sm" };

const SHARED_CLASSES =
  "w-full rounded-sm border bg-surface text-text-primary placeholder:text-text-muted " +
  "transition-colors duration-fast disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "sm", invalid, mono, className, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        SHARED_CLASSES,
        invalid ? "border-error" : "border-border focus:border-primary",
        mono && "font-mono",
        SIZE_CLASSES[size],
        className
      )}
      {...rest}
    />
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        SHARED_CLASSES,
        "px-md py-xs text-sm",
        invalid ? "border-error" : "border-border focus:border-primary",
        className
      )}
      {...rest}
    />
  );
});
