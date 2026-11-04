import { requireRole } from "@/server/auth/require-role";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

export async function GET(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    const user = await requireRole(["ADMIN", "STAFF"]);
    return createJsonResponse(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 200, requestId, isAdminRoute: true },
    );
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
