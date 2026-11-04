"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CreditCard,
  Download,
  FileText,
  Filter,
  LogIn,
  LogOut,
  Printer,
  TrendingUp,
} from "lucide-react";
import type {
  ArrivalsDeparturesResult,
  OccupancyReportResult,
  PaymentsReportResult,
  ReservationsReportResult,
} from "@/server/services/report-service";
import type { AppLocale, AppMessages } from "@/lib/i18n/messages";
import { formatIdr } from "@/lib/money";
import { Button } from "@/components/ui/button";
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
import { EmptyState } from "@/components/ui/view-states";

export type ReportTab = "reservations" | "payments" | "occupancy" | "arrivals";

interface UnitOption {
  id: string;
  slug: string;
  nameEn: string;
  nameId: string;
}

interface ReportsClientProps {
  currentTab: ReportTab;
  locale: AppLocale;
  messages: AppMessages;
  todayString: string;
  units: UnitOption[];
  reservationsReport?: ReservationsReportResult;
  paymentsReport?: PaymentsReportResult;
  occupancyReport?: OccupancyReportResult;
  arrivalsReport?: ArrivalsDeparturesResult;
  fromParam: string;
  toParam: string;
  unitIdParam?: string;
  statusParam?: string;
  paymentStatusParam?: string;
}

