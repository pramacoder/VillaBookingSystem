"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField, Textarea } from "@/components/ui/input";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  closeLabel?: string;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  closeLabel = "Close dialog",
}: DialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    if (!open) return;

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const container = dialogRef.current;
    if (container) {
      const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      focusables[0]?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Tab" && dialogRef.current) {
        const nodes = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElementRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-full max-w-lg rounded-[8px] border border-gray-100 bg-white p-6 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="font-display text-2xl font-semibold text-gray-800">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 font-sans text-sm text-gray-600">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[6px] text-gray-600 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export interface ConfirmActionDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  /** Must name the specific action, e.g. "Cancel reservation" or "Void payment" (DESIGN.md §7.5, TC-U13) */
  confirmActionLabel: string;
  cancelLabel?: string;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequiredError?: string;
  isDestructive?: boolean;
  isSubmitting?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}

export function ConfirmActionDialog({
  open,
  onClose,
  title,
  description,
  confirmActionLabel,
  cancelLabel = "Cancel",
  requireReason = false,
  reasonLabel = "Reason",
  reasonPlaceholder = "Provide a clear operational reason",
  reasonRequiredError = "A reason is required to complete this action.",
  isDestructive = false,
  isSubmitting = false,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const reasonInputId = React.useId();

  function handleDismiss() {
    setReason("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (requireReason && !trimmed) {
      setError(reasonRequiredError);
      return;
    }
    setError(null);
    await onConfirm(trimmed);
    setReason("");
  }

  return (
    <Dialog open={open} onClose={handleDismiss} title={title} description={description}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {requireReason ? (
          <FormField id={reasonInputId} label={reasonLabel} required error={error}>
            <Textarea
              id={reasonInputId}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder={reasonPlaceholder}
              hasError={Boolean(error)}
              aria-describedby={error ? `${reasonInputId}-error` : undefined}
              required
            />
          </FormField>
        ) : null}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleDismiss} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            variant={isDestructive ? "destructiveSolid" : "primary"}
            isLoading={isSubmitting}
          >
            {confirmActionLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
