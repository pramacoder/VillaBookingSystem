import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { parseIfMatchVersion, parseJsonBody } from "@/server/http/request-helpers";
import { verifySameOrigin } from "@/server/security/origin-check";
import { cancelReservation } from "@/server/services/reservation-service";
import { cancelReservationSchema } from "@/lib/validation/reservation";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    verifySameOrigin(request);
    const actor = await requireRole(["ADMIN", "STAFF"]);
    const { id } = await context.params;
    const headerVersion = parseIfMatchVersion(request, false);
    const rawBody = await parseJsonBody(request);
    const body = cancelReservationSchema.parse(rawBody);

    const updated = await cancelReservation(db, {
      reservationId: id,
      rawInput: { reason: body.reason },
      actorId: actor.id,
      expectedVersion: headerVersion ?? body.expectedVersion,
    });

    return createJsonResponse(
      {
        data: {
          id: updated.id,
          code: updated.code,
          status: updated.status,
          paymentStatus: updated.paymentStatus,
          refundPending: updated.refundPending,
          version: updated.version,
        },
      },
      { status: 200, requestId, isAdminRoute: true },
    );
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
