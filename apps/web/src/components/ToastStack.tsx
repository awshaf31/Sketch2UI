import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Toast } from "./Toast.js";
import type { ToastData, ToastVariant } from "./Toast.js";

// docs/frontend/component-specification.md — Toast (provider/host). Mounted once near
// App root (see App.tsx). Intended, in a later phase, to replace every window.alert()
// call site in ProjectWorkspace.tsx (see docs/frontend/design-to-code-mapping.md's
// exact list) — not done in this phase; those call sites are untouched.

const AUTO_DISMISS_MS = 4000;

interface ToastContextValue {
  showToast: (variant: ToastVariant, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const timers = useRef<Record<string, number>>({});

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current[id];
    if (timer !== undefined) {
      window.clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const showToast = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, variant, message }]);
      // Success/info auto-dismiss; error must be manually dismissed — an error the
      // user didn't finish reading shouldn't vanish on its own (component-specification.md).
      if (variant !== "error") {
        timers.current[id] = window.setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
      }
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed bottom-lg right-lg z-50 flex flex-col gap-xs" aria-live="polite">
            {toasts.map((toast) => (
              <Toast key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
