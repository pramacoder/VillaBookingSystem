import { db } from "@/server/db";
import { extractSearchParams } from "@/server/http/request-helpers";
import { getPublicUnitBySlug } from "@/server/services/unit-service";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    const { slug } = await context.params;
    const query = extractSearchParams(request);
    const locale = query.locale === "id" ? "id" : "en";
    const unit = await getPublicUnitBySlug(db, slug, locale);
    return createJsonResponse({ data: unit }, { status: 200, requestId, isAdminRoute: false });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: false });
  }
}
