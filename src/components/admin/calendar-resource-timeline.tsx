"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Layers,
  List,
  LogIn,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import type { PaymentStatus, ReservationStatus } from "@prisma/client";
import type { CalendarResult } from "@/server/services/calendar-service";
import { addDays, formatDateOnly, parseDateOnly } from "@/lib/dates";
import type { AppLocale, AppMessages } from "@/lib/i18n/messages";
import { formatIdr } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog, Dialog } from "@/components/ui/dialog";
import { FormField, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PaymentStatusBadge, ReservationStatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/view-states";

export type CalendarViewSpan = "week" | "twoWeeks" | "month";

interface CalendarResourceTimelineProps {
  locale: AppLocale;
  messages: AppMessages;
  calendarData: CalendarResult;
  todayString: string;
  currentSpan: CalendarViewSpan;
  startDateString: string;
}

export function CalendarResourceTimeline({
  locale,
  messages,
  calendarData,
  todayString,
  currentSpan,
  startDateString,
}: CalendarResourceTimelineProps) {
  const router = useRouter();
  const { pushToast } = useToast();

  const [viewMode, setViewMode] = React.useState<"timeline" | "list">("timeline");
  const [activeReservationModal, setActiveReservationModal] = React.useState<{
    id: string;
    code: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    status: ReservationStatus;
    paymentStatus: PaymentStatus;
    adults: number;
    children: number;
    unitName: string;
  } | null>(null);

  // Add Block Dialog state
  const [addBlockOpen, setAddBlockOpen] = React.useState(false);
  const [blockUnitId, setBlockUnitId] = React.useState<string>(calendarData.units[0]?.id ?? "");
  const [blockStartDate, setBlockStartDate] = React.useState(todayString);
  const [blockEndDate, setBlockEndDate] = React.useState(
    formatDateOnly(addDays(parseDateOnly(todayString), 2)),
  );
  const [blockReason, setBlockReason] = React.useState<"MAINTENANCE" | "OWNER_USE" | "OTHER">(
    "MAINTENANCE",
  );
  const [blockNote, setBlockNote] = React.useState("");
  const [savingBlock, setSavingBlock] = React.useState(false);
  const [blockError, setBlockError] = React.useState<string | null>(null);

  // Delete Block Dialog state
  const [deletingBlockId, setDeletingBlockId] = React.useState<string | null>(null);
  const [isDeletingBlock, setIsDeletingBlock] = React.useState(false);

  const c = messages.admin.calendarPage;

  // Build calendar days array from fromDate to toDate (exclusive)
  const days = React.useMemo(() => {
    const list: string[] = [];
    const start = parseDateOnly(calendarData.from);
    for (let i = 0; i < calendarData.daysCount; i++) {
      list.push(formatDateOnly(addDays(start, i)));
    }
    return list;
  }, [calendarData.from, calendarData.daysCount]);

  function navigateWindow(direction: "prev" | "next" | "today") {
    let targetStartDate: string;
    const current = parseDateOnly(startDateString);
    const stepDays = currentSpan === "week" ? 7 : currentSpan === "twoWeeks" ? 14 : 30;

    if (direction === "today") {
      targetStartDate = todayString;
    } else if (direction === "prev") {
      targetStartDate = formatDateOnly(addDays(current, -stepDays));
    } else {
      targetStartDate = formatDateOnly(addDays(current, stepDays));
    }

    router.push(`/admin/calendar?span=${currentSpan}&start=${targetStartDate}`);
  }

  function handleSpanChange(span: CalendarViewSpan) {
    router.push(`/admin/calendar?span=${span}&start=${startDateString}`);
  }

  async function handleAddBlock(e: React.FormEvent) {
    e.preventDefault();
    setSavingBlock(true);
    setBlockError(null);

    try {
      const res = await fetch("/api/admin/blocks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          unitId: blockUnitId,
          startDate: blockStartDate,
          endDate: blockEndDate,
          reason: blockReason,
          note: blockNote.trim() || null,
        }),
      });

      const payload = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setBlockError(payload.error?.message ?? "Failed to create block.");
        setSavingBlock(false);
        return;
      }

      setAddBlockOpen(false);
      setBlockNote("");
      setSavingBlock(false);
      pushToast({
        kind: "success",
        title: c.addBlockButton,
        description: `${blockStartDate} → ${blockEndDate}`,
      });
      router.refresh();
    } catch {
      setBlockError("Network error while creating block.");
      setSavingBlock(false);
    }
  }

  async function handleDeleteBlock() {
    if (!deletingBlockId) return;
    setIsDeletingBlock(true);
    try {
      const res = await fetch(`/api/admin/blocks/${deletingBlockId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        pushToast({
          kind: "error",
          title: "Error",
          description: "Failed to delete block.",
        });
        setIsDeletingBlock(false);
        return;
      }

      setDeletingBlockId(null);
      setIsDeletingBlock(false);
      pushToast({
        kind: "success",
        title: c.deleteBlock,
        description: "Maintenance block removed.",
      });
      router.refresh();
    } catch {
      pushToast({
        kind: "error",
        title: "Error",
        description: "Network error while deleting block.",
      });
      setIsDeletingBlock(false);
    }
  }

  // Helper for computing mid-day horizontal offset and width for same-day turnover (DESIGN.md §7.3, TC-U01)
  const totalDays = days.length;
  const dayColWidthPercent = 100 / totalDays;

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {/* Span Switcher: 7d, 14d, Month (TC-U03) */}
          <div className="inline-flex rounded-[8px] border border-gray-100 bg-white p-1">
            <button
              type="button"
              onClick={() => handleSpanChange("week")}
              className={`rounded-[6px] px-3 py-1.5 font-sans text-xs font-medium transition-colors ${
                currentSpan === "week"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {c.viewWeek}
            </button>
            <button
              type="button"
              onClick={() => handleSpanChange("twoWeeks")}
              className={`rounded-[6px] px-3 py-1.5 font-sans text-xs font-medium transition-colors ${
                currentSpan === "twoWeeks"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {c.viewTwoWeeks}
            </button>
            <button
              type="button"
              onClick={() => handleSpanChange("month")}
              className={`rounded-[6px] px-3 py-1.5 font-sans text-xs font-medium transition-colors ${
                currentSpan === "month"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {c.viewMonth}
            </button>
          </div>

          {/* Navigation: Prev, Today, Next (TC-U03) */}
          <div className="inline-flex items-center gap-1 rounded-[8px] border border-gray-100 bg-white p-1">
            <button
              type="button"
              onClick={() => navigateWindow("prev")}
              aria-label={c.prevWindow}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => navigateWindow("today")}
              className="rounded-[6px] px-2.5 py-1 font-sans text-xs font-medium text-gray-800 hover:bg-gray-100"
            >
              {c.todayButton}
            </button>
            <button
              type="button"
              onClick={() => navigateWindow("next")}
              aria-label={c.nextWindow}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <span className="font-display text-base font-semibold text-gray-800 tabular-nums">
            {calendarData.from} → {calendarData.to}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* List-view fallback toggle for accessibility (TC-U05) */}
          <div className="inline-flex rounded-[8px] border border-gray-100 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              aria-label={c.timelineView}
              className={`inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 font-sans text-xs font-medium ${
                viewMode === "timeline"
                  ? "bg-gray-100 text-gray-800"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{c.timelineView}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label={c.listViewFallback}
              className={`inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 font-sans text-xs font-medium ${
                viewMode === "list"
                  ? "bg-gray-100 text-gray-800"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{c.listViewFallback}</span>
            </button>
          </div>

          <Button type="button" variant="secondary" size="sm" onClick={() => setAddBlockOpen(true)}>
            <Wrench className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{c.addBlockButton}</span>
          </Button>

          <Link
            href="/admin/reservations/new"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[6px] bg-blue-600 px-3.5 py-2 font-sans text-xs font-medium text-white transition-colors hover:bg-blue-500"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{c.createReservation}</span>
          </Link>
        </div>
      </div>

      {/* Status Legend (DESIGN.md §7.3, TC-U01, TC-U02 - never color alone) */}
      <div className="flex flex-wrap items-center gap-4 rounded-[8px] border border-gray-100 bg-white px-4 py-2.5 font-sans text-xs text-gray-600">
        <span className="font-semibold text-gray-800">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded-sm bg-status-info-bg border border-status-info-fg/30" />
          <Info className="h-3 w-3 text-status-info-fg" />
          <span>{c.legendConfirmed}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded-sm bg-status-active-bg border border-status-active-fg/30" />
          <LogIn className="h-3 w-3 text-status-active-fg" />
          <span>{c.legendCheckedIn}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded-sm bg-status-neutral-bg border border-gray-600/30" />
          <Clock className="h-3 w-3 text-status-neutral-fg" />
          <span>{c.legendPending}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded-sm border border-gray-600 bg-[repeating-linear-gradient(45deg,#eeeeee,#eeeeee_3px,#d0d0d0_3px,#d0d0d0_6px)]" />
          <Wrench className="h-3 w-3 text-gray-800" />
          <span>{c.legendMaintenance}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-0.5 bg-blue-600" />
          <span>Today marker</span>
        </div>
      </div>

      {calendarData.units.length === 0 ? (
        <EmptyState title={c.emptyCalendarTitle} description={c.emptyCalendarDescription} />
      ) : viewMode === "list" ? (
        /* Accessible List-View Fallback (TC-U05) */
        <div className="space-y-6">
          {calendarData.units.map((unit) => (
            <div
              key={unit.id}
              className="space-y-3 rounded-[10px] border border-gray-100 bg-white p-5"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-gray-800">
                    {locale === "id" ? unit.nameId : unit.nameEn}
                  </h3>
                  <p className="font-sans text-xs text-gray-600">
                    Max {unit.maxGuests} {messages.public.guests.toLowerCase()} ·{" "}
                    {formatIdr(unit.baseRateIdr, locale)}/n
                  </p>
                </div>
                <Link
                  href={`/admin/reservations/new?unitId=${unit.id}`}
                  className="inline-flex min-h-9 items-center rounded-[6px] border border-gray-100 bg-white px-3 py-1.5 font-sans text-xs font-medium text-gray-800 hover:bg-gray-100"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {c.createReservation}
                </Link>
              </div>

              {unit.reservations.length === 0 && unit.blocks.length === 0 ? (
                <p className="font-sans text-xs text-gray-600 py-2">
                  No reservations or blocks in this period.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference / Label</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unit.reservations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs font-medium">Reservation</TableCell>
                        <TableCell className="text-xs text-gray-800">
                          <Link
                            href={`/admin/reservations/${r.id}`}
                            className="text-blue-600 hover:underline font-medium tabular-nums"
                          >
                            {r.code}
                          </Link>{" "}
                          ({r.guestName})
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 tabular-nums">
                          {r.checkIn} → {r.checkOut}
                        </TableCell>
                        <TableCell>
                          <ReservationStatusBadge status={r.status} locale={locale} />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/reservations/${r.id}`}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                    {unit.blocks.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="text-xs font-medium">Unit Block</TableCell>
                        <TableCell className="text-xs text-gray-800">
                          {b.reason} {b.note ? `(${b.note})` : ""}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 tabular-nums">
                          {b.startDate} → {b.endDate}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800">
                            <Wrench className="h-3 w-3" />
                            {b.reason}
                          </span>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setDeletingBlockId(b.id)}
                            className="text-xs text-status-danger-fg hover:underline"
                          >
                            {c.deleteBlock}
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Timeline Resource Grid (DESIGN.md §7.3, TC-U01, TC-U02, TC-U04) */
        <div className="overflow-hidden rounded-[10px] border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <div className="min-w-[850px]">
              {/* Sticky Dates Header */}
              <div className="sticky top-0 z-20 flex border-b border-gray-100 bg-white">
                <div className="sticky left-0 z-30 w-48 shrink-0 border-r border-gray-100 bg-white px-4 py-3 font-display text-sm font-semibold text-gray-800">
                  Villa Unit
                </div>

                <div className="flex flex-1">
                  {days.map((dayStr) => {
                    const dateObj = parseDateOnly(dayStr);
                    const isToday = dayStr === todayString;
                    const dayOfWeek = dateObj.getUTCDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const weekdayName = dateObj.toLocaleDateString(
                      locale === "id" ? "id-ID" : "en-US",
                      {
                        weekday: "narrow",
                        timeZone: "UTC",
                      },
                    );
                    const dayNum = dateObj.getUTCDate();

                    return (
                      <div
                        key={dayStr}
                        style={{ width: `${dayColWidthPercent}%` }}
                        className={`relative flex flex-col items-center justify-center border-r border-gray-100 py-2.5 text-center transition-colors ${
                          isWeekend ? "bg-gray-100/40" : "bg-white"
                        }`}
                      >
                        {isToday ? (
                          <div className="absolute top-0 bottom-0 left-0 w-0.5 bg-blue-600 z-10" />
                        ) : null}
                        <span className="font-sans text-[11px] font-medium text-gray-600 uppercase">
                          {weekdayName}
                        </span>
                        <span
                          className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full font-sans text-xs font-semibold tabular-nums ${
                            isToday ? "bg-blue-600 text-white" : "text-gray-800"
                          }`}
                        >
                          {dayNum}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Unit Rows */}
              <div className="divide-y divide-gray-100">
                {calendarData.units.map((unit) => (
                  <div key={unit.id} className="group relative flex min-h-[76px] items-stretch">
                    {/* Sticky Unit Column */}
                    <div className="sticky left-0 z-10 flex w-48 shrink-0 flex-col justify-center border-r border-gray-100 bg-white px-4 py-2.5 group-hover:bg-gray-100/30">
                      <Link
                        href={`/admin/units/${unit.id}`}
                        className="font-display text-sm font-semibold text-gray-800 hover:text-blue-600 hover:underline"
                      >
                        {locale === "id" ? unit.nameId : unit.nameEn}
                      </Link>
                      <span className="font-sans text-[11px] text-gray-600 tabular-nums">
                        Max {unit.maxGuests}p · {formatIdr(unit.baseRateIdr, locale)}
                      </span>
                    </div>

                    {/* Timeline Track Area */}
                    <div className="relative flex flex-1 items-center">
                      {/* Grid background columns */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {days.map((dayStr) => {
                          const dateObj = parseDateOnly(dayStr);
                          const isWeekend = dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6;
                          const isToday = dayStr === todayString;
                          return (
                            <div
                              key={dayStr}
                              style={{ width: `${dayColWidthPercent}%` }}
                              className={`relative h-full border-r border-gray-100/80 ${
                                isWeekend ? "bg-gray-100/25" : ""
                              }`}
                            >
                              {isToday ? (
                                <div className="absolute top-0 bottom-0 left-0 w-0.5 bg-blue-600 z-10" />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      {/* Clickable Empty Range cell overlay to create reservation (TC-U06) */}
                      <div className="absolute inset-0 flex">
                        {days.map((dayStr) => (
                          <Link
                            key={dayStr}
                            href={`/admin/reservations/new?unitId=${unit.id}&checkIn=${dayStr}`}
                            title={`Create reservation on ${dayStr}`}
                            style={{ width: `${dayColWidthPercent}%` }}
                            className="h-full hover:bg-blue-600/5 transition-colors"
                          />
                        ))}
                      </div>

                      {/* Reservation Bars with Same-Day Turnover Midpoint (TC-U01, DESIGN §7.3) */}
                      {unit.reservations.map((res) => {
                        const startIndex = days.indexOf(res.checkIn);
                        const endIndex = days.indexOf(res.checkOut);

                        // If out of window completely, skip
                        if (endIndex < 0 && startIndex < 0) {
                          const resIn = parseDateOnly(res.checkIn).getTime();
                          const resOut = parseDateOnly(res.checkOut).getTime();
                          const winIn = parseDateOnly(calendarData.from).getTime();
                          const winOut = parseDateOnly(calendarData.to).getTime();
                          if (resOut <= winIn || resIn >= winOut) return null;
                        }

                        const startCol = startIndex >= 0 ? startIndex : 0;
                        const endCol = endIndex >= 0 ? endIndex : totalDays;

                        // Same-day turnover: start at midpoint (50%) of check-in, end at midpoint (50%) of check-out!
                        const leftPercent =
                          startIndex >= 0 ? (startCol + 0.5) * dayColWidthPercent : 0;
                        const rightPercent =
                          endIndex >= 0 ? (endCol + 0.5) * dayColWidthPercent : 100;
                        const widthPercent = Math.max(
                          rightPercent - leftPercent,
                          dayColWidthPercent * 0.5,
                        );

                        const isPending = res.status === "PENDING";
                        const isCheckedIn = res.status === "CHECKED_IN";
                        const isCancelled = res.status === "CANCELLED";

                        const barClasses = isPending
                          ? "bg-status-neutral-bg border-status-neutral-fg/40 text-status-neutral-fg"
                          : isCheckedIn
                            ? "bg-status-active-bg border-status-active-fg/40 text-status-active-fg"
                            : isCancelled
                              ? "bg-status-danger-bg border-status-danger-fg/40 text-status-danger-fg"
                              : "bg-status-info-bg border-status-info-fg/40 text-status-info-fg";

                        return (
                          <div
                            key={res.id}
                            style={{
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`,
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Reservation ${res.code}, guest ${res.guestName}, ${res.checkIn} to ${res.checkOut}, ${res.status}`}
                            onClick={() =>
                              setActiveReservationModal({
                                ...res,
                                unitName: locale === "id" ? unit.nameId : unit.nameEn,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                setActiveReservationModal({
                                  ...res,
                                  unitName: locale === "id" ? unit.nameId : unit.nameEn,
                                });
                              }
                            }}
                            className={`absolute z-10 flex h-10 items-center justify-between gap-1.5 overflow-hidden rounded-[6px] border px-2 py-1 shadow-xs transition-transform hover:scale-[1.01] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer ${barClasses}`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              {isCheckedIn ? (
                                <LogIn className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              ) : isPending ? (
                                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              ) : (
                                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              )}
                              <span className="font-sans text-xs font-semibold tabular-nums truncate">
                                {res.code}
                              </span>
                              <span className="font-sans text-[11px] truncate opacity-85 hidden sm:inline">
                                · {res.guestName}
                              </span>
                            </div>
                            <span className="shrink-0 font-sans text-[10px] uppercase font-bold opacity-80">
                              {res.paymentStatus}
                            </span>
                          </div>
                        );
                      })}

                      {/* Maintenance / Admin Blocks (TC-U02, DESIGN §7.3) */}
                      {unit.blocks.map((block) => {
                        const startIndex = days.indexOf(block.startDate);
                        const endIndex = days.indexOf(block.endDate);

                        const startCol = startIndex >= 0 ? startIndex : 0;
                        const endCol = endIndex >= 0 ? endIndex : totalDays;

                        const leftPercent = startCol * dayColWidthPercent;
                        const rightPercent = endCol * dayColWidthPercent;
                        const widthPercent = Math.max(
                          rightPercent - leftPercent,
                          dayColWidthPercent,
                        );

                        return (
                          <div
                            key={block.id}
                            style={{
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`,
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Maintenance block: ${block.reason}, ${block.startDate} to ${block.endDate}`}
                            onClick={() => setDeletingBlockId(block.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                setDeletingBlockId(block.id);
                              }
                            }}
                            className="absolute z-10 flex h-9 items-center justify-between gap-1 rounded-[6px] border border-gray-600/40 bg-[repeating-linear-gradient(45deg,#f5f5f5,#f5f5f5_6px,#e5e5e5_6px,#e5e5e5_12px)] px-2 font-sans text-xs font-medium text-gray-800 shadow-xs cursor-pointer hover:border-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <Wrench
                                className="h-3.5 w-3.5 shrink-0 text-gray-800"
                                aria-hidden="true"
                              />
                              <span className="truncate">{block.reason}</span>
                            </div>
                            <Trash2 className="h-3 w-3 shrink-0 text-gray-600 hover:text-status-danger-fg" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick View Reservation Modal (TC-U04) */}
      {activeReservationModal ? (
        <Dialog
          open={activeReservationModal !== null}
          onClose={() => setActiveReservationModal(null)}
          title={`Reservation ${activeReservationModal.code}`}
        >
          <div className="space-y-4 font-sans text-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <p className="text-xs text-gray-600">Villa Unit</p>
                <p className="font-semibold text-gray-800">{activeReservationModal.unitName}</p>
              </div>
              <div className="flex gap-1.5">
                <ReservationStatusBadge status={activeReservationModal.status} locale={locale} />
                <PaymentStatusBadge status={activeReservationModal.paymentStatus} locale={locale} />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-gray-600">Guest</dt>
                <dd className="font-medium text-gray-800">{activeReservationModal.guestName}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Stay Dates</dt>
                <dd className="font-medium text-gray-800 tabular-nums">
                  {activeReservationModal.checkIn} → {activeReservationModal.checkOut}
                </dd>
              </div>
              <div>
                <dt className="text-gray-600">Guests</dt>
                <dd className="font-medium text-gray-800">
                  {activeReservationModal.adults + activeReservationModal.children} guests
                </dd>
              </div>
            </dl>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setActiveReservationModal(null)}
              >
                Close
              </Button>
              <Link
                href={`/admin/reservations/${activeReservationModal.id}`}
                className="inline-flex min-h-11 items-center justify-center rounded-[6px] bg-blue-600 px-4 py-2.5 font-sans text-sm font-medium text-white hover:bg-blue-500"
              >
                Open Full Detail
              </Link>
            </div>
          </div>
        </Dialog>
      ) : null}

      {/* Add Block Dialog */}
      <Dialog
        open={addBlockOpen}
        onClose={() => setAddBlockOpen(false)}
        title={c.dialogAddBlockTitle}
      >
        <form onSubmit={handleAddBlock} className="space-y-4">
          {blockError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[6px] border border-status-danger-fg/30 bg-status-danger-bg p-3 font-sans text-xs text-status-danger-fg"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{blockError}</span>
            </div>
          ) : null}

          <FormField
            id="block-unit"
            label="Villa Unit"
            required
            requiredSrLabel={messages.admin.common.required}
          >
            <Select
              id="block-unit"
              value={blockUnitId}
              onChange={(e) => setBlockUnitId(e.target.value)}
            >
              {calendarData.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {locale === "id" ? u.nameId : u.nameEn}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="block-start"
              label={c.blockStartDate}
              required
              requiredSrLabel={messages.admin.common.required}
            >
              <Input
                id="block-start"
                type="date"
                value={blockStartDate}
                onChange={(e) => setBlockStartDate(e.target.value)}
              />
            </FormField>

            <FormField
              id="block-end"
              label={c.blockEndDate}
              required
              requiredSrLabel={messages.admin.common.required}
            >
              <Input
                id="block-end"
                type="date"
                value={blockEndDate}
                onChange={(e) => setBlockEndDate(e.target.value)}
              />
            </FormField>
          </div>

          <FormField id="block-reason" label={c.blockReason} required>
            <Select
              id="block-reason"
              value={blockReason}
              onChange={(e) =>
                setBlockReason(e.target.value as "MAINTENANCE" | "OWNER_USE" | "OTHER")
              }
            >
              <option value="MAINTENANCE">{c.blockReasonMaintenance}</option>
              <option value="OWNER_USE">{c.blockReasonOwner}</option>
              <option value="OTHER">{c.blockReasonOther}</option>
            </Select>
          </FormField>

          <FormField id="block-note" label={c.blockNote}>
            <Input
              id="block-note"
              value={blockNote}
              onChange={(e) => setBlockNote(e.target.value)}
              placeholder="e.g. AC servicing and deck repainting"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAddBlockOpen(false)}>
              {messages.admin.common.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={savingBlock}>
              {savingBlock ? c.submittingBlock : c.addBlockButton}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Block Confirmation Dialog */}
      <ConfirmActionDialog
        open={deletingBlockId !== null}
        onClose={() => setDeletingBlockId(null)}
        title={c.deleteBlockConfirmTitle}
        description={c.deleteBlockConfirmDescription}
        confirmActionLabel={c.deleteBlock}
        isDestructive
        isSubmitting={isDeletingBlock}
        onConfirm={handleDeleteBlock}
      />
    </div>
  );
}
