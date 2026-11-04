import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { extractSearchParams, parseJsonBody } from "@/server/http/request-helpers";
import { verifySameOrigin } from "@/server/security/origin-check";
import { createGuest, listGuests } from "@/server/services/guest-service";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

export async function GET(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const rawQuery = extractSearchParams(request);
    const result = await listGuests(db, rawQuery);
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
    const guest = await createGuest(db, {
      rawInput: rawBody,
      actorId: actor.id,
    });

    return createJsonResponse(
      {
        data: {
          id: guest.id,
          fullName: guest.fullName,
          email: guest.email,
          phone: guest.phone,
          country: guest.country,
          preferredLocale: guest.preferredLocale,
          notes: guest.notes,
        },
      },
      { status: 201, requestId, isAdminRoute: true },
    );
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
