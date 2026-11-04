import type { AuditLog, Prisma, PrismaClient } from "@prisma/client";

export type DbOrTx = PrismaClient | Prisma.TransactionClient;

const FORBIDDEN_AUDIT_KEYS = new Set(["password", "passwordHash", "token", "secret", "authSecret"]);

function sanitizeAuditMetadata(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeAuditMetadata(item))
      .filter((item): item is Prisma.InputJsonValue => item !== undefined);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    const clean: Record<string, Prisma.InputJsonValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_AUDIT_KEYS.has(k)) {
        continue;
      }
      const sanitizedChild = sanitizeAuditMetadata(v);
      if (sanitizedChild !== undefined) {
        clean[k] = sanitizedChild;
      }
    }
    return clean;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

export interface WriteAuditLogInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an AuditLog entry inside the active transaction (SEC-17).
 * Strips any secret/password fields automatically.
 */
export async function writeAuditLog(tx: DbOrTx, input: WriteAuditLogInput): Promise<AuditLog> {
  const sanitized = sanitizeAuditMetadata(input.metadata);
  return tx.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ...(sanitized !== undefined ? { metadata: sanitized } : {}),
    },
  });
}

export interface ListAuditLogsFilter {
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export async function listAuditLogs(
  prisma: PrismaClient,
  filter: ListAuditLogsFilter = {},
): Promise<AuditLog[]> {
  return prisma.auditLog.findMany({
    where: {
      ...(filter.entityType ? { entityType: filter.entityType } : {}),
      ...(filter.entityId ? { entityId: filter.entityId } : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(filter.limit ?? 50, 1), 200),
  });
}
