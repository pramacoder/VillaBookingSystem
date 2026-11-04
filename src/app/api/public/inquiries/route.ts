import { db } from "@/server/db";
import { createPublicInquiry } from "@/server/services/reservation-service";
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

    // 1. IP Rate limit: 5 requests / 10 minutes per IP (API §3.5)
    assertRateLimit({
      key: `inquiry_ip:${ip}`,
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Malformed JSON request body.");
    }

    // 2. Email Rate limit: 3 requests / 1 hour per email
    if (body && typeof body === "object" && "email" in body && typeof body.email === "string") {
      const normEmail = body.email.trim().toLowerCase();
      if (normEmail.length > 0) {
        assertRateLimit({
          key: `inquiry_email:${normEmail}`,
          limit: 3,
          windowMs: 60 * 60 * 1000,
        });
      }
    }

    const idempotencyKey = request.headers.get("idempotency-key");

    const result = await createPublicInquiry(db, body, {
      idempotencyKey,
    });

    return createJsonResponse(
      {
        data: {
          code: result.code,
          status: "PENDING",
        },
      },
      { status: 201, requestId, isAdminRoute: false },
    );
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: false });
  }
}
