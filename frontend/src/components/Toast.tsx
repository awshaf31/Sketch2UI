import { IconButton } from "./IconButton.js";
import { cn } from "./cn.js";

// docs/frontend/component-specification.md — Toast (presentational shell). Semantic-
// colored left edge + icon-less dot (matches StatusIndicator's convention) + message +
// dismiss. Rendered by ToastStack.tsx's provider — not used directly by feature code.

export type ToastVariant = "success" | "error" | "info";

export interface ToastData {
  id: string;
  variant: ToastVariant;
  message: string;
}

const BORDER_CLASSES: Record<ToastVariant, string> = {
  success: "border-l-success",
  error: "border-l-error",
  info: "border-l-info",
};

const DOT_CLASSES: Record<ToastVariant, string> = {
  success: "bg-success",
  error: "bg-error",
  info: "bg-info",
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  );
}

export function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-80 items-start gap-sm rounded-md border-l-4 bg-surface-raised px-md py-sm",
        "text-sm text-text-primary shadow-elevated",
        BORDER_CLASSES[toast.variant]
      )}
    >
      <span aria-hidden="true" className={cn("mt-2xs h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[toast.variant])} />
      <p className="min-w-0 flex-1 break-words">{toast.message}</p>
      <IconButton aria-label="Dismiss notification" size="sm" icon={<CloseIcon />} onClick={onDismiss} />
    </div>
  );
}
