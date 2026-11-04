import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { verifySameOrigin } from "@/server/security/origin-check";
import { deleteRateRule } from "@/server/services/unit-service";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ id: string; ruleId: string }>;
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    verifySameOrigin(request);
    const actor = await requireRole(["ADMIN"]);
    const { id, ruleId } = await context.params;
    await deleteRateRule(db, id, ruleId, actor.id);
    return createJsonResponse({ success: true }, { status: 200, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}

