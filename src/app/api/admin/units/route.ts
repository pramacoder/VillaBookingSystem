import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { extractSearchParams, parseJsonBody } from "@/server/http/request-helpers";
import { verifySameOrigin } from "@/server/security/origin-check";
import { createUnit, listUnits } from "@/server/services/unit-service";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

export async function GET(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const rawQuery = extractSearchParams(request);
    const units = await listUnits(db, rawQuery);
    return createJsonResponse({ data: units }, { status: 200, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    verifySameOrigin(request);
    const actor = await requireRole(["ADMIN"]);
    const rawBody = await parseJsonBody(request);
    const created = await createUnit(db, rawBody, actor.id);
    return createJsonResponse({ data: created }, { status: 201, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
