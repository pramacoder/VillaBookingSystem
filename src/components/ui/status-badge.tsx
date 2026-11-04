import type { PaymentStatus, ReservationStatus, UnitStatus } from "@prisma/client";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  Info,
  LogIn,
  type LucideIcon,
} from "lucide-react";
import type { StatusTokenVariant } from "@/lib/design-tokens";
import { getMessages, type SupportedLocale } from "@/lib/i18n/messages";

const VARIANT_STYLES: Record<StatusTokenVariant, string> = {
  neutral: "bg-status-neutral-bg text-status-neutral-fg",
  info: "bg-status-info-bg text-status-info-fg",
  active: "bg-status-active-bg text-status-active-fg",
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  danger: "bg-status-danger-bg text-status-danger-fg",
};

const VARIANT_ICONS: Record<StatusTokenVariant, LucideIcon> = {
  neutral: Circle,
  info: Info,
  active: LogIn,
  success: CheckCircle2,
  warning: Clock,
  danger: AlertCircle,
};

export interface StatusBadgeProps {
  variant: StatusTokenVariant;
  label: string;
  outlineDanger?: boolean;
  className?: string;
}

/**
 * Semantic status badge per DESIGN.md §3.2 & §8 (TC-U14):
 * - 6 px radius (`rounded-[6px]`)
 * - DM Sans 12–13 px medium (`font-sans text-xs font-medium`)
 * - Always pairs color with a Lucide icon + text label (never color alone).
 */
export function StatusBadge({
  variant,
  label,
  outlineDanger = false,
  className = "",
}: StatusBadgeProps) {
  const Icon = VARIANT_ICONS[variant];
  const colorClasses = outlineDanger
    ? "border border-status-danger-fg/50 bg-status-neutral-bg text-status-neutral-fg"
    : VARIANT_STYLES[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 font-sans text-xs font-medium ${colorClasses} ${className}`.trim()}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

const RESERVATION_STATUS_VARIANT: Record<ReservationStatus, StatusTokenVariant> = {
  PENDING: "neutral",
  CONFIRMED: "info",
  CHECKED_IN: "active",
  CHECKED_OUT: "success",
  CANCELLED: "danger",
};

export function getReservationStatusMeta(
  status: ReservationStatus,
  locale: SupportedLocale = "en",
): { variant: StatusTokenVariant; label: string } {
  const messages = getMessages(locale);
  return {
    variant: RESERVATION_STATUS_VARIANT[status],
    label: messages.statuses.reservation[status],
  };
}

export function isReservationPendingStale(
  status: ReservationStatus,
  createdAt: Date | string,
  now: Date = new Date(),
): boolean {
  if (status !== "PENDING") return false;
  const createdTime =
    typeof createdAt === "string" ? new Date(createdAt).getTime() : createdAt.getTime();
  const diffMs = now.getTime() - createdTime;
  return diffMs > 24 * 60 * 60 * 1000;
}

export function PendingStaleBadge({
  locale = "en",
  className,
}: {
  locale?: SupportedLocale;
  className?: string;
}) {
  const isId = locale === "id";
  return (
    <StatusBadge
      variant="warning"
      label={isId ? "Menunggu (>24 jam)" : "Pending (>24h)"}
      className={className}
    />
  );
}

export function ReservationStatusBadge({
  status,
  createdAt,
  locale = "en",
  className,
}: {
  status: ReservationStatus;
  createdAt?: Date | string;
  locale?: SupportedLocale;
  className?: string;
}) {
  const isStale = createdAt ? isReservationPendingStale(status, createdAt) : false;
  if (status === "PENDING" && isStale) {
    const isId = locale === "id";
    return (
      <StatusBadge
        variant="warning"
        label={isId ? "Menunggu (>24 jam)" : "Pending (>24h)"}
        className={className}
      />
    );
  }
  const { variant, label } = getReservationStatusMeta(status, locale);
  return <StatusBadge variant={variant} label={label} className={className} />;
}

const PAYMENT_STATUS_VARIANT: Record<PaymentStatus, StatusTokenVariant> = {
  UNPAID: "danger",
  PARTIAL: "warning",
  PAID: "success",
};

export function getPaymentStatusMeta(
  status: PaymentStatus,
  locale: SupportedLocale = "en",
): { variant: StatusTokenVariant; label: string } {
  const messages = getMessages(locale);
  return {
    variant: PAYMENT_STATUS_VARIANT[status],
    label: messages.statuses.payment[status],
  };
}

export function PaymentStatusBadge({
  status,
  locale = "en",
  isFutureStay = false,
  className,
}: {
  status: PaymentStatus;
  locale?: SupportedLocale;
  isFutureStay?: boolean;
  className?: string;
}) {
  const { variant, label } = getPaymentStatusMeta(status, locale);
  const useFutureNeutralOutline = status === "UNPAID" && isFutureStay;
  return (
    <StatusBadge
      variant={variant}
      label={label}
      outlineDanger={useFutureNeutralOutline}
      className={className}
    />
  );
}

const UNIT_STATUS_VARIANT: Record<UnitStatus, StatusTokenVariant> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  ARCHIVED: "neutral",
};

export function UnitStatusBadge({
  status,
  locale = "en",
  className,
}: {
  status: UnitStatus;
  locale?: SupportedLocale;
  className?: string;
}) {
  const messages = getMessages(locale);
  return (
    <StatusBadge
      variant={UNIT_STATUS_VARIANT[status]}
      label={messages.statuses.unit[status]}
      className={className}
    />
  );
}
