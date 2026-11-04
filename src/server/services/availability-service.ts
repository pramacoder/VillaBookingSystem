import type { PrismaClient, ReservationStatus, UnitBlock } from "@prisma/client";
import { diffNights, formatDateOnly, parseDateOnly } from "@/lib/dates";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { createUnitBlockSchema } from "@/lib/validation/reservation";
import { type DbOrTx, writeAuditLog } from "@/server/services/audit-service";

export const BLOCKING_RESERVATION_STATUSES: readonly ReservationStatus[] = [
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
] as const;

function toDateOnly(value: Date | string): Date {
  return typeof value === "string" ? parseDateOnly(value) : parseDateOnly(formatDateOnly(value));
}

export interface ConflictCheckParams {
  unitId: string;
  checkIn: Date | string;
  checkOut: Date | string;
  excludeReservationId?: string;
  excludeBlockId?: string;
}

export interface UnitConflictSummary {
  hasConflict: boolean;
  conflictingReservations: Array<{
    id: string;
    code: string;
    status: ReservationStatus;
    checkIn: string;
    checkOut: string;
  }>;
  conflictingBlocks: Array<{
    id: string;
    startDate: string;
    endDate: string;
    reason: string;
  }>;
  firstConflictRange?: [string, string];
}

/**
 * Checks half-open interval `[checkIn, checkOut)` overlap against blocking reservations
 * (`CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT` per BR-03) and `UnitBlock` rows (BR-06).
 * Same-day turnover (`existing.checkOut == checkIn` or `existing.checkIn == checkOut`) does NOT conflict (BR-01).
 */
