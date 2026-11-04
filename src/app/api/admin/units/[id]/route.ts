import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { parseJsonBody } from "@/server/http/request-helpers";
import { verifySameOrigin } from "@/server/security/origin-check";
import { getUnitDetail, updateUnit } from "@/server/services/unit-service";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const { id } = await context.params;
    const detail = await getUnitDetail(db, id);
    return createJsonResponse({ data: detail }, { status: 200, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    verifySameOrigin(request);
    const actor = await requireRole(["ADMIN"]);
    const { id } = await context.params;
    const rawBody = await parseJsonBody(request);
    const updated = await updateUnit(db, id, rawBody, actor.id);
    return createJsonResponse({ data: updated }, { status: 200, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
