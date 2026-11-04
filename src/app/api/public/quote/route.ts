import { db } from "@/server/db";
import { getPublicUnitQuote } from "@/server/services/pricing-service";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  createJsonResponse,
  resolveRequestId,
  toErrorResponse,
  ValidationError,
} from "@/lib/errors";

export async function POST(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

    // 30 quote requests per minute per IP
    assertRateLimit({
      key: `quote_ip:${ip}`,
      limit: 30,
      windowMs: 60 * 1000,
    });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Malformed JSON request body.");
    }

    const quote = await getPublicUnitQuote(db, body);
    return createJsonResponse({ data: quote }, { status: 200, requestId, isAdminRoute: false });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: false });
  }
}
