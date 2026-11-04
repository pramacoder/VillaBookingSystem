import * as React from "react";
import { AlertCircle, Inbox, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Skeleton loading state for tables (DESIGN.md §7.8, TC-U12 — skeleton, never spinner-only).
 */
export function TableSkeleton({
  rows = 5,
  columns = 5,
  label = "Loading data…",
}: {
  rows?: number;
  columns?: number;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="w-full overflow-hidden rounded-[8px] border border-gray-100 bg-white"
    >
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-5 gap-4 border-b border-gray-100 bg-gray-100 px-4 py-3">
        {Array.from({ length: columns }).map((_, idx) => (
          <div key={idx} className="h-3.5 animate-pulse rounded bg-gray-600/20" />
        ))}
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="grid h-12 grid-cols-5 items-center gap-4 px-4">
            {Array.from({ length: columns }).map((__, cIdx) => (
              <div key={cIdx} className="h-3.5 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({
  count = 3,
  label = "Loading summary cards…",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="rounded-[8px] border border-gray-100 bg-white p-5">
          <div className="h-3 w-28 animate-pulse rounded bg-gray-100" />
          <div className="mt-3 h-7 w-20 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}

/**
 * Empty state with explanation and primary action (DESIGN.md §7.4 & §7.8, CONTENT_GUIDE.md §9, TC-U12).
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[8px] border border-gray-100 bg-white px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-600">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-sans text-base font-semibold text-gray-800">{title}</h3>
      <p className="mt-1 max-w-md font-sans text-sm text-gray-600">{description}</p>
      {actionLabel && onAction ? (
        <div className="mt-5">
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
      {actionLabel && actionHref && !onAction ? (
        <div className="mt-5">
          <a
            href={actionHref}
            className="inline-flex min-h-11 items-center justify-center rounded-[6px] bg-blue-600 px-4 py-2.5 font-sans text-sm font-medium text-white hover:bg-blue-600/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {actionLabel}
          </a>
        </div>
      ) : null}
    </div>
  );
}

export interface ErrorStateProps {
  title: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
}

/**
 * Error state with problem description and retry action (DESIGN.md §7.8, TC-U12).
 */
export function ErrorState({
  title,
  description,
  retryLabel = "Try again",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-[8px] border border-status-danger-fg/30 bg-status-danger-bg px-6 py-10 text-center text-status-danger-fg"
    >
      <AlertCircle className="h-6 w-6" aria-hidden="true" />
      <h3 className="mt-3 font-sans text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-md font-sans text-sm">{description}</p>
      {onRetry ? (
        <div className="mt-4">
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Partial / permission state (DESIGN.md §7.8).
 */
export function PermissionState({ title, description }: { title: string; description: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-[8px] border border-status-warning-fg/30 bg-status-warning-bg px-5 py-4 text-status-warning-fg"
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="font-sans text-sm">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5">{description}</p>
      </div>
    </div>
  );
}
