import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { parseJsonBody } from "@/server/http/request-helpers";
import { verifySameOrigin } from "@/server/security/origin-check";
import { addUnitImage } from "@/server/services/unit-service";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    verifySameOrigin(request);
    const actor = await requireRole(["ADMIN"]);
    const { id } = await context.params;
    const rawBody = await parseJsonBody(request);
    const image = await addUnitImage(db, id, rawBody, actor.id);
    return createJsonResponse({ data: image }, { status: 201, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
