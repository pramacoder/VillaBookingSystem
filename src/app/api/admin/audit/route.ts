import { z } from "zod";
import { db } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { extractSearchParams } from "@/server/http/request-helpers";
import { listAuditLogs } from "@/server/services/audit-service";
import { DATE_ONLY_REGEX, parseDateOnly } from "@/lib/dates";
import { createJsonResponse, resolveRequestId, toErrorResponse } from "@/lib/errors";

const auditQuerySchema = z
  .object({
    entityType: z.string().trim().min(1).max(60).optional(),
    entityId: z.string().trim().min(1).max(100).optional(),
    from: z.string().trim().regex(DATE_ONLY_REGEX).optional(),
    to: z.string().trim().regex(DATE_ONLY_REGEX).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export async function GET(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    await requireRole(["ADMIN"]);
    const rawQuery = extractSearchParams(request);
    const query = auditQuerySchema.parse(rawQuery);

    const fromDate = query.from ? parseDateOnly(query.from) : undefined;
    const toDate = query.to
      ? new Date(parseDateOnly(query.to).getTime() + 24 * 60 * 60 * 1000 - 1)
      : undefined;

    const logs = await listAuditLogs(db, {
      entityType: query.entityType,
      entityId: query.entityId,
      from: fromDate,
      to: toDate,
      limit: query.limit,
    });

    return createJsonResponse({ data: logs }, { status: 200, requestId, isAdminRoute: true });
  } catch (err) {
    return toErrorResponse(err, { requestId, isAdminRoute: true });
  }
}
