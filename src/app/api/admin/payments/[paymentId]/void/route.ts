import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { parseJsonBody } from "@/server/http/request-helpers";
import { verifySameOrigin } from "@/server/security/origin-check";
import { voidPayment } from "@/server/services/payment-service";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ paymentId: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    verifySameOrigin(request);
    const actor = await requireRole(["ADMIN", "STAFF"]);
    const { paymentId } = await context.params;
    const rawBody = await parseJsonBody(request);

    const result = await voidPayment(db, {
      paymentId,
      rawInput: rawBody,
      actorId: actor.id,
      actorRole: actor.role,
    });

    return createJsonResponse(
      {
        data: {
          payment: result.payment,
          reservationId: result.reservationId,
          netPaidIdr: result.netPaidIdr,
          paymentStatus: result.paymentStatus,
          overpaidIdr: result.overpaidIdr,
          version: result.version,
        },
      },
      { status: 200, requestId, isAdminRoute: true },
    );
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
