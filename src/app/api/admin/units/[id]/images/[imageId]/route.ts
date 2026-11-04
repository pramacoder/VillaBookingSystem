import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { parseJsonBody } from "@/server/http/request-helpers";
import { verifySameOrigin } from "@/server/security/origin-check";
import { deleteUnitImage, updateUnitImage } from "@/server/services/unit-service";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ id: string; imageId: string }>;
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    verifySameOrigin(request);
    const actor = await requireRole(["ADMIN"]);
    const { id, imageId } = await context.params;
    const rawBody = await parseJsonBody(request);
    const updated = await updateUnitImage(db, id, imageId, rawBody, actor.id);
    return createJsonResponse({ data: updated }, { status: 200, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    verifySameOrigin(request);
    const actor = await requireRole(["ADMIN"]);
    const { id, imageId } = await context.params;
    await deleteUnitImage(db, id, imageId, actor.id);
    return createJsonResponse({ success: true }, { status: 200, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
