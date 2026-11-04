import { db } from "@/server/db";
import { extractSearchParams } from "@/server/http/request-helpers";
import { getPublicUnitAvailability } from "@/server/services/unit-service";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    const { slug } = await context.params;
    const query = extractSearchParams(request);
    const availability = await getPublicUnitAvailability(db, slug, query.from, query.to);
    return createJsonResponse(
      { data: availability },
      { status: 200, requestId, isAdminRoute: false },
    );
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: false });
  }
}
