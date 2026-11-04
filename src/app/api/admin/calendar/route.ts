import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { extractSearchParams } from "@/server/http/request-helpers";
import { getAdminCalendar } from "@/server/services/calendar-service";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

export async function GET(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const rawQuery = extractSearchParams(request);
    const result = await getAdminCalendar(db, rawQuery);
    return createJsonResponse({ data: result }, { status: 200, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
