import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { extractSearchParams } from "@/server/http/request-helpers";
import { getPaymentsReport } from "@/server/services/report-service";
import { createCsvResponse, exportPaymentsReportToCsv } from "@/server/reports/csv-export";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

export async function GET(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const query = extractSearchParams(request);

    const report = await getPaymentsReport(db, {
      from: query.from,
      to: query.to,
    });

    if (query.format === "csv") {
      const locale = query.locale === "id" ? "id" : "en";
      const csv = exportPaymentsReportToCsv(report, locale);
      const filename = `payments-${report.filters.from}-to-${report.filters.to}.csv`;
      return createCsvResponse(csv, filename);
    }

    return createJsonResponse({ data: report }, { status: 200, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}

