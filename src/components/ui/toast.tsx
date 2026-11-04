"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = React.useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);

      // Success/info toasts auto-dismiss; error toasts persist until dismissed (DESIGN.md §7.8)
      if (toast.kind !== "error") {
        window.setTimeout(() => {
          dismissToast(id);
        }, 4500);
      }
    },
    [dismissToast],
  );

  const value = React.useMemo(
    () => ({ toasts, pushToast, dismissToast }),
    [toasts, pushToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider.");
  }
  return ctx;
}

export function ToastRegion({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2.5"
    >
      {toasts.map((toast) => {
        const isError = toast.kind === "error";
        const isSuccess = toast.kind === "success";
        const Icon = isError ? AlertCircle : isSuccess ? CheckCircle2 : Info;
        const colorClasses = isError
          ? "border-status-danger-fg/40 bg-status-danger-bg text-status-danger-fg"
          : isSuccess
            ? "border-status-success-fg/40 bg-status-success-bg text-status-success-fg"
            : "border-status-info-fg/40 bg-status-info-bg text-status-info-fg";

        return (
          <div
            key={toast.id}
            role={isError ? "alert" : "status"}
            aria-live={isError ? "assertive" : "polite"}
            className={`flex items-start justify-between gap-3 rounded-[8px] border p-4 shadow-sm ${colorClasses}`}
          >
            <div className="flex items-start gap-2.5">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="font-sans text-sm">
                <p className="font-semibold">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-0.5 text-xs opacity-90">{toast.description}</p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
