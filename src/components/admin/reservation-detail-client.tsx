"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  CreditCard,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
  UserRound,
} from "lucide-react";
import type { ReservationStatus } from "@prisma/client";
import type { AppLocale, AppMessages } from "@/lib/i18n/messages";
import { formatIdr } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog, Dialog } from "@/components/ui/dialog";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  PaymentStatusBadge,
  ReservationStatusBadge,
  StatusBadge,
} from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import type { UnitOptionForReservation } from "@/components/admin/create-reservation-form";

export interface SerializedPaymentItem {
  id: string;
  kind: "PAYMENT" | "REFUND";
  amountIdr: number;
  method: "BANK_TRANSFER" | "CASH" | "QRIS" | "CARD_EXTERNAL" | "OTHER";
  paidAt: string;
  reference: string | null;
  note: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  recordedBy: { id: string; name: string; email: string; role: string } | null;
}

export interface SerializedAuditItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; name: string; email: string; role: string } | null;
}

export interface SerializedReservationDetail {
  id: string;
  code: string;
  status: ReservationStatus;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  source: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  nightlySubtotalIdr: number;
  cleaningFeeIdr: number;
  discountIdr: number;
  totalIdr: number;
  netPaidIdr: number;
  balanceDueIdr: number;
  overpaidIdr: number;
  refundPending: boolean;
  locale: string;
  specialRequests: string | null;
  internalNotes: string | null;
  cancelReason: string | null;
  version: number;
  createdAt: string;
  allowedNextStatuses: readonly ReservationStatus[];
  unit: {
    id: string;
    slug: string;
    nameEn: string;
    nameId: string;
    baseRateIdr: number;
    cleaningFeeIdr: number;
    maxGuests: number;
    minNights: number;
    maxNights: number | null;
  };
  guest: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    country: string | null;
    preferredLocale: string;
    notes: string | null;
  };
  payments: SerializedPaymentItem[];
  auditLogs: SerializedAuditItem[];
}

interface ReservationDetailClientProps {
  locale: AppLocale;
  messages: AppMessages;
  reservation: SerializedReservationDetail;
  units: UnitOptionForReservation[];
}

