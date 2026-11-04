import type { PaymentStatus, ReservationStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { extractSearchParams } from "@/server/http/request-helpers";
import {
  getArrivalsDeparturesReport,
  getOccupancyReport,
  getPaymentsReport,
  getReservationsReport,
} from "@/server/services/report-service";
import {
  createCsvResponse,
  exportArrivalsDeparturesReportToCsv,
  exportOccupancyReportToCsv,
  exportPaymentsReportToCsv,
  exportReservationsReportToCsv,
} from "@/server/reports/csv-export";
import { NotFoundError, resolveRequestId, toErrorResponse } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ name: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const { name } = await context.params;
    const query = extractSearchParams(request);
    const locale = query.locale === "id" ? "id" : "en";

    // Clean name (e.g. "reservations.csv" -> "reservations")
    const cleanName = name.replace(/\.csv$/i, "").toLowerCase();

    if (cleanName === "reservations") {
      const report = await getReservationsReport(db, {
        from: query.from,
        to: query.to,
        unitId: query.unitId,
        status: query.status as ReservationStatus | undefined,
        paymentStatus: query.paymentStatus as PaymentStatus | undefined,
      });
      const csv = exportReservationsReportToCsv(report, locale);
      return createCsvResponse(
        csv,
        `reservations-${report.filters.from}-to-${report.filters.to}.csv`,
      );
    }

    if (cleanName === "payments") {
      const report = await getPaymentsReport(db, {
        from: query.from,
        to: query.to,
      });
      const csv = exportPaymentsReportToCsv(report, locale);
      return createCsvResponse(csv, `payments-${report.filters.from}-to-${report.filters.to}.csv`);
    }

    if (cleanName === "occupancy") {
      const report = await getOccupancyReport(db, {
        from: query.from,
        to: query.to,
      });
      const csv = exportOccupancyReportToCsv(report, locale);
      return createCsvResponse(csv, `occupancy-${report.filters.from}-to-${report.filters.to}.csv`);
    }

    if (cleanName === "arrivals-departures") {
      const report = await getArrivalsDeparturesReport(db, {
        date: query.date,
        from: query.from,
        to: query.to,
      });
      const csv = exportArrivalsDeparturesReportToCsv(report, locale);
      return createCsvResponse(
        csv,
        `arrivals-departures-${report.filters.from}-to-${report.filters.to}.csv`,
      );
    }

    throw new NotFoundError(`Report "${name}" not found.`);
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
