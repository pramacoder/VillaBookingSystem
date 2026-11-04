import {
  type BlockReason,
  Prisma,
  type PrismaClient,
  type Reservation,
  type ReservationStatus,
  type UnitBlock,
} from "@prisma/client";
import { diffNights, toDateOnly } from "./dates";

export const PG_EXCLUSION_VIOLATION = "23P01";
export const PG_CHECK_VIOLATION = "23514";

export class DateConflictError extends Error {
  readonly code = "DATE_CONFLICT" as const;

  constructor(message = "The selected dates are no longer available.") {
    super(message);
    this.name = "DateConflictError";
  }
}

const BLOCKING_STATUSES: readonly ReservationStatus[] = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"];

export function isExclusionViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const metaCode = (error.meta as { code?: string } | undefined)?.code;
    if (metaCode === PG_EXCLUSION_VIOLATION) {
      return true;
    }
    if (error.message.includes("reservation_no_overlap")) {
      return true;
    }
  }
  if (error instanceof Error) {
    return (
      error.message.includes(PG_EXCLUSION_VIOLATION) ||
      error.message.includes("reservation_no_overlap")
    );
  }
  return false;
}

export function isCheckConstraintViolation(error: unknown, constraintName?: string): boolean {
  if (error instanceof Error) {
    const matchesSqlState =
      error.message.includes(PG_CHECK_VIOLATION) ||
      error.message.includes("violates check constraint");
    if (!matchesSqlState) return false;
    return constraintName ? error.message.includes(constraintName) : true;
  }
  return false;
}

/**
 * Transactional guard for creating a reservation while checking UnitBlock overlaps
 * and translating PostgreSQL 23P01 exclusion violations into DateConflictError (DATABASE.md §4–5.1).
 */
export async function createReservationWithConflictGuard(
  prisma: PrismaClient,
  input: {
    code: string;
    unitId: string;
    guestId: string;
    status: ReservationStatus;
    checkIn: Date | string;
    checkOut: Date | string;
    adults: number;
    children?: number;
    nightlySubtotalIdr: number;
    cleaningFeeIdr?: number;
    discountIdr?: number;
    totalIdr: number;
  },
): Promise<Reservation> {
  const checkIn = toDateOnly(input.checkIn);
  const checkOut = toDateOnly(input.checkOut);
  const nights = diffNights(checkIn, checkOut);

  try {
    return await prisma.$transaction(async (tx) => {
      // Lock unit row per DATABASE.md §5.1
      await tx.$queryRaw`SELECT id FROM "Unit" WHERE id = ${input.unitId} FOR UPDATE`;

      if (BLOCKING_STATUSES.includes(input.status)) {
        const overlappingBlock = await tx.unitBlock.findFirst({
          where: {
            unitId: input.unitId,
            startDate: { lt: checkOut },
            endDate: { gt: checkIn },
          },
          select: { id: true },
        });

        if (overlappingBlock) {
          throw new DateConflictError("Stay overlaps an existing unit block (BR-06).");
        }
      }

      return tx.reservation.create({
        data: {
          code: input.code,
          unitId: input.unitId,
          guestId: input.guestId,
          status: input.status,
          checkIn,
          checkOut,
          nights,
          adults: input.adults,
          children: input.children ?? 0,
          nightlySubtotalIdr: input.nightlySubtotalIdr,
          cleaningFeeIdr: input.cleaningFeeIdr ?? 0,
          discountIdr: input.discountIdr ?? 0,
          totalIdr: input.totalIdr,
          pricingSnapshot: { nights: [] },
        },
      });
    });
  } catch (error) {
    if (error instanceof DateConflictError) {
      throw error;
    }
    if (isExclusionViolation(error)) {
      throw new DateConflictError();
    }
    throw error;
  }
}

/**
 * Transactional guard for confirming a PENDING reservation (BR-05, DATABASE.md §5.1).
 */
export async function confirmReservationWithConflictGuard(
  prisma: PrismaClient,
  reservationId: string,
): Promise<Reservation> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.reservation.findUniqueOrThrow({
        where: { id: reservationId },
      });

      await tx.$queryRaw`SELECT id FROM "Unit" WHERE id = ${existing.unitId} FOR UPDATE`;

      const overlappingBlock = await tx.unitBlock.findFirst({
        where: {
          unitId: existing.unitId,
          startDate: { lt: existing.checkOut },
          endDate: { gt: existing.checkIn },
        },
        select: { id: true },
      });

      if (overlappingBlock) {
        throw new DateConflictError(
          "Cannot confirm reservation overlapping a unit block (BR-05, BR-06).",
        );
      }

      return tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          version: { increment: 1 },
        },
      });
    });
  } catch (error) {
    if (error instanceof DateConflictError) {
      throw error;
    }
    if (isExclusionViolation(error)) {
      throw new DateConflictError();
    }
    throw error;
  }
}

/**
 * Transactional guard for creating a UnitBlock so it cannot overlap blocking reservations (BR-06, API.md §5.1).
 */
export async function createUnitBlockWithConflictGuard(
  prisma: PrismaClient,
  input: {
    unitId: string;
    startDate: Date | string;
    endDate: Date | string;
    reason: BlockReason;
    note?: string;
  },
): Promise<UnitBlock> {
  const startDate = toDateOnly(input.startDate);
  const endDate = toDateOnly(input.endDate);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Unit" WHERE id = ${input.unitId} FOR UPDATE`;

    const overlappingReservation = await tx.reservation.findFirst({
      where: {
        unitId: input.unitId,
        status: { in: [...BLOCKING_STATUSES] },
        checkIn: { lt: endDate },
        checkOut: { gt: startDate },
      },
      select: { id: true },
    });

    if (overlappingReservation) {
      throw new DateConflictError("Unit block overlaps an existing blocking reservation (BR-06).");
    }

    return tx.unitBlock.create({
      data: {
        unitId: input.unitId,
        startDate,
        endDate,
        reason: input.reason,
        note: input.note ?? null,
      },
    });
  });
}