export function ReservationDetailClient({
  locale,
  messages,
  reservation,
  units,
}: ReservationDetailClientProps) {
  const router = useRouter();
  const { pushToast } = useToast();

  // Edit form state
  const [unitId, setUnitId] = React.useState(reservation.unit.id);
  const [checkIn, setCheckIn] = React.useState(reservation.checkIn);
  const [checkOut, setCheckOut] = React.useState(reservation.checkOut);
  const [adults, setAdults] = React.useState(reservation.adults);
  const [children, setChildren] = React.useState(reservation.children);
  const [discountIdr, setDiscountIdr] = React.useState(reservation.discountIdr);
  const [specialRequests, setSpecialRequests] = React.useState(reservation.specialRequests ?? "");
  const [internalNotes, setInternalNotes] = React.useState(reservation.internalNotes ?? "");

  // Workflow & dialog states
  const [earlyCheckInOverride, setEarlyCheckInOverride] = React.useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = React.useState(false);
  const [voidingPaymentId, setVoidingPaymentId] = React.useState<string | null>(null);

  // Record payment form state
  const [paymentKind, setPaymentKind] = React.useState<"PAYMENT" | "REFUND">("PAYMENT");
  const [paymentAmountIdr, setPaymentAmountIdr] = React.useState<number>(
    Math.max(reservation.balanceDueIdr, 100000),
  );
  const [paymentMethod, setPaymentMethod] = React.useState<
    "BANK_TRANSFER" | "CASH" | "QRIS" | "CARD_EXTERNAL" | "OTHER"
  >("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = React.useState("");
  const [paymentNote, setPaymentNote] = React.useState("");

  // Busy & error states
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null);
  const [versionConflict, setVersionConflict] = React.useState(false);

  const d = messages.admin.reservationDetail;
  const p = messages.admin.paymentPanel;
  const a = messages.admin.auditTrail;

  function handleApiError(code?: string, message?: string) {
    const msg = message ?? "Operation failed.";
    if (code === "VERSION_CONFLICT") {
      setVersionConflict(true);
    }
    setErrorBanner(msg);
    pushToast({
      kind: "error",
      title: code ?? "Error",
      description: msg,
    });
  }

  async function handleStatusAction(
    endpoint: "confirm" | "check-in" | "check-out",
    extraBody: Record<string, unknown> = {},
  ) {
    setErrorBanner(null);
    setBusyAction(endpoint);
    try {
      const response = await fetch(`/api/admin/reservations/${reservation.id}/${endpoint}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "if-match": String(reservation.version),
        },
        body: JSON.stringify({
          expectedVersion: reservation.version,
          ...extraBody,
        }),
      });
      const payload = (await response.json()) as {
        data?: { status: ReservationStatus };
        error?: { code?: string; message?: string };
      };

      if (!response.ok || !payload.data) {
        handleApiError(payload.error?.code, payload.error?.message);
        setBusyAction(null);
        return;
      }

      pushToast({
        kind: "success",
        title: reservation.code,
        description: `${messages.statuses.reservation[payload.data.status]}`,
      });
      setBusyAction(null);
      router.refresh();
    } catch {
      handleApiError("INTERNAL", "Network error while updating status.");
      setBusyAction(null);
    }
  }

  async function handleCancelReservation(reason: string) {
    setErrorBanner(null);
    setBusyAction("cancel");
    try {
      const response = await fetch(`/api/admin/reservations/${reservation.id}/cancel`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "if-match": String(reservation.version),
        },
        body: JSON.stringify({
          reason,
          expectedVersion: reservation.version,
        }),
      });
      const payload = (await response.json()) as {
        data?: { status: ReservationStatus };
        error?: { code?: string; message?: string };
      };

      if (!response.ok || !payload.data) {
        handleApiError(payload.error?.code, payload.error?.message);
        setBusyAction(null);
        return;
      }

      setCancelDialogOpen(false);
      pushToast({
        kind: "success",
        title: reservation.code,
        description: messages.statuses.reservation.CANCELLED,
      });
      setBusyAction(null);
      router.refresh();
    } catch {
      handleApiError("INTERNAL", "Network error while cancelling reservation.");
      setBusyAction(null);
    }
  }

  async function handleSaveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorBanner(null);
    setBusyAction("edit");

    try {
      const response = await fetch(`/api/admin/reservations/${reservation.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "if-match": String(reservation.version),
        },
        body: JSON.stringify({
          unitId,
          checkIn,
          checkOut,
          adults: Number(adults),
          children: Number(children),
          discountIdr: Number(discountIdr) || 0,
          specialRequests: specialRequests.trim() || null,
          internalNotes: internalNotes.trim() || null,
        }),
      });

      const payload = (await response.json()) as {
        data?: { version: number };
        error?: { code?: string; message?: string };
      };

      if (!response.ok || !payload.data) {
        handleApiError(payload.error?.code, payload.error?.message);
        setBusyAction(null);
        return;
      }

      pushToast({
        kind: "success",
        title: reservation.code,
        description: `${d.saveChanges} (v${payload.data.version})`,
      });
      setBusyAction(null);
      router.refresh();
    } catch {
      handleApiError("INTERNAL", "Network error while saving reservation.");
      setBusyAction(null);
    }
  }

  async function handleRecordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorBanner(null);
    setBusyAction("payment");

    try {
      const response = await fetch(`/api/admin/reservations/${reservation.id}/payments`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kind: paymentKind,
          amountIdr: Number(paymentAmountIdr),
          method: paymentMethod,
          reference: paymentReference.trim() || null,
          note: paymentNote.trim() || null,
        }),
      });

      const payload = (await response.json()) as {
        data?: { paymentStatus: "UNPAID" | "PARTIAL" | "PAID" };
        error?: { code?: string; message?: string };
      };

      if (!response.ok || !payload.data) {
        handleApiError(payload.error?.code, payload.error?.message);
        setBusyAction(null);
        return;
      }

      setRecordPaymentOpen(false);
      setPaymentReference("");
      setPaymentNote("");
      pushToast({
        kind: "success",
        title: reservation.code,
        description: messages.statuses.payment[payload.data.paymentStatus],
      });
      setBusyAction(null);
      router.refresh();
    } catch {
      handleApiError("INTERNAL", "Network error while recording payment.");
      setBusyAction(null);
    }
  }

  async function handleVoidPayment(reason: string) {
    if (!voidingPaymentId) return;
    setErrorBanner(null);
    setBusyAction("void");

    try {
      const response = await fetch(`/api/admin/payments/${voidingPaymentId}/void`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });

      const payload = (await response.json()) as {
        data?: { paymentStatus: "UNPAID" | "PARTIAL" | "PAID" };
        error?: { code?: string; message?: string };
      };

      if (!response.ok || !payload.data) {
        handleApiError(payload.error?.code, payload.error?.message);
        setBusyAction(null);
        return;
      }

      setVoidingPaymentId(null);
      pushToast({
        kind: "success",
        title: p.voidButton,
        description: messages.statuses.payment[payload.data.paymentStatus],
      });
      setBusyAction(null);
      router.refresh();
    } catch {
      handleApiError("INTERNAL", "Network error while voiding payment.");
      setBusyAction(null);
    }
  }

  const canConfirm = reservation.allowedNextStatuses.includes("CONFIRMED");
  const canCheckIn = reservation.allowedNextStatuses.includes("CHECKED_IN");
  const canCheckOut = reservation.allowedNextStatuses.includes("CHECKED_OUT");
  const canCancel = reservation.allowedNextStatuses.includes("CANCELLED");

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Reference Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/admin/reservations"
            className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{d.backToList}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <h1 className="font-display text-3xl font-semibold text-gray-800 tabular-nums">
              {reservation.code}
            </h1>
            <ReservationStatusBadge
              status={reservation.status}
              createdAt={reservation.createdAt}
              locale={locale}
            />
            <PaymentStatusBadge status={reservation.paymentStatus} locale={locale} />
            <span className="rounded-[6px] border border-gray-100 bg-white px-2.5 py-1 font-sans text-xs font-medium text-gray-600 tabular-nums">
              {d.versionBadge.replace("{version}", String(reservation.version))}
            </span>
            <span className="rounded-[6px] border border-gray-100 bg-white px-2.5 py-1 font-sans text-xs font-medium text-gray-600">
              {d.sourceBadge.replace("{source}", reservation.source)}
            </span>
          </div>
        </div>
      </div>

      {/* Stale Version Conflict Alert (TC-U15) */}
      {versionConflict ? (
        <div
          role="alert"
          data-testid="version-conflict-banner"
          className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-status-warning-fg/30 bg-status-warning-bg px-4 py-3 font-sans text-sm text-status-warning-fg"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">{d.versionConflictTitle}</p>
              <p className="text-xs">{d.versionConflictBody}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setVersionConflict(false);
              setErrorBanner(null);
              router.refresh();
            }}
          >
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{d.reloadButton}</span>
          </Button>
        </div>
      ) : null}

      {/* General Error Banner */}
      {errorBanner && !versionConflict ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[10px] border border-status-danger-fg/30 bg-status-danger-bg px-4 py-3 font-sans text-sm text-status-danger-fg"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>{errorBanner}</div>
        </div>
      ) : null}

      {/* Status Workflow Bar (BR-12, TC-S01..TC-S04) */}
      <section className="rounded-[10px] border border-gray-100 bg-white p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-lg font-semibold text-gray-800">{d.workflowTitle}</h2>
            {reservation.cancelReason ? (
              <p className="mt-1 font-sans text-xs text-status-danger-fg">
                {messages.admin.common.reasonLabel}: {reservation.cancelReason}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {canConfirm ? (
              <Button
                type="button"
                variant="primary"
                disabled={busyAction !== null}
                onClick={() => handleStatusAction("confirm")}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{d.confirmAction}</span>
              </Button>
            ) : null}

            {canCheckIn ? (
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 font-sans text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={earlyCheckInOverride}
                    onChange={(e) => setEarlyCheckInOverride(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-600 text-blue-600"
                  />
                  <span>{d.checkInEarlyOverride}</span>
                </label>
                <Button
                  type="button"
                  variant="primary"
                  disabled={busyAction !== null}
                  onClick={() =>
                    handleStatusAction("check-in", {
                      overrideEarlyCheckIn: earlyCheckInOverride,
                    })
                  }
                >
                  <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{d.checkInAction}</span>
                </Button>
              </div>
            ) : null}

            {canCheckOut ? (
              <Button
                type="button"
                variant="primary"
                disabled={busyAction !== null}
                onClick={() => handleStatusAction("check-out")}
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{d.checkOutAction}</span>
              </Button>
            ) : null}

            {canCancel ? (
              <Button
                type="button"
                variant="destructive"
                disabled={busyAction !== null}
                onClick={() => setCancelDialogOpen(true)}
              >
                <Ban className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{d.cancelAction}</span>
              </Button>
            ) : null}

            {!canConfirm && !canCheckIn && !canCheckOut && !canCancel ? (
              <p className="font-sans text-xs text-gray-600">
                {d.noFurtherTransitions.replace(
                  "{status}",
                  messages.statuses.reservation[reservation.status],
                )}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 columns: Edit Stay Form + Payment Panel + Audit Trail */}
        <div className="space-y-6 lg:col-span-2">
          {/* Edit Reservation Panel */}
          <form
            onSubmit={handleSaveEdit}
            className="space-y-4 rounded-[10px] border border-gray-100 bg-white p-6"
          >
            <div>
              <h2 className="font-display text-xl font-semibold text-gray-800">
                {d.editSectionTitle}
              </h2>
              <p className="mt-1 font-sans text-xs text-gray-600">{d.editSectionSubtitle}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="edit-unit" label={messages.admin.reservationForm.unitLabel}>
                <Select id="edit-unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {locale === "id" ? u.nameId : u.nameEn}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField id="edit-discount" label={messages.admin.reservationForm.discountLabel}>
                <Input
                  id="edit-discount"
                  type="number"
                  min={0}
                  step={50000}
                  value={discountIdr}
                  onChange={(e) => setDiscountIdr(Number(e.target.value) || 0)}
                />
              </FormField>

              <FormField id="edit-checkin" label={messages.admin.reservationForm.checkInLabel}>
                <Input
                  id="edit-checkin"
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </FormField>

              <FormField id="edit-checkout" label={messages.admin.reservationForm.checkOutLabel}>
                <Input
                  id="edit-checkout"
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </FormField>

              <FormField id="edit-adults" label={messages.admin.reservationForm.adultsLabel}>
                <Input
                  id="edit-adults"
                  type="number"
                  min={1}
                  max={30}
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                />
              </FormField>

              <FormField id="edit-children" label={messages.admin.reservationForm.childrenLabel}>
                <Input
                  id="edit-children"
                  type="number"
                  min={0}
                  max={30}
                  value={children}
                  onChange={(e) => setChildren(Number(e.target.value))}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="edit-special-requests"
                label={messages.admin.reservationForm.specialRequestsLabel}
              >
                <Textarea
                  id="edit-special-requests"
                  rows={3}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                />
              </FormField>

              <FormField
                id="edit-internal-notes"
                label={messages.admin.reservationForm.internalNotesLabel}
              >
                <Textarea
                  id="edit-internal-notes"
                  rows={3}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                />
              </FormField>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" disabled={busyAction !== null}>
                <Save className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{busyAction === "edit" ? messages.admin.common.saving : d.saveChanges}</span>
              </Button>
            </div>
          </form>

          {/* Payment Panel (DESIGN.md §7.6, FR-17, BR-09..BR-11) */}
          <section className="space-y-4 rounded-[10px] border border-gray-100 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="font-display text-xl font-semibold text-gray-800">{p.title}</h2>
                  <PaymentStatusBadge status={reservation.paymentStatus} locale={locale} />
                </div>
                <p className="mt-1 font-sans text-xs text-gray-600">{p.subtitle}</p>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setRecordPaymentOpen(true)}
              >
                <CreditCard className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{p.recordButton}</span>
              </Button>
            </div>

            {/* Summary Header: Total · Net Paid · Balance Due */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[8px] border border-gray-100 bg-gray-100/50 p-3.5">
                <p className="font-sans text-xs font-medium text-gray-600">{p.summaryTotal}</p>
                <p className="mt-1 font-display text-2xl font-semibold text-gray-800 tabular-nums">
                  {formatIdr(reservation.totalIdr, locale)}
                </p>
              </div>
              <div className="rounded-[8px] border border-gray-100 bg-gray-100/50 p-3.5">
                <p className="font-sans text-xs font-medium text-gray-600">{p.summaryNetPaid}</p>
                <p className="mt-1 font-display text-2xl font-semibold text-gray-800 tabular-nums">
                  {formatIdr(reservation.netPaidIdr, locale)}
                </p>
              </div>
              <div className="rounded-[8px] border border-gray-100 bg-gray-100/50 p-3.5">
                <p className="font-sans text-xs font-medium text-gray-600">{p.summaryBalanceDue}</p>
                <p className="mt-1 font-display text-2xl font-semibold text-gray-800 tabular-nums">
                  {formatIdr(reservation.balanceDueIdr, locale)}
                </p>
              </div>
            </div>

            {/* Overpayment Warning Banner (FR-17, TC-Y05) */}
            {reservation.overpaidIdr > 0 ? (
              <div
                role="alert"
                data-testid="overpaid-banner"
                className="flex items-start gap-2.5 rounded-[8px] border border-status-warning-fg/30 bg-status-warning-bg px-4 py-3 font-sans text-sm text-status-warning-fg"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{p.overpaidWarningTitle}</p>
                  <p className="text-xs">
                    {p.overpaidWarningBody.replace(
                      "{amount}",
                      formatIdr(reservation.overpaidIdr, locale),
                    )}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Refund Pending Banner on Cancelled Reservation (BR-11, TC-Y06) */}
            {reservation.refundPending ? (
              <div
                role="alert"
                data-testid="refund-pending-banner"
                className="flex items-start gap-2.5 rounded-[8px] border border-status-warning-fg/30 bg-status-warning-bg px-4 py-3 font-sans text-sm text-status-warning-fg"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{p.refundPendingTitle}</p>
                  <p className="text-xs">
                    {p.refundPendingBody.replace(
                      "{amount}",
                      formatIdr(reservation.netPaidIdr, locale),
                    )}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Payment Ledger Table */}
            {reservation.payments.length === 0 ? (
              <p className="rounded-[8px] border border-dashed border-gray-100 p-4 text-center font-sans text-sm text-gray-600">
                {p.emptyPayments}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{p.colDate}</TableHead>
                    <TableHead>{p.colKind}</TableHead>
                    <TableHead>{p.colMethod}</TableHead>
                    <TableHead>{p.colReference}</TableHead>
                    <TableHead>{p.colRecorder}</TableHead>
                    <TableHead numeric>{p.colAmount}</TableHead>
                    <TableHead>{p.colAction}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservation.payments.map((pay) => {
                    const isVoided = pay.voidedAt !== null;
                    return (
                      <TableRow key={pay.id}>
                        <TableCell
                          className={`text-xs text-gray-600 tabular-nums ${isVoided ? "line-through" : ""}`}
                        >
                          {pay.paidAt.slice(0, 10)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`font-medium text-gray-800 ${isVoided ? "line-through text-gray-600" : ""}`}
                            >
                              {pay.kind}
                            </span>
                            {isVoided ? (
                              <StatusBadge variant="neutral" label={p.voidedBadge} />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-xs text-gray-600 ${isVoided ? "line-through" : ""}`}
                        >
                          {pay.method}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">
                          <div className={isVoided ? "line-through" : ""}>
                            {pay.reference ?? "—"}
                            {pay.note ? ` · ${pay.note}` : ""}
                          </div>
                          {isVoided && pay.voidReason ? (
                            <div className="mt-1 font-medium text-status-danger-fg">
                              {messages.admin.common.reasonLabel}: {pay.voidReason}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {pay.recordedBy?.name ?? "—"}
                        </TableCell>
                        <TableCell
                          numeric
                          className={`font-medium ${
                            isVoided
                              ? "line-through text-gray-600"
                              : pay.kind === "REFUND"
                                ? "text-status-danger-fg"
                                : "text-gray-800"
                          }`}
                        >
                          {pay.kind === "REFUND" ? "-" : ""}
                          {formatIdr(pay.amountIdr, locale)}
                        </TableCell>
                        <TableCell>
                          {!isVoided ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => setVoidingPaymentId(pay.id)}
                            >
                              {p.voidButton}
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </section>

          {/* Audit Trail Panel (FR-20) */}
          <section className="space-y-4 rounded-[10px] border border-gray-100 bg-white p-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-gray-800">{a.title}</h2>
              <p className="mt-1 font-sans text-xs text-gray-600">{a.subtitle}</p>
            </div>

            {reservation.auditLogs.length === 0 ? (
              <p className="font-sans text-sm text-gray-600">{a.emptyLogs}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{a.colTime}</TableHead>
                    <TableHead>{a.colActor}</TableHead>
                    <TableHead>{a.colAction}</TableHead>
                    <TableHead>{a.colDetails}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservation.auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-gray-600 tabular-nums">
                        {log.createdAt.replace("T", " ").slice(0, 19)}
                      </TableCell>
                      <TableCell className="text-xs text-gray-800">
                        {log.actor ? `${log.actor.name} (${log.actor.role})` : a.systemActor}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium text-gray-800">
                        {log.action}
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-mono text-xs text-gray-600">
                        {log.metadata ? JSON.stringify(log.metadata) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </div>

        {/* Right column: Snapshotted Price Breakdown + Guest Card */}
        <div className="space-y-6">
          <aside className="rounded-[10px] border border-gray-100 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-gray-800">
              {d.pricingBreakdownTitle}
            </h2>
            <dl className="mt-4 space-y-2.5 font-sans text-sm">
              <div className="flex items-center justify-between text-gray-600">
                <dt>
                  {messages.admin.reservationForm.nightlySubtotal.replace(
                    "{nights}",
                    String(reservation.nights),
                  )}
                </dt>
                <dd className="tabular-nums text-gray-800">
                  {formatIdr(reservation.nightlySubtotalIdr, locale)}
                </dd>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <dt>{messages.admin.reservationForm.cleaningFee}</dt>
                <dd className="tabular-nums text-gray-800">
                  {formatIdr(reservation.cleaningFeeIdr, locale)}
                </dd>
              </div>
              {reservation.discountIdr > 0 ? (
                <div className="flex items-center justify-between text-gray-600">
                  <dt>{messages.admin.reservationForm.discount}</dt>
                  <dd className="tabular-nums text-status-danger-fg">
                    -{formatIdr(reservation.discountIdr, locale)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-gray-100 pt-3 font-medium text-gray-800">
                <dt>{messages.admin.reservationForm.totalStay}</dt>
                <dd className="font-display text-2xl font-semibold tabular-nums text-gray-800">
                  {formatIdr(reservation.totalIdr, locale)}
                </dd>
              </div>
            </dl>
          </aside>

          <aside className="rounded-[10px] border border-gray-100 bg-white p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-gray-800">
                {d.guestCardTitle}
              </h2>
              <UserRound className="h-4 w-4 text-gray-600" aria-hidden="true" />
            </div>

            <dl className="mt-4 space-y-2 font-sans text-sm">
              <div>
                <dt className="text-xs text-gray-600">
                  {messages.admin.reservationForm.fullNameLabel}
                </dt>
                <dd className="font-medium text-gray-800">{reservation.guest.fullName}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-600">
                  {messages.admin.reservationForm.emailLabel}
                </dt>
                <dd className="text-gray-800">{reservation.guest.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-600">
                  {messages.admin.reservationForm.phoneLabel}
                </dt>
                <dd className="text-gray-800 tabular-nums">{reservation.guest.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-600">
                  {messages.admin.reservationForm.countryLabel}
                </dt>
                <dd className="text-gray-800">{reservation.guest.country ?? "—"}</dd>
              </div>
            </dl>

            <div className="mt-4 pt-2">
              <Link
                href={`/admin/guests/${reservation.guest.id}`}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-[6px] border border-gray-100 bg-white px-3.5 py-2 font-sans text-xs font-medium text-gray-800 hover:bg-gray-100"
              >
                {d.viewGuestProfile}
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* Cancel Reservation Destructive Dialog (TC-U13, TC-S03) */}
      <ConfirmActionDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        title={d.cancelDialogTitle.replace("{code}", reservation.code)}
        description={d.cancelDialogDescription}
        requireReason
        isDestructive
        reasonLabel={messages.admin.common.reasonLabel}
        reasonPlaceholder={messages.admin.common.reasonPlaceholder}
        cancelLabel={messages.admin.common.cancel}
        confirmActionLabel={d.cancelAction}
        isSubmitting={busyAction === "cancel"}
        onConfirm={handleCancelReservation}
      />

      {/* Void Payment Destructive Dialog (TC-U13, TC-Y02) */}
      <ConfirmActionDialog
        open={voidingPaymentId !== null}
        onClose={() => setVoidingPaymentId(null)}
        title={p.voidDialogTitle}
        description={p.voidDialogDescription}
        requireReason
        isDestructive
        reasonLabel={messages.admin.common.reasonLabel}
        reasonPlaceholder={messages.admin.common.reasonPlaceholder}
        cancelLabel={messages.admin.common.cancel}
        confirmActionLabel={p.voidButton}
        isSubmitting={busyAction === "void"}
        onConfirm={handleVoidPayment}
      />

      {/* Record Manual Payment / Refund Dialog */}
      <Dialog
        open={recordPaymentOpen}
        onClose={() => setRecordPaymentOpen(false)}
        title={p.recordDialogTitle}
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <FormField
            id="pay-kind"
            label={p.kindLabel}
            required
            requiredSrLabel={messages.admin.common.required}
          >
            <Select
              id="pay-kind"
              value={paymentKind}
              onChange={(e) => setPaymentKind(e.target.value as "PAYMENT" | "REFUND")}
            >
              <option value="PAYMENT">{p.kindPayment}</option>
              <option value="REFUND">{p.kindRefund}</option>
            </Select>
          </FormField>

          <FormField
            id="pay-amount"
            label={p.amountLabel}
            required
            requiredSrLabel={messages.admin.common.required}
          >
            <Input
              id="pay-amount"
              type="number"
              min={1}
              step={50000}
              value={paymentAmountIdr}
              onChange={(e) => setPaymentAmountIdr(Number(e.target.value) || 0)}
            />
          </FormField>

          <FormField
            id="pay-method"
            label={p.methodLabel}
            required
            requiredSrLabel={messages.admin.common.required}
          >
            <Select
              id="pay-method"
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(
                  e.target.value as "BANK_TRANSFER" | "CASH" | "QRIS" | "CARD_EXTERNAL" | "OTHER",
                )
              }
            >
              <option value="BANK_TRANSFER">BANK_TRANSFER</option>
              <option value="CASH">CASH</option>
              <option value="QRIS">QRIS</option>
              <option value="CARD_EXTERNAL">CARD_EXTERNAL</option>
              <option value="OTHER">OTHER</option>
            </Select>
          </FormField>

          <FormField id="pay-reference" label={p.referenceLabel}>
            <Input
              id="pay-reference"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="TRX-2026-001"
            />
          </FormField>

          <FormField id="pay-note" label={p.noteLabel}>
            <Input
              id="pay-note"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setRecordPaymentOpen(false)}>
              {messages.admin.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={busyAction === "payment" || paymentAmountIdr <= 0}
            >
              {busyAction === "payment" ? p.submittingPayment : p.submitPayment}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
