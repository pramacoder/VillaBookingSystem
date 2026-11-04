import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { verifySameOrigin } from "@/server/security/origin-check";
import { extractClientIp } from "@/server/security/rate-limit";
import { createUser, listUsers } from "@/server/services/user-service";
import {
  ValidationError,
  createJsonResponse,
  resolveRequestId,
  toErrorResponse,
} from "@/lib/errors";

export async function GET(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    await requireRole(["ADMIN"]);
    const users = await listUsers(db);
    return createJsonResponse({ data: users }, { status: 200, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    verifySameOrigin(request);
    const actor = await requireRole(["ADMIN"]);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new ValidationError("Request body must be valid JSON.");
    }

    const created = await createUser(db, actor.id, rawBody, extractClientIp(request));

    return createJsonResponse({ data: created }, { status: 201, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