export function ReportsClient({
  currentTab,
  locale,
  messages,
  todayString,
  units,
  reservationsReport,
  paymentsReport,
  occupancyReport,
  arrivalsReport,
  fromParam,
  toParam,
  unitIdParam = "",
  statusParam = "",
  paymentStatusParam = "",
}: ReportsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rMessages = messages.admin.reportsPage;

  // Local filter states
  const [from, setFrom] = React.useState(fromParam);
  const [to, setTo] = React.useState(toParam);
  const [unitId, setUnitId] = React.useState(unitIdParam);
  const [status, setStatus] = React.useState(statusParam);
  const [paymentStatus, setPaymentStatus] = React.useState(paymentStatusParam);

  function applyFilters(newOverrides: Record<string, string | undefined> = {}) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", currentTab);
    params.set("from", newOverrides.from !== undefined ? newOverrides.from : from);
    params.set("to", newOverrides.to !== undefined ? newOverrides.to : to);

    if (newOverrides.unitId !== undefined) {
      if (newOverrides.unitId) params.set("unitId", newOverrides.unitId);
      else params.delete("unitId");
    } else if (unitId) {
      params.set("unitId", unitId);
    } else {
      params.delete("unitId");
    }

    if (newOverrides.status !== undefined) {
      if (newOverrides.status) params.set("status", newOverrides.status);
      else params.delete("status");
    } else if (status) {
      params.set("status", status);
    } else {
      params.delete("status");
    }

    if (newOverrides.paymentStatus !== undefined) {
      if (newOverrides.paymentStatus) params.set("paymentStatus", newOverrides.paymentStatus);
      else params.delete("paymentStatus");
    } else if (paymentStatus) {
      params.set("paymentStatus", paymentStatus);
    } else {
      params.delete("paymentStatus");
    }

    router.push(`/admin/reports?${params.toString()}`);
  }

  function handleTabChange(tab: ReportTab) {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("from", from);
    params.set("to", to);
    if (unitId && tab === "reservations") params.set("unitId", unitId);
    router.push(`/admin/reports?${params.toString()}`);
  }

  function handlePreset(preset: "thisMonth" | "lastMonth" | "next30Days") {
    const [year, month] = todayString.split("-").map(Number);
    let newFrom = from;
    let newTo = to;

    if (preset === "thisMonth") {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 0));
      newFrom = start.toISOString().slice(0, 10);
      newTo = end.toISOString().slice(0, 10);
    } else if (preset === "lastMonth") {
      const start = new Date(Date.UTC(year, month - 2, 1));
      const end = new Date(Date.UTC(year, month - 1, 0));
      newFrom = start.toISOString().slice(0, 10);
      newTo = end.toISOString().slice(0, 10);
    } else if (preset === "next30Days") {
      const start = new Date(todayString);
      const end = new Date(start.getTime() + 30 * 86400000);
      newFrom = todayString;
      newTo = end.toISOString().slice(0, 10);
    }

    setFrom(newFrom);
    setTo(newTo);
    applyFilters({ from: newFrom, to: newTo });
  }

  function getCsvUrl(): string {
    const reportMap: Record<ReportTab, string> = {
      reservations: "reservations",
      payments: "payments",
      occupancy: "occupancy",
      arrivals: "arrivals-departures",
    };
    const reportName = reportMap[currentTab];
    const sp = new URLSearchParams();
    sp.set("from", from);
    sp.set("to", to);
    sp.set("locale", locale);
    if (unitId && currentTab === "reservations") sp.set("unitId", unitId);
    if (status && currentTab === "reservations") sp.set("status", status);
    if (paymentStatus && currentTab === "reservations") sp.set("paymentStatus", paymentStatus);

    return `/api/admin/reports/${reportName}.csv?${sp.toString()}`;
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Print only header */}
      <div className="hidden print:block mb-6 border-b border-gray-800 pb-4">
        <h1 className="font-display text-2xl font-bold text-gray-900">Sagara Villas</h1>
        <p className="font-sans text-sm text-gray-700">
          {currentTab === "reservations" && rMessages.tabReservations}
          {currentTab === "payments" && rMessages.tabPayments}
          {currentTab === "occupancy" && rMessages.tabOccupancy}
          {currentTab === "arrivals" && rMessages.tabArrivalsDepartures}
          {" · "}
          {from} → {to}
        </p>
        <p className="font-sans text-xs text-gray-500 mt-1">
          {rMessages.printGeneratedOn.replace("{date}", todayString)}
        </p>
      </div>

      {/* Screen action bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        {/* Tab Navigation */}
        <nav aria-label="Report types" className="flex space-x-1 border-b border-gray-200">
          <button
            type="button"
            onClick={() => handleTabChange("reservations")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-sm font-medium transition-colors ${
              currentTab === "reservations"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>{rMessages.tabReservations}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("payments")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-sm font-medium transition-colors ${
              currentTab === "payments"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>{rMessages.tabPayments}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("occupancy")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-sm font-medium transition-colors ${
              currentTab === "occupancy"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>{rMessages.tabOccupancy}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("arrivals")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-sm font-medium transition-colors ${
              currentTab === "arrivals"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
            }`}
          >
            <LogIn className="h-4 w-4" />
            <span>{rMessages.tabArrivalsDepartures}</span>
          </button>
        </nav>

        {/* Export & Print actions */}
        <div className="flex items-center gap-2">
          <a
            href={getCsvUrl()}
            download
            className="inline-flex min-h-11 items-center gap-2 rounded-[6px] border border-gray-600/40 bg-white px-3.5 py-2 font-sans text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Download className="h-4 w-4" />
            <span>{rMessages.exportCsv}</span>
          </a>
          <Button variant="secondary" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            <span>{rMessages.print}</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <FormField id="rep-from" label={rMessages.fromLabel}>
              <Input
                id="rep-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </FormField>
          </div>

          <div className="w-40">
            <FormField id="rep-to" label={rMessages.toLabel}>
              <Input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </FormField>
          </div>

          {currentTab === "reservations" && (
            <>
              <div className="w-48">
                <FormField id="rep-unit" label={rMessages.unitFilter}>
                  <Select id="rep-unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                    <option value="">{rMessages.allUnits}</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {locale === "id" ? u.nameId : u.nameEn}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <div className="w-40">
                <FormField id="rep-status" label={rMessages.statusFilter}>
                  <Select
                    id="rep-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">{messages.admin.common.all}</option>
                    <option value="CONFIRMED">{messages.statuses.reservation.CONFIRMED}</option>
                    <option value="PENDING">{messages.statuses.reservation.PENDING}</option>
                    <option value="CHECKED_IN">{messages.statuses.reservation.CHECKED_IN}</option>
                    <option value="CHECKED_OUT">{messages.statuses.reservation.CHECKED_OUT}</option>
                    <option value="CANCELLED">{messages.statuses.reservation.CANCELLED}</option>
                  </Select>
                </FormField>
              </div>

              <div className="w-40">
                <FormField id="rep-payment" label={rMessages.paymentFilter}>
                  <Select
                    id="rep-payment"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                  >
                    <option value="">{messages.admin.common.all}</option>
                    <option value="UNPAID">{messages.statuses.payment.UNPAID}</option>
                    <option value="PARTIAL">{messages.statuses.payment.PARTIAL}</option>
                    <option value="PAID">{messages.statuses.payment.PAID}</option>
                  </Select>
                </FormField>
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={() => applyFilters()}>
              <Filter className="h-4 w-4" />
              <span>{rMessages.applyFilter}</span>
            </Button>
            <div className="hidden sm:flex items-center gap-1 border-l border-gray-200 pl-3">
              <Button variant="ghost" size="sm" onClick={() => handlePreset("thisMonth")}>
                {rMessages.datePresetThisMonth}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handlePreset("lastMonth")}>
                {rMessages.datePresetLastMonth}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handlePreset("next30Days")}>
                {rMessages.datePresetNext30Days}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Report View: R1 Reservations */}
      {currentTab === "reservations" && reservationsReport && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <section
            aria-label="Reservations summary metrics"
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                {rMessages.kpiTotalBookings}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-gray-800 tabular-nums">
                {reservationsReport.totals.totalCount}
              </p>
            </div>
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                {rMessages.kpiBookedValue}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-blue-600 tabular-nums">
                {formatIdr(reservationsReport.totals.bookedValueIdr, locale)}
              </p>
            </div>
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                {rMessages.kpiTotalPaid}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-emerald-600 tabular-nums">
                {formatIdr(reservationsReport.totals.totalPaidIdr, locale)}
              </p>
            </div>
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                {rMessages.kpiTotalNights}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-gray-800 tabular-nums">
                {reservationsReport.totals.totalNights} ({reservationsReport.totals.totalGuests}{" "}
                {messages.public.guests.toLowerCase()})
              </p>
            </div>
          </section>

          {/* Table */}
          {reservationsReport.reservations.length === 0 ? (
            <EmptyState
              title={rMessages.emptyReportTitle}
              description={rMessages.emptyReportDescription}
            />
          ) : (
            <div className="overflow-hidden rounded-[8px] border border-gray-100 bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{rMessages.colCode}</TableHead>
                    <TableHead>{rMessages.colGuest}</TableHead>
                    <TableHead>{rMessages.colUnit}</TableHead>
                    <TableHead>{rMessages.colDates}</TableHead>
                    <TableHead>{rMessages.colStatus}</TableHead>
                    <TableHead>{rMessages.colPayment}</TableHead>
                    <TableHead numeric>{rMessages.colTotal}</TableHead>
                    <TableHead numeric>{rMessages.colNetPaid}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservationsReport.reservations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        <Link
                          href={`/admin/reservations/${r.id}`}
                          className="text-blue-600 hover:underline print:text-black print:no-underline"
                        >
                          {r.code}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium text-xs">
                        <div>{r.guestName}</div>
                        <div className="text-[11px] text-gray-500 font-mono">{r.guestEmail}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {locale === "id" ? r.unitNameId : r.unitNameEn}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-gray-600">
                        {r.checkIn} → {r.checkOut} ({r.nights}n)
                      </TableCell>
                      <TableCell>
                        <ReservationStatusBadge status={r.status} locale={locale} />
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={r.paymentStatus} locale={locale} />
                      </TableCell>
                      <TableCell numeric className="font-medium text-xs tabular-nums">
                        {formatIdr(r.totalIdr, locale)}
                      </TableCell>
                      <TableCell numeric className="text-xs tabular-nums text-emerald-700">
                        {formatIdr(r.netPaidIdr, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-50 font-semibold text-xs border-t-2 border-gray-200">
                    <TableCell colSpan={6} className="uppercase text-gray-700">
                      TOTAL ({reservationsReport.totals.totalCount} reservations)
                    </TableCell>
                    <TableCell numeric className="tabular-nums text-blue-600">
                      {formatIdr(reservationsReport.totals.bookedValueIdr, locale)}
                    </TableCell>
                    <TableCell numeric className="tabular-nums text-emerald-700">
                      {formatIdr(reservationsReport.totals.totalPaidIdr, locale)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Report View: R2 Payments & Balances */}
      {currentTab === "payments" && paymentsReport && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <section
            aria-label="Payments summary metrics"
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                {rMessages.kpiCashReceived}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-emerald-600 tabular-nums">
                {formatIdr(paymentsReport.totals.cashReceivedIdr, locale)}
              </p>
            </div>
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                {rMessages.kpiGrossPayments}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-gray-800 tabular-nums">
                {formatIdr(paymentsReport.totals.grossPaymentsIdr, locale)}
              </p>
            </div>
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                {rMessages.kpiGrossRefunds}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-rose-600 tabular-nums">
                {formatIdr(paymentsReport.totals.grossRefundsIdr, locale)}
              </p>
            </div>
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                {rMessages.kpiOutstanding}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-amber-700 tabular-nums">
                {formatIdr(paymentsReport.totals.totalOutstandingBalanceIdr, locale)}
              </p>
            </div>
          </section>

          {/* Cash by Method Table */}
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-gray-800">
              {rMessages.paymentsSummaryTitle}
            </h2>
            <div className="overflow-hidden rounded-[8px] border border-gray-100 bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{rMessages.colMethod}</TableHead>
                    <TableHead numeric>{rMessages.colTransactions}</TableHead>
                    <TableHead numeric>{rMessages.kpiGrossPayments}</TableHead>
                    <TableHead numeric>{rMessages.kpiGrossRefunds}</TableHead>
                    <TableHead numeric>{rMessages.kpiCashReceived}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsReport.byMethod.map((m) => (
                    <TableRow key={m.method}>
                      <TableCell className="font-medium text-xs">
                        <span className="font-mono">{m.method}</span>
                      </TableCell>
                      <TableCell numeric className="text-xs tabular-nums text-gray-600">
                        {m.paymentsCount} payments / {m.refundsCount} refunds
                      </TableCell>
                      <TableCell numeric className="text-xs tabular-nums">
                        {formatIdr(m.paymentsIdr, locale)}
                      </TableCell>
                      <TableCell numeric className="text-xs tabular-nums text-rose-600">
                        {m.refundsIdr > 0 ? formatIdr(m.refundsIdr, locale) : "—"}
                      </TableCell>
                      <TableCell
                        numeric
                        className="text-xs font-semibold tabular-nums text-emerald-700"
                      >
                        {formatIdr(m.netIdr, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-50 font-semibold text-xs border-t-2 border-gray-200">
                    <TableCell className="uppercase text-gray-700">TOTAL</TableCell>
                    <TableCell numeric className="tabular-nums">
                      {paymentsReport.totals.totalPaymentsCount}
                    </TableCell>
                    <TableCell numeric className="tabular-nums">
                      {formatIdr(paymentsReport.totals.grossPaymentsIdr, locale)}
                    </TableCell>
                    <TableCell numeric className="tabular-nums text-rose-600">
                      {formatIdr(paymentsReport.totals.grossRefundsIdr, locale)}
                    </TableCell>
                    <TableCell numeric className="tabular-nums text-emerald-700">
                      {formatIdr(paymentsReport.totals.cashReceivedIdr, locale)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Outstanding Balances Table */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-gray-800">
                {rMessages.outstandingListTitle}
              </h2>
              <span className="font-sans text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-[6px] px-2.5 py-1 font-medium">
                {rMessages.kpiOutstanding}:{" "}
                {formatIdr(paymentsReport.totals.totalOutstandingBalanceIdr, locale)}
              </span>
            </div>

            {paymentsReport.outstandingBalances.length === 0 ? (
              <EmptyState
                title="All active reservations are fully paid"
                description="There are no outstanding balances pending settlement."
              />
            ) : (
              <div className="overflow-hidden rounded-[8px] border border-gray-100 bg-white shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{rMessages.colCode}</TableHead>
                      <TableHead>{rMessages.colGuest}</TableHead>
                      <TableHead>{rMessages.colUnit}</TableHead>
                      <TableHead>{rMessages.colDates}</TableHead>
                      <TableHead>{rMessages.colStatus}</TableHead>
                      <TableHead>{rMessages.colPayment}</TableHead>
                      <TableHead numeric>{rMessages.colTotal}</TableHead>
                      <TableHead numeric>{rMessages.colNetPaid}</TableHead>
                      <TableHead numeric>{rMessages.colOutstanding}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentsReport.outstandingBalances.map((b) => (
                      <TableRow key={b.reservationId}>
                        <TableCell className="font-mono text-xs font-medium">
                          <Link
                            href={`/admin/reservations/${b.reservationId}`}
                            className="text-blue-600 hover:underline print:text-black print:no-underline"
                          >
                            {b.code}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium text-xs">{b.guestName}</TableCell>
                        <TableCell className="text-xs">
                          {locale === "id" ? b.unitNameId : b.unitNameEn}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-gray-600">
                          {b.checkIn} → {b.checkOut}
                        </TableCell>
                        <TableCell>
                          <ReservationStatusBadge status={b.status} locale={locale} />
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={b.paymentStatus} locale={locale} />
                        </TableCell>
                        <TableCell numeric className="text-xs tabular-nums">
                          {formatIdr(b.totalIdr, locale)}
                        </TableCell>
                        <TableCell numeric className="text-xs tabular-nums text-emerald-700">
                          {formatIdr(b.netPaidIdr, locale)}
                        </TableCell>
                        <TableCell
                          numeric
                          className="font-semibold text-xs tabular-nums text-rose-600"
                        >
                          {formatIdr(b.outstandingIdr, locale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report View: R3 Occupancy */}
      {currentTab === "occupancy" && occupancyReport && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <section
            aria-label="Occupancy summary metrics"
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                {rMessages.kpiPortfolioOccupancy}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-teal-700 tabular-nums">
                {occupancyReport.totals.overallOccupancyPercent}%
              </p>
            </div>
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                {rMessages.kpiOccupiedNights}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-gray-800 tabular-nums">
                {occupancyReport.totals.totalOccupiedNights}
              </p>
            </div>
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                {rMessages.kpiAvailableNights}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-gray-800 tabular-nums">
                {occupancyReport.totals.totalAvailableNights}
              </p>
            </div>
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                {rMessages.colBlocked}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-gray-600 tabular-nums">
                {occupancyReport.totals.totalBlockedNights}
              </p>
            </div>
          </section>

          {/* Occupancy Table */}
          <div className="overflow-hidden rounded-[8px] border border-gray-100 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{rMessages.colUnit}</TableHead>
                  <TableHead numeric>{rMessages.colCalendarDays}</TableHead>
                  <TableHead numeric>{rMessages.colBlocked}</TableHead>
                  <TableHead numeric>{rMessages.colAvailable}</TableHead>
                  <TableHead numeric>{rMessages.colOccupied}</TableHead>
                  <TableHead numeric>{rMessages.colOccupancyRate}</TableHead>
                  <TableHead numeric>{rMessages.colBaseRate}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {occupancyReport.units.map((u) => (
                  <TableRow key={u.unitId}>
                    <TableCell className="font-medium text-xs">
                      <div>{locale === "id" ? u.nameId : u.nameEn}</div>
                      <div className="text-[11px] font-mono text-gray-500">/{u.slug}</div>
                    </TableCell>
                    <TableCell numeric className="text-xs tabular-nums text-gray-600">
                      {u.totalDays}
                    </TableCell>
                    <TableCell numeric className="text-xs tabular-nums text-gray-600">
                      {u.blockedNights > 0 ? u.blockedNights : "0"}
                    </TableCell>
                    <TableCell numeric className="text-xs tabular-nums">
                      {u.availableNights}
                    </TableCell>
                    <TableCell numeric className="text-xs tabular-nums font-medium text-gray-800">
                      {u.occupiedNights}
                    </TableCell>
                    <TableCell numeric className="text-xs font-semibold tabular-nums text-teal-700">
                      {u.occupancyPercent}%
                    </TableCell>
                    <TableCell numeric className="text-xs tabular-nums text-gray-600">
                      {formatIdr(u.baseRateIdr, locale)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 font-semibold text-xs border-t-2 border-gray-200">
                  <TableCell className="uppercase text-gray-700">
                    PORTFOLIO TOTAL ({occupancyReport.totals.totalUnits} active units)
                  </TableCell>
                  <TableCell numeric className="tabular-nums">
                    {occupancyReport.totals.totalCalendarDays}
                  </TableCell>
                  <TableCell numeric className="tabular-nums">
                    {occupancyReport.totals.totalBlockedNights}
                  </TableCell>
                  <TableCell numeric className="tabular-nums">
                    {occupancyReport.totals.totalAvailableNights}
                  </TableCell>
                  <TableCell numeric className="tabular-nums font-bold">
                    {occupancyReport.totals.totalOccupiedNights}
                  </TableCell>
                  <TableCell numeric className="tabular-nums text-teal-700 text-sm font-bold">
                    {occupancyReport.totals.overallOccupancyPercent}%
                  </TableCell>
                  <TableCell numeric>—</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Report View: R4 Arrivals & Departures */}
      {currentTab === "arrivals" && arrivalsReport && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <section
            aria-label="Arrivals and departures summary metrics"
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                {rMessages.kpiTotalArrivals}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-blue-600 tabular-nums">
                {arrivalsReport.totals.totalArrivals}
              </p>
            </div>
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                Checked-In Arrivals
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-indigo-600 tabular-nums">
                {arrivalsReport.totals.checkedInArrivals}
              </p>
            </div>
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                {rMessages.kpiTotalDepartures}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-emerald-600 tabular-nums">
                {arrivalsReport.totals.totalDepartures}
              </p>
            </div>
            <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-sans text-xs font-medium uppercase text-gray-500">
                Checked-Out Departures
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-gray-800 tabular-nums">
                {arrivalsReport.totals.checkedOutDepartures}
              </p>
            </div>
          </section>

          {/* Arrivals Table */}
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-gray-800 flex items-center gap-2">
              <LogIn className="h-5 w-5 text-blue-600" />
              <span>
                {rMessages.arrivalsListTitle} ({arrivalsReport.arrivals.length})
              </span>
            </h2>

            {arrivalsReport.arrivals.length === 0 ? (
              <EmptyState
                title="No arrivals in this period"
                description="No guest check-ins scheduled for the selected date range."
              />
            ) : (
              <div className="overflow-hidden rounded-[8px] border border-gray-100 bg-white shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{rMessages.colCode}</TableHead>
                      <TableHead>{rMessages.colGuest}</TableHead>
                      <TableHead>{rMessages.colContact}</TableHead>
                      <TableHead>{rMessages.colUnit}</TableHead>
                      <TableHead>{rMessages.colDates}</TableHead>
                      <TableHead>{rMessages.colStatus}</TableHead>
                      <TableHead>{rMessages.colPayment}</TableHead>
                      <TableHead>{rMessages.colNotes}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arrivalsReport.arrivals.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs font-medium">
                          <Link
                            href={`/admin/reservations/${a.id}`}
                            className="text-blue-600 hover:underline print:text-black print:no-underline"
                          >
                            {a.code}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium text-xs">{a.guestName}</TableCell>
                        <TableCell className="text-xs text-gray-600 font-mono">
                          {a.guestPhone ?? a.guestEmail}
                        </TableCell>
                        <TableCell className="text-xs">
                          {locale === "id" ? a.unitNameId : a.unitNameEn}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-gray-600">
                          {a.checkIn} → {a.checkOut}
                        </TableCell>
                        <TableCell>
                          <ReservationStatusBadge status={a.status} locale={locale} />
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={a.paymentStatus} locale={locale} />
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 max-w-xs truncate">
                          {a.specialRequests ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Departures Table */}
          <div className="space-y-3 pt-4">
            <h2 className="font-display text-lg font-semibold text-gray-800 flex items-center gap-2">
              <LogOut className="h-5 w-5 text-emerald-600" />
              <span>
                {rMessages.departuresListTitle} ({arrivalsReport.departures.length})
              </span>
            </h2>

            {arrivalsReport.departures.length === 0 ? (
              <EmptyState
                title="No departures in this period"
                description="No guest check-outs scheduled for the selected date range."
              />
            ) : (
              <div className="overflow-hidden rounded-[8px] border border-gray-100 bg-white shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{rMessages.colCode}</TableHead>
                      <TableHead>{rMessages.colGuest}</TableHead>
                      <TableHead>{rMessages.colUnit}</TableHead>
                      <TableHead>{rMessages.colDates}</TableHead>
                      <TableHead>{rMessages.colStatus}</TableHead>
                      <TableHead>{rMessages.colPayment}</TableHead>
                      <TableHead numeric>{rMessages.colTotal}</TableHead>
                      <TableHead numeric>{rMessages.colOutstanding}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arrivalsReport.departures.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs font-medium">
                          <Link
                            href={`/admin/reservations/${d.id}`}
                            className="text-blue-600 hover:underline print:text-black print:no-underline"
                          >
                            {d.code}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium text-xs">{d.guestName}</TableCell>
                        <TableCell className="text-xs">
                          {locale === "id" ? d.unitNameId : d.unitNameEn}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-gray-600">
                          {d.checkIn} → {d.checkOut}
                        </TableCell>
                        <TableCell>
                          <ReservationStatusBadge status={d.status} locale={locale} />
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={d.paymentStatus} locale={locale} />
                        </TableCell>
                        <TableCell numeric className="text-xs tabular-nums">
                          {formatIdr(d.totalIdr, locale)}
                        </TableCell>
                        <TableCell
                          numeric
                          className={`text-xs tabular-nums font-semibold ${
                            d.balanceIdr > 0 ? "text-rose-600" : "text-emerald-700"
                          }`}
                        >
                          {d.balanceIdr > 0 ? formatIdr(d.balanceIdr, locale) : "Lunas"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
