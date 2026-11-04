import type { PaymentStatus, ReservationStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { extractSearchParams } from "@/server/http/request-helpers";
import { getReservationsReport } from "@/server/services/report-service";
import { createCsvResponse, exportReservationsReportToCsv } from "@/server/reports/csv-export";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

export async function GET(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const query = extractSearchParams(request);

    const report = await getReservationsReport(db, {
      from: query.from,
      to: query.to,
      unitId: query.unitId,
      status: query.status as ReservationStatus | undefined,
      paymentStatus: query.paymentStatus as PaymentStatus | undefined,
    });

    if (query.format === "csv") {
      const locale = query.locale === "id" ? "id" : "en";
      const csv = exportReservationsReportToCsv(report, locale);
      const filename = `reservations-${report.filters.from}-to-${report.filters.to}.csv`;
      return createCsvResponse(csv, filename);
    }

    return createJsonResponse({ data: report }, { status: 200, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
