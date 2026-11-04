import type {
  ArrivalsDeparturesResult,
  OccupancyReportResult,
  PaymentsReportResult,
  ReservationsReportResult,
} from "@/server/services/report-service";

/**
 * CSV Export Generator with Formula Injection Protection (SEC-12, TC-X11)
 *
 * Requirements:
 * - Prefix cells beginning with '=', '+', '-', '@', '\t', or '\r' with a single quote (')
 * - Quote all fields with double quotes ("...")
 * - Escape internal double quotes ("")
 * - Set Content-Disposition, X-Content-Type-Options: nosniff, and Cache-Control: no-store
 */

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // SEC-12: Neutralize spreadsheet formula injection characters
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape internal double quotes per RFC 4180
  const escaped = str.replace(/"/g, '""');

  return `"${escaped}"`;
}

export function serializeToCsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>,
): string {
  const headerLine = headers.map(sanitizeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(sanitizeCsvCell).join(","));
  return [headerLine, ...dataLines].join("\r\n");
}

export function createCsvResponse(csvContent: string, filename: string): Response {
  // Add UTF-8 BOM so Microsoft Excel correctly displays UTF-8 strings
  const utf8Bom = "\uFEFF";
  const body = utf8Bom + csvContent;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}

export function exportReservationsReportToCsv(
  report: ReservationsReportResult,
  locale: "en" | "id" = "en",
): string {
  const isId = locale === "id";
  const headers = [
    isId ? "Kode Reservasi" : "Reservation Code",
    isId ? "Nama Tamu" : "Guest Name",
    isId ? "Email Tamu" : "Guest Email",
    isId ? "Unit Villa" : "Villa Unit",
    isId ? "Check-In" : "Check-In",
    isId ? "Check-Out" : "Check-Out",
    isId ? "Malam" : "Nights",
    isId ? "Dewasa" : "Adults",
    isId ? "Anak" : "Children",
    isId ? "Status" : "Status",
    isId ? "Status Pembayaran" : "Payment Status",
    isId ? "Nilai Dipesan (IDR)" : "Booked Value (IDR)",
    isId ? "Jumlah Dibayar (IDR)" : "Paid Amount (IDR)",
  ];

  const rows = report.reservations.map((r) => [
    r.code,
    r.guestName,
    r.guestEmail,
    isId ? r.unitNameId : r.unitNameEn,
    r.checkIn,
    r.checkOut,
    r.nights,
    r.adults,
    r.children,
    r.status,
    r.paymentStatus,
    r.totalIdr,
    r.netPaidIdr,
  ]);

  // Append totals summary row
  rows.push([
    isId ? "TOTAL" : "TOTAL",
    "",
    "",
    "",
    "",
    "",
    report.totals.totalNights,
    report.totals.totalGuests,
    0,
    "",
    "",
    report.totals.bookedValueIdr,
    report.totals.totalPaidIdr,
  ]);

  return serializeToCsv(headers, rows);
}

export function exportPaymentsReportToCsv(
  report: PaymentsReportResult,
  locale: "en" | "id" = "en",
): string {
  const isId = locale === "id";
  const headers = [
    isId ? "Kode Reservasi" : "Reservation Code",
    isId ? "Nama Tamu" : "Guest Name",
    isId ? "Unit Villa" : "Villa Unit",
    isId ? "Check-In" : "Check-In",
    isId ? "Check-Out" : "Check-Out",
    isId ? "Status" : "Status",
    isId ? "Status Pembayaran" : "Payment Status",
    isId ? "Total Tagihan (IDR)" : "Total Bill (IDR)",
    isId ? "Sudah Dibayar (IDR)" : "Net Paid (IDR)",
    isId ? "Sisa Tagihan (IDR)" : "Outstanding Balance (IDR)",
  ];

  const rows = report.outstandingBalances.map((b) => [
    b.code,
    b.guestName,
    isId ? b.unitNameId : b.unitNameEn,
    b.checkIn,
    b.checkOut,
    b.status,
    b.paymentStatus,
    b.totalIdr,
    b.netPaidIdr,
    b.outstandingIdr,
  ]);

  rows.push([
    isId ? "TOTAL SISA SALDO" : "TOTAL OUTSTANDING",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    report.totals.totalOutstandingBalanceIdr,
  ]);

  return serializeToCsv(headers, rows);
}

export function exportOccupancyReportToCsv(
  report: OccupancyReportResult,
  locale: "en" | "id" = "en",
): string {
  const isId = locale === "id";
  const headers = [
    isId ? "Unit Villa" : "Villa Unit",
    isId ? "Slug" : "Slug",
    isId ? "Hari Kalender" : "Calendar Days",
    isId ? "Malam Diblokir" : "Blocked Nights",
    isId ? "Malam Tersedia" : "Available Nights",
    isId ? "Malam Terisi" : "Occupied Nights",
    isId ? "Tingkat Okupansi (%)" : "Occupancy Rate (%)",
    isId ? "Tarif Dasar (IDR)" : "Base Rate (IDR)",
  ];

  const rows = report.units.map((u) => [
    isId ? u.nameId : u.nameEn,
    u.slug,
    u.totalDays,
    u.blockedNights,
    u.availableNights,
    u.occupiedNights,
    u.occupancyPercent,
    u.baseRateIdr,
  ]);

  rows.push([
    isId ? "KESELURUHAN PORTFOLIO" : "PORTFOLIO TOTAL",
    "",
    report.totals.totalCalendarDays,
    report.totals.totalBlockedNights,
    report.totals.totalAvailableNights,
    report.totals.totalOccupiedNights,
    report.totals.overallOccupancyPercent,
    "",
  ]);

  return serializeToCsv(headers, rows);
}

export function exportArrivalsDeparturesReportToCsv(
  report: ArrivalsDeparturesResult,
  locale: "en" | "id" = "en",
): string {
  const isId = locale === "id";
  const headers = [
    isId ? "Tipe Pergerakan" : "Movement Type",
    isId ? "Kode Reservasi" : "Reservation Code",
    isId ? "Nama Tamu" : "Guest Name",
    isId ? "Kontak" : "Contact",
    isId ? "Unit Villa" : "Villa Unit",
    isId ? "Check-In" : "Check-In",
    isId ? "Check-Out" : "Check-Out",
    isId ? "Status" : "Status",
    isId ? "Status Pembayaran" : "Payment Status",
    isId ? "Catatan / Permintaan Khusus" : "Notes / Special Requests",
  ];

  const rows: Array<Array<string | number | boolean | null | undefined>> = [];

  // Add arrivals
  for (const a of report.arrivals) {
    rows.push([
      isId ? "KEDATANGAN" : "ARRIVAL",
      a.code,
      a.guestName,
      a.guestPhone ?? a.guestEmail,
      isId ? a.unitNameId : a.unitNameEn,
      a.checkIn,
      a.checkOut,
      a.status,
      a.paymentStatus,
      a.specialRequests ?? "",
    ]);
  }

  // Add departures
  for (const d of report.departures) {
    rows.push([
      isId ? "KEPULANGAN" : "DEPARTURE",
      d.code,
      d.guestName,
      d.guestEmail,
      isId ? d.unitNameId : d.unitNameEn,
      d.checkIn,
      d.checkOut,
      d.status,
      d.paymentStatus,
      d.balanceIdr > 0
        ? isId
          ? `Sisa: Rp ${d.balanceIdr}`
          : `Unpaid: Rp ${d.balanceIdr}`
        : "Lunas",
    ]);
  }

  return serializeToCsv(headers, rows);
}
