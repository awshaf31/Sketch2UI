import { createContext, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button.js";
import { Dialog } from "./Dialog.js";

// docs/frontend/component-specification.md — Dialog (provider/host). Mounted once near
// App root (see App.tsx). Exposes an imperative confirm() that resolves true/false, so
// a later phase can call it from anywhere without prop-drilling. Intended (a later
// phase, not this one) to replace Dashboard.tsx's window.confirm() delete-project call
// — see docs/frontend/dashboard-design.md's "Delete confirmation" section.

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive confirms default focus to Cancel (the safer default) and disable
   * dismiss-on-overlay-click — docs/frontend/accessibility.md's dialog-focus contract. */
  destructive?: boolean;
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => setPending({ ...options, resolve }));
  }

  function close(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  return (
    <DialogContext.Provider value={{ confirm }}>
      {children}
      <Dialog
        open={pending !== null}
        title={pending?.title ?? ""}
        onDismiss={() => close(false)}
        dismissOnOverlayClick={!pending?.destructive}
        initialFocusRef={pending?.destructive ? cancelRef : confirmRef}
        actions={
          <>
            <Button ref={cancelRef} variant="secondary" onClick={() => close(false)}>
              {pending?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              ref={confirmRef}
              variant={pending?.destructive ? "tinted" : "primary"}
              tint="error"
              onClick={() => close(true)}
            >
              {pending?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      >
        {pending?.body}
      </Dialog>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within a DialogProvider");
  return ctx;
}
