import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { verifySameOrigin } from "@/server/security/origin-check";
import { anonymizeGuest } from "@/server/services/guest-service";
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

    const updated = await anonymizeGuest(db, {
      guestId: id,
      actorId: actor.id,
    });

    return createJsonResponse(
      {
        data: {
          id: updated.id,
          fullName: updated.fullName,
          email: updated.email,
          phone: updated.phone,
          country: updated.country,
          notes: updated.notes,
        },
      },
      { status: 200, requestId, isAdminRoute: true },
    );
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
