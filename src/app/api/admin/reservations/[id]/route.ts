import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { parseIfMatchVersion, parseJsonBody } from "@/server/http/request-helpers";
import { verifySameOrigin } from "@/server/security/origin-check";
import { getReservationDetail, updateReservation } from "@/server/services/reservation-service";
import { formatDateOnly } from "@/lib/dates";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const { id } = await context.params;
    const detail = await getReservationDetail(db, id);
    return createJsonResponse({ data: detail }, { status: 200, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    verifySameOrigin(request);
    const actor = await requireRole(["ADMIN", "STAFF"]);
    const { id } = await context.params;
    const expectedVersion = parseIfMatchVersion(request, true);
    const rawPatch = await parseJsonBody(request);

    const updated = await updateReservation(db, {
      reservationId: id,
      expectedVersion,
      rawPatch,
      actorId: actor.id,
    });

    return createJsonResponse(
      {
        data: {
          id: updated.id,
          code: updated.code,
          status: updated.status,
          paymentStatus: updated.paymentStatus,
          checkIn: formatDateOnly(updated.checkIn),
          checkOut: formatDateOnly(updated.checkOut),
          nights: updated.nights,
          adults: updated.adults,
          children: updated.children,
          nightlySubtotalIdr: updated.nightlySubtotalIdr,
          cleaningFeeIdr: updated.cleaningFeeIdr,
          discountIdr: updated.discountIdr,
          totalIdr: updated.totalIdr,
          netPaidIdr: updated.netPaidIdr,
          version: updated.version,
        },
      },
      { status: 200, requestId, isAdminRoute: true },
    );
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
