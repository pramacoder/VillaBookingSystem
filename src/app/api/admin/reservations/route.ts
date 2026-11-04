import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { extractSearchParams, parseJsonBody } from "@/server/http/request-helpers";
import { verifySameOrigin } from "@/server/security/origin-check";
import { createStaffReservation, listReservations } from "@/server/services/reservation-service";
import { formatDateOnly } from "@/lib/dates";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

export async function GET(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const rawQuery = extractSearchParams(request);
    const result = await listReservations(db, rawQuery);
    return createJsonResponse(
      { data: result.items, meta: result.meta },
      { status: 200, requestId, isAdminRoute: true },
    );
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    verifySameOrigin(request);
    const actor = await requireRole(["ADMIN", "STAFF"]);
    const rawBody = await parseJsonBody(request);
    const created = await createStaffReservation(db, rawBody, {
      actorId: actor.id,
    });

    return createJsonResponse(
      {
        data: {
          id: created.id,
          code: created.code,
          status: created.status,
          paymentStatus: created.paymentStatus,
          checkIn: formatDateOnly(created.checkIn),
          checkOut: formatDateOnly(created.checkOut),
          nights: created.nights,
          totalIdr: created.totalIdr,
          version: created.version,
        },
      },
      { status: 201, requestId, isAdminRoute: true },
    );
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