export async function findUnitConflicts(
  tx: DbOrTx,
  params: ConflictCheckParams,
): Promise<UnitConflictSummary> {
  const checkInDate = toDateOnly(params.checkIn);
  const checkOutDate = toDateOnly(params.checkOut);

  if (diffNights(checkInDate, checkOutDate) < 1) {
    throw new ValidationError("End date must be after start date.", {
      checkOut: "check_out_must_be_after_check_in",
    });
  }

  const [reservations, blocks] = await Promise.all([
    tx.reservation.findMany({
      where: {
        unitId: params.unitId,
        status: { in: [...BLOCKING_RESERVATION_STATUSES] },
        ...(params.excludeReservationId ? { id: { not: params.excludeReservationId } } : {}),
        checkIn: { lt: checkOutDate },
        checkOut: { gt: checkInDate },
      },
      select: {
        id: true,
        code: true,
        status: true,
        checkIn: true,
        checkOut: true,
      },
      orderBy: { checkIn: "asc" },
    }),
    tx.unitBlock.findMany({
      where: {
        unitId: params.unitId,
        ...(params.excludeBlockId ? { id: { not: params.excludeBlockId } } : {}),
        startDate: { lt: checkOutDate },
        endDate: { gt: checkInDate },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        reason: true,
      },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const conflictingReservations = reservations.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    checkIn: formatDateOnly(r.checkIn),
    checkOut: formatDateOnly(r.checkOut),
  }));

  const conflictingBlocks = blocks.map((b) => ({
    id: b.id,
    startDate: formatDateOnly(b.startDate),
    endDate: formatDateOnly(b.endDate),
    reason: b.reason,
  }));

  const hasConflict = conflictingReservations.length > 0 || conflictingBlocks.length > 0;

  let firstConflictRange: [string, string] | undefined;
  if (conflictingReservations[0]) {
    firstConflictRange = [conflictingReservations[0].checkIn, conflictingReservations[0].checkOut];
  } else if (conflictingBlocks[0]) {
    firstConflictRange = [conflictingBlocks[0].startDate, conflictingBlocks[0].endDate];
  }

  return {
    hasConflict,
    conflictingReservations,
    conflictingBlocks,
    ...(firstConflictRange ? { firstConflictRange } : {}),
  };
}

/**
 * Throws a 409 DATE_CONFLICT AppError if any blocking reservation or unit block overlaps `[checkIn, checkOut)`.
 */
export async function assertUnitAvailable(tx: DbOrTx, params: ConflictCheckParams): Promise<void> {
  const conflicts = await findUnitConflicts(tx, params);
  if (conflicts.hasConflict) {
    throw new AppError("DATE_CONFLICT", 409, "The selected dates are no longer available.", {
      unitId: params.unitId,
      ...(conflicts.firstConflictRange ? { conflictingRange: conflicts.firstConflictRange } : {}),
    });
  }
}

export interface PublicAvailabilityDto {
  unit: string;
  blockedRanges: Array<[string, string]>;
  minNights: number;
}

/**
 * Public availability query (API.md §3.3, SEC-09, TC-X10).
 * Returns ONLY blocked `[startDate, endDate)` ranges and `minNights` — never guest data or reservation codes.
 */
export async function getPublicUnitAvailability(
  prisma: PrismaClient,
  params: {
    unitSlug: string;
    from: Date | string;
    to: Date | string;
  },
): Promise<PublicAvailabilityDto> {
  const fromDate = toDateOnly(params.from);
  const toDate = toDateOnly(params.to);

  if (diffNights(fromDate, toDate) < 1) {
    throw new ValidationError("'to' date must be after 'from' date.");
  }

  const unit = await prisma.unit.findUnique({
    where: { slug: params.unitSlug },
    select: {
      id: true,
      slug: true,
      status: true,
      minNights: true,
    },
  });

  if (!unit || unit.status !== "ACTIVE") {
    throw new NotFoundError("Unit not found.");
  }

  const [reservations, blocks] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        unitId: unit.id,
        status: { in: [...BLOCKING_RESERVATION_STATUSES] },
        checkIn: { lt: toDate },
        checkOut: { gt: fromDate },
      },
      select: {
        checkIn: true,
        checkOut: true,
      },
      orderBy: { checkIn: "asc" },
    }),
    prisma.unitBlock.findMany({
      where: {
        unitId: unit.id,
        startDate: { lt: toDate },
        endDate: { gt: fromDate },
      },
      select: {
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const blockedRanges: Array<[string, string]> = [
    ...reservations.map((r): [string, string] => [
      formatDateOnly(r.checkIn),
      formatDateOnly(r.checkOut),
    ]),
    ...blocks.map((b): [string, string] => [
      formatDateOnly(b.startDate),
      formatDateOnly(b.endDate),
    ]),
  ].sort((a, b) => a[0].localeCompare(b[0]));

  return {
    unit: unit.slug,
    blockedRanges,
    minNights: unit.minNights,
  };
}

/**
 * Creates a UnitBlock inside a transaction after locking the Unit row and verifying
 * no blocking reservation or existing block overlaps `[startDate, endDate)` (BR-06, TC-D06).
 */
export async function createUnitBlockService(
  prisma: PrismaClient,
  rawInput: unknown,
  actorId?: string | null,
): Promise<UnitBlock> {
  const input = createUnitBlockSchema.parse(rawInput);
  const startDate = parseDateOnly(input.startDate);
  const endDate = parseDateOnly(input.endDate);

  if (diffNights(startDate, endDate) < 1) {
    throw new ValidationError("Block endDate must be after startDate.", {
      endDate: "end_date_must_be_after_start_date",
    });
  }

  return prisma.$transaction(async (tx) => {
    const lockedUnits = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Unit" WHERE id = ${input.unitId} FOR UPDATE
    `;
    if (lockedUnits.length === 0) {
      throw new NotFoundError("Unit not found.");
    }

    await assertUnitAvailable(tx, {
      unitId: input.unitId,
      checkIn: startDate,
      checkOut: endDate,
    });

    const created = await tx.unitBlock.create({
      data: {
        unitId: input.unitId,
        startDate,
        endDate,
        reason: input.reason,
        note: input.note ?? null,
        createdById: actorId ?? null,
      },
    });

    await writeAuditLog(tx, {
      actorId: actorId ?? null,
      action: "unit_block.create",
      entityType: "UnitBlock",
      entityId: created.id,
      metadata: {
        unitId: created.unitId,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: created.reason,
      },
    });

    return created;
  });
}
