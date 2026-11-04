import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { parseJsonBody } from "@/server/http/request-helpers";
import { verifySameOrigin } from "@/server/security/origin-check";
import { createUnitBlockService } from "@/server/services/availability-service";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

export async function POST(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    verifySameOrigin(request);
    const actor = await requireRole(["ADMIN", "STAFF"]);
    const rawBody = await parseJsonBody(request);
    const created = await createUnitBlockService(db, rawBody, actor.id);
    return createJsonResponse({ data: created }, { status: 201, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
