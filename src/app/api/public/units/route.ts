import { db } from "@/server/db";
import { extractSearchParams } from "@/server/http/request-helpers";
import { listPublicUnits } from "@/server/services/unit-service";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

export async function GET(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    const query = extractSearchParams(request);
    const locale = query.locale === "id" ? "id" : "en";
    const units = await listPublicUnits(db, locale);
    return createJsonResponse({ data: units }, { status: 200, requestId, isAdminRoute: false });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: false });
  }
}
