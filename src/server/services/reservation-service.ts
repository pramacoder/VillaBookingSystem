import type { Prisma, PrismaClient, Reservation, ReservationStatus } from "@prisma/client";
import { formatDateOnly, parseDateOnly, todayInPropertyTz } from "@/lib/dates";
import { isExclusionViolation } from "@/lib/db-constraints";
import { AppError, NotFoundError } from "@/lib/errors";
import { derivePaymentStatus } from "@/lib/payments";
import { generateReservationCode } from "@/lib/reservation-code";
import {
  cancelReservationSchema,
  publicInquirySchema,
  staffCreateReservationSchema,
  staffUpdateReservationSchema,
} from "@/lib/validation/reservation";
import { type DbOrTx, writeAuditLog } from "@/server/services/audit-service";
import {
  BLOCKING_RESERVATION_STATUSES,
  assertUnitAvailable,
  findUnitConflicts,
} from "@/server/services/availability-service";
import { findOrCreateGuest } from "@/server/services/guest-service";
import { calculateStayPricing, validateUnitStayRules } from "@/server/services/pricing-service";

/**
 * Allowed reservation status transitions per BR-12:
 * PENDING -> CONFIRMED | CANCELLED
 * CONFIRMED -> CHECKED_IN | CANCELLED
 * CHECKED_IN -> CHECKED_OUT
 * All other transitions are rejected with 409 INVALID_TRANSITION.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
};

export function isStatusTransitionAllowed(
  fromStatus: ReservationStatus,
  toStatus: ReservationStatus,
): boolean {
  return ALLOWED_STATUS_TRANSITIONS[fromStatus].includes(toStatus);
}

export function assertStatusTransitionAllowed(
  fromStatus: ReservationStatus,
  toStatus: ReservationStatus,
): void {
  if (!isStatusTransitionAllowed(fromStatus, toStatus)) {
    throw new AppError(
      "INVALID_TRANSITION",
      409,
      `Transition from ${fromStatus} to ${toStatus} is not allowed (BR-12).`,
      { fromStatus, toStatus },
    );
  }
}

export interface PublicInquiryResult {
  id: string;
  code: string;
  status: "PENDING";
  honeypotTriggered?: boolean;
}

interface IdempotencyEntry {
  result: PublicInquiryResult;
  expiresAtMs: number;
}

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const inquiryIdempotencyCache = new Map<string, IdempotencyEntry>();

export function resetInquiryIdempotencyStore(): void {
  inquiryIdempotencyCache.clear();
}

function isUniqueCodeCollision(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybePrisma = err as { code?: string; meta?: { target?: unknown } };
  if (maybePrisma.code !== "P2002") return false;
  const target = maybePrisma.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("code");
  }
  return typeof target === "string" && target.includes("code");
}

async function createReservationWithCodeRetry(
  tx: DbOrTx,
  buildData: (code: string) => Prisma.ReservationUncheckedCreateInput,
  referenceDate: Date,
): Promise<Reservation> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const code = generateReservationCode(referenceDate);
    try {
      return await tx.reservation.create({
        data: buildData(code),
      });
    } catch (err) {
      if (isUniqueCodeCollision(err) && attempt < maxAttempts) {
        continue;
      }
      if (isExclusionViolation(err)) {
        throw new AppError("DATE_CONFLICT", 409, "The selected dates are no longer available.");
      }
      throw err;
    }
  }
  throw new AppError("INTERNAL", 500, "Failed to generate a unique reservation code.");
}

/**
 * Handles a public booking inquiry (FR-05, BR-01..BR-08, BR-13..BR-15, TC-R01..TC-R07).
 * - Creates a `PENDING` request (`source = WEBSITE`).
 * - Silently accepts and discards honeypot submissions (`TC-R04`).
 * - Supports `Idempotency-Key` replay (`TC-R06`).
 * - Rejects past check-in dates (`BR-13`, `TC-D09`).
 * - Rejects dates already blocked by confirmed stays or unit blocks (`TC-R07`).
 */
export async function createPublicInquiry(
  prisma: PrismaClient,
  rawInput: unknown,
  options: {
    idempotencyKey?: string | null;
    now?: Date;
  } = {},
): Promise<PublicInquiryResult> {
  const now = options.now ?? new Date();

  // Check honeypot before or during validation (TC-R04)
  if (
    rawInput &&
    typeof rawInput === "object" &&
    "website" in rawInput &&
    typeof (rawInput as { website?: unknown }).website === "string" &&
    (rawInput as { website: string }).website.trim().length > 0
  ) {
    return {
      id: "honeypot_discarded",
      code: generateReservationCode(todayInPropertyTz(now)),
      status: "PENDING",
      honeypotTriggered: true,
    };
  }

  const normalizedKey = options.idempotencyKey?.trim();
  if (normalizedKey) {
    const cached = inquiryIdempotencyCache.get(normalizedKey);
    if (cached && cached.expiresAtMs > now.getTime()) {
      return cached.result;
    }
  }

  const input = publicInquirySchema.parse(rawInput);
  const checkInDate = parseDateOnly(input.checkIn);
  const checkOutDate = parseDateOnly(input.checkOut);
  const today = todayInPropertyTz(now);

  // BR-13 / TC-D09: Public requests cannot have a checkIn date in the past
  if (checkInDate.getTime() < today.getTime()) {
    throw new AppError("BUSINESS_RULE", 422, "Check-in date cannot be in the past.", {
      checkIn: "check_in_in_past",
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const unit = await tx.unit.findUnique({
      where: { slug: input.unitSlug },
      include: { rateRules: true },
    });

    if (!unit || unit.status !== "ACTIVE") {
      throw new NotFoundError("Unit not found.");
    }

    validateUnitStayRules(unit, {
      checkIn: checkInDate,
      checkOut: checkOutDate,
      adults: input.adults,
      children: input.children,
      rateRules: unit.rateRules,
    });

    // TC-R07: Reject public inquiry if dates are already blocked by a blocking reservation or unit block
    await assertUnitAvailable(tx, {
      unitId: unit.id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
    });

    const pricing = calculateStayPricing({
      baseRateIdr: unit.baseRateIdr,
      cleaningFeeIdr: unit.cleaningFeeIdr,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      discountIdr: 0,
      rateRules: unit.rateRules,
    });

    const guest = await findOrCreateGuest(tx, {
      fullName: input.name,
      email: input.email,
      phone: input.phone ?? null,
      country: input.country ?? null,
      preferredLocale: input.locale,
    });

    const paymentStatus = derivePaymentStatus(pricing.totalIdr, 0);

    const created = await createReservationWithCodeRetry(
      tx,
      (code) => ({
        code,
        unitId: unit.id,
        guestId: guest.id,
        status: "PENDING",
        source: "WEBSITE",
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights: pricing.nights,
        adults: input.adults,
        children: input.children,
        nightlySubtotalIdr: pricing.nightlySubtotalIdr,
        cleaningFeeIdr: pricing.cleaningFeeIdr,
        discountIdr: pricing.discountIdr,
        totalIdr: pricing.totalIdr,
        netPaidIdr: 0,
        paymentStatus,
        pricingSnapshot: pricing.pricingSnapshot as unknown as Prisma.InputJsonValue,
        locale: input.locale,
        specialRequests: input.message ?? null,
      }),
      checkInDate,
    );

    await writeAuditLog(tx, {
      actorId: null,
      action: "reservation.inquiry_create",
      entityType: "Reservation",
      entityId: created.id,
      metadata: {
        code: created.code,
        unitId: unit.id,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        status: "PENDING",
        source: "WEBSITE",
        totalIdr: pricing.totalIdr,
      },
    });

    return {
      id: created.id,
      code: created.code,
      status: "PENDING" as const,
    };
  });

  if (normalizedKey) {
    inquiryIdempotencyCache.set(normalizedKey, {
      result,
      expiresAtMs: now.getTime() + IDEMPOTENCY_TTL_MS,
    });
  }

  return result;
}

/**
 * Staff reservation creation (FR-14, BR-13, DATABASE.md §5.1, TC-D09, TC-C02).
 * - Allows `PENDING` or `CONFIRMED` initial status.
 * - Allows backdated `checkIn` for walk-in/historical corrections and records `backdated: true` in `AuditLog`.
 * - Locks the `Unit` row with `FOR UPDATE` so concurrent staff creations for the same unit serialize.
 */
export async function createStaffReservation(
  prisma: PrismaClient,
  rawInput: unknown,
  options: {
    actorId: string;
    now?: Date;
  },
): Promise<Reservation> {
  const now = options.now ?? new Date();
  const input = staffCreateReservationSchema.parse(rawInput);
  const checkInDate = parseDateOnly(input.checkIn);
  const checkOutDate = parseDateOnly(input.checkOut);
  const today = todayInPropertyTz(now);
  const isBackdated = checkInDate.getTime() < today.getTime();

  try {
    return await prisma.$transaction(async (tx) => {
      // Lock unit row first (DATABASE.md §5.1, TC-C02)
      const lockedUnits = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Unit" WHERE id = ${input.unitId} FOR UPDATE
      `;
      if (lockedUnits.length === 0) {
        throw new NotFoundError("Unit not found.");
      }

      const unit = await tx.unit.findUniqueOrThrow({
        where: { id: input.unitId },
        include: { rateRules: true },
      });

      validateUnitStayRules(unit, {
        checkIn: checkInDate,
        checkOut: checkOutDate,
        adults: input.adults,
        children: input.children,
        rateRules: unit.rateRules,
      });

      if (BLOCKING_RESERVATION_STATUSES.includes(input.status)) {
        await assertUnitAvailable(tx, {
          unitId: unit.id,
          checkIn: checkInDate,
          checkOut: checkOutDate,
        });
      } else {
        // Even for a PENDING staff reservation, reject if a UnitBlock covers the dates (BR-06, TC-D06)
        const conflicts = await findUnitConflicts(tx, {
          unitId: unit.id,
          checkIn: checkInDate,
          checkOut: checkOutDate,
        });
        if (conflicts.conflictingBlocks.length > 0) {
          throw new AppError(
            "DATE_CONFLICT",
            409,
            "The selected dates overlap an administrative unit block.",
            {
              unitId: unit.id,
              conflictingRange: conflicts.firstConflictRange,
            },
          );
        }
      }

      const pricing = calculateStayPricing({
        baseRateIdr: unit.baseRateIdr,
        cleaningFeeIdr: unit.cleaningFeeIdr,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        discountIdr: input.discountIdr,
        rateRules: unit.rateRules,
      });

      const guest = await findOrCreateGuest(tx, input.guest);
      const paymentStatus = derivePaymentStatus(pricing.totalIdr, 0);

      const created = await createReservationWithCodeRetry(
        tx,
        (code) => ({
          code,
          unitId: unit.id,
          guestId: guest.id,
          status: input.status,
          source: input.source,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          nights: pricing.nights,
          adults: input.adults,
          children: input.children,
          nightlySubtotalIdr: pricing.nightlySubtotalIdr,
          cleaningFeeIdr: pricing.cleaningFeeIdr,
          discountIdr: pricing.discountIdr,
          totalIdr: pricing.totalIdr,
          netPaidIdr: 0,
          paymentStatus,
          pricingSnapshot: pricing.pricingSnapshot as unknown as Prisma.InputJsonValue,
          locale: input.locale,
          specialRequests: input.specialRequests ?? null,
          internalNotes: input.internalNotes ?? null,
          confirmedAt: input.status === "CONFIRMED" ? now : null,
          createdById: options.actorId,
        }),
        checkInDate,
      );

      await writeAuditLog(tx, {
        actorId: options.actorId,
        action: "reservation.create",
        entityType: "Reservation",
        entityId: created.id,
        metadata: {
          code: created.code,
          unitId: unit.id,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          status: created.status,
          source: created.source,
          totalIdr: created.totalIdr,
          backdated: isBackdated,
        },
      });

      return created;
    });
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new AppError("DATE_CONFLICT", 409, "The selected dates are no longer available.");
    }
    throw err;
  }
}

/**
 * Confirms a `PENDING` reservation per DATABASE.md §5.1 & BR-05 (TC-D04, TC-C01):
 * 1. Lock the `Unit` row (`FOR UPDATE`) so concurrent confirms on the same unit serialize.
 * 2. Verify status transition (`PENDING -> CONFIRMED`) and optional `expectedVersion`.
 * 3. Check `assertUnitAvailable` for overlapping blocking reservations or `UnitBlock` rows.
 * 4. Update reservation (`status = CONFIRMED`, `confirmedAt`, `version + 1`) and write `AuditLog`.
 */
export async function confirmReservation(
  prisma: PrismaClient,
  params: {
    reservationId: string;
    actorId: string;
    expectedVersion?: number;
    now?: Date;
  },
): Promise<Reservation> {
  const now = params.now ?? new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const initial = await tx.reservation.findUnique({
        where: { id: params.reservationId },
        select: { id: true, unitId: true },
      });

      if (!initial) {
        throw new NotFoundError("Reservation not found.");
      }

      // Lock the unit row (DATABASE.md §5.1)
      await tx.$queryRaw`
        SELECT id FROM "Unit" WHERE id = ${initial.unitId} FOR UPDATE
      `;

      const current = await tx.reservation.findUniqueOrThrow({
        where: { id: params.reservationId },
      });

      if (params.expectedVersion !== undefined && current.version !== params.expectedVersion) {
        throw new AppError(
          "VERSION_CONFLICT",
          409,
          "Reservation was updated by another user. Please reload and try again.",
          { expectedVersion: params.expectedVersion, actualVersion: current.version },
        );
      }

      assertStatusTransitionAllowed(current.status, "CONFIRMED");

      await assertUnitAvailable(tx, {
        unitId: current.unitId,
        checkIn: current.checkIn,
        checkOut: current.checkOut,
        excludeReservationId: current.id,
      });

      const updated = await tx.reservation.update({
        where: { id: current.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: now,
          version: { increment: 1 },
        },
      });

      await writeAuditLog(tx, {
        actorId: params.actorId,
        action: "reservation.confirm",
        entityType: "Reservation",
        entityId: updated.id,
        metadata: {
          code: updated.code,
          unitId: updated.unitId,
          checkIn: formatDateOnly(updated.checkIn),
          checkOut: formatDateOnly(updated.checkOut),
          previousVersion: current.version,
          newVersion: updated.version,
        },
      });

      return updated;
    });
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new AppError("DATE_CONFLICT", 409, "The selected dates are no longer available.");
    }
    throw err;
  }
}

/**
 * Updates a reservation (dates, unit, guests, discount, notes) with optimistic concurrency (`If-Match` version),
 * re-validating stay rules, re-checking conflicts, and re-pricing when dates/unit/discount change
 * (FR-14, DATABASE.md §6, TC-D11, TC-C03).
 */
export async function updateReservation(
  prisma: PrismaClient,
  params: {
    reservationId: string;
    expectedVersion: number;
    rawPatch: unknown;
    actorId: string;
  },
): Promise<Reservation> {
  const patch = staffUpdateReservationSchema.parse(params.rawPatch);

  try {
    return await prisma.$transaction(async (tx) => {
      // Lock the reservation row so concurrent edits with the same If-Match version serialize (TC-C03)
      const lockedRows = await tx.$queryRaw<Array<{ id: string; version: number; unitId: string }>>`
        SELECT id, version, "unitId" FROM "Reservation" WHERE id = ${params.reservationId} FOR UPDATE
      `;

      if (lockedRows.length === 0) {
        throw new NotFoundError("Reservation not found.");
      }

      const current = await tx.reservation.findUniqueOrThrow({
        where: { id: params.reservationId },
      });

      if (current.version !== params.expectedVersion) {
        throw new AppError(
          "VERSION_CONFLICT",
          409,
          "Reservation was updated by another user. Please reload and try again.",
          {
            expectedVersion: params.expectedVersion,
            actualVersion: current.version,
          },
        );
      }

      const targetUnitId = patch.unitId ?? current.unitId;
      // Lock target unit row as well
      const lockedUnits = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Unit" WHERE id = ${targetUnitId} FOR UPDATE
      `;
      if (lockedUnits.length === 0) {
        throw new NotFoundError("Target unit not found.");
      }

      const targetUnit = await tx.unit.findUniqueOrThrow({
        where: { id: targetUnitId },
        include: { rateRules: true },
      });

      const nextCheckIn = patch.checkIn ? parseDateOnly(patch.checkIn) : current.checkIn;
      const nextCheckOut = patch.checkOut ? parseDateOnly(patch.checkOut) : current.checkOut;
      const nextAdults = patch.adults ?? current.adults;
      const nextChildren = patch.children ?? current.children;
      const nextDiscountIdr = patch.discountIdr ?? current.discountIdr;

      validateUnitStayRules(targetUnit, {
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        adults: nextAdults,
        children: nextChildren,
        rateRules: targetUnit.rateRules,
      });

      if (BLOCKING_RESERVATION_STATUSES.includes(current.status)) {
        await assertUnitAvailable(tx, {
          unitId: targetUnitId,
          checkIn: nextCheckIn,
          checkOut: nextCheckOut,
          excludeReservationId: current.id,
        });
      } else {
        const conflicts = await findUnitConflicts(tx, {
          unitId: targetUnitId,
          checkIn: nextCheckIn,
          checkOut: nextCheckOut,
          excludeReservationId: current.id,
        });
        if (conflicts.conflictingBlocks.length > 0) {
          throw new AppError(
            "DATE_CONFLICT",
            409,
            "The selected dates overlap an administrative unit block.",
            {
              unitId: targetUnitId,
              conflictingRange: conflicts.firstConflictRange,
            },
          );
        }
      }

      const pricingChanged =
        targetUnitId !== current.unitId ||
        formatDateOnly(nextCheckIn) !== formatDateOnly(current.checkIn) ||
        formatDateOnly(nextCheckOut) !== formatDateOnly(current.checkOut) ||
        nextDiscountIdr !== current.discountIdr;

      let nights = current.nights;
      let nightlySubtotalIdr = current.nightlySubtotalIdr;
      let cleaningFeeIdr = current.cleaningFeeIdr;
      let discountIdr = current.discountIdr;
      let totalIdr = current.totalIdr;
      let pricingSnapshot: Prisma.InputJsonValue = current.pricingSnapshot as Prisma.InputJsonValue;

      if (pricingChanged) {
        const repriced = calculateStayPricing({
          baseRateIdr: targetUnit.baseRateIdr,
          cleaningFeeIdr: targetUnit.cleaningFeeIdr,
          checkIn: nextCheckIn,
          checkOut: nextCheckOut,
          discountIdr: nextDiscountIdr,
          rateRules: targetUnit.rateRules,
        });
        nights = repriced.nights;
        nightlySubtotalIdr = repriced.nightlySubtotalIdr;
        cleaningFeeIdr = repriced.cleaningFeeIdr;
        discountIdr = repriced.discountIdr;
        totalIdr = repriced.totalIdr;
        pricingSnapshot = repriced.pricingSnapshot as unknown as Prisma.InputJsonValue;
      }

      const nextPaymentStatus = derivePaymentStatus(totalIdr, current.netPaidIdr);

      const updated = await tx.reservation.update({
        where: { id: current.id },
        data: {
          unitId: targetUnitId,
          checkIn: nextCheckIn,
          checkOut: nextCheckOut,
          nights,
          adults: nextAdults,
          children: nextChildren,
          nightlySubtotalIdr,
          cleaningFeeIdr,
          discountIdr,
          totalIdr,
          paymentStatus: nextPaymentStatus,
          pricingSnapshot,
          ...(patch.specialRequests !== undefined
            ? { specialRequests: patch.specialRequests }
            : {}),
          ...(patch.internalNotes !== undefined ? { internalNotes: patch.internalNotes } : {}),
          version: { increment: 1 },
        },
      });

      await writeAuditLog(tx, {
        actorId: params.actorId,
        action: "reservation.update",
        entityType: "Reservation",
        entityId: updated.id,
        metadata: {
          previousVersion: current.version,
          newVersion: updated.version,
          pricingChanged,
          checkIn: formatDateOnly(updated.checkIn),
          checkOut: formatDateOnly(updated.checkOut),
          totalIdr: updated.totalIdr,
        },
      });

      return updated;
    });
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new AppError("DATE_CONFLICT", 409, "The selected dates are no longer available.");
    }
    throw err;
  }
}

/**
 * Transitions a `CONFIRMED` reservation to `CHECKED_IN` (BR-12, TC-S01, TC-S04).
 * Rejects check-in before the scheduled check-in date in `Asia/Makassar` unless `overrideEarlyCheckIn` is set.
 */
export async function checkInReservation(
  prisma: PrismaClient,
  params: {
    reservationId: string;
    actorId: string;
    expectedVersion?: number;
    overrideEarlyCheckIn?: boolean;
    now?: Date;
  },
): Promise<Reservation> {
  const now = params.now ?? new Date();
  const today = todayInPropertyTz(now);

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Reservation" WHERE id = ${params.reservationId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new NotFoundError("Reservation not found.");
    }

    const current = await tx.reservation.findUniqueOrThrow({
      where: { id: params.reservationId },
    });

    if (params.expectedVersion !== undefined && current.version !== params.expectedVersion) {
      throw new AppError("VERSION_CONFLICT", 409, "Reservation was updated by another user.");
    }

    assertStatusTransitionAllowed(current.status, "CHECKED_IN");

    const scheduledCheckIn = parseDateOnly(formatDateOnly(current.checkIn));
    const isEarly = today.getTime() < scheduledCheckIn.getTime();
    if (isEarly && !params.overrideEarlyCheckIn) {
      throw new AppError(
        "BUSINESS_RULE",
        422,
        "Check-in is not allowed before the scheduled check-in date without staff override.",
        {
          checkIn: formatDateOnly(current.checkIn),
          today: formatDateOnly(today),
        },
      );
    }

    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: {
        status: "CHECKED_IN",
        checkedInAt: now,
        version: { increment: 1 },
      },
    });

    await writeAuditLog(tx, {
      actorId: params.actorId,
      action: "reservation.check_in",
      entityType: "Reservation",
      entityId: updated.id,
      metadata: {
        code: updated.code,
        earlyCheckInOverride: isEarly && Boolean(params.overrideEarlyCheckIn),
      },
    });

    return updated;
  });
}

/**
 * Transitions a `CHECKED_IN` reservation to `CHECKED_OUT` (BR-12, TC-S01).
 */
export async function checkOutReservation(
  prisma: PrismaClient,
  params: {
    reservationId: string;
    actorId: string;
    expectedVersion?: number;
    now?: Date;
  },
): Promise<Reservation> {
  const now = params.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Reservation" WHERE id = ${params.reservationId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new NotFoundError("Reservation not found.");
    }

    const current = await tx.reservation.findUniqueOrThrow({
      where: { id: params.reservationId },
    });

    if (params.expectedVersion !== undefined && current.version !== params.expectedVersion) {
      throw new AppError("VERSION_CONFLICT", 409, "Reservation was updated by another user.");
    }

    assertStatusTransitionAllowed(current.status, "CHECKED_OUT");

    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: {
        status: "CHECKED_OUT",
        checkedOutAt: now,
        version: { increment: 1 },
      },
    });

    await writeAuditLog(tx, {
      actorId: params.actorId,
      action: "reservation.check_out",
      entityType: "Reservation",
      entityId: updated.id,
      metadata: {
        code: updated.code,
      },
    });

    return updated;
  });
}

/**
 * Cancels a `PENDING` or `CONFIRMED` reservation (BR-11, BR-12, TC-S01..TC-S03).
 * - Requires a non-empty cancellation reason.
 * - Preserves existing payments (`BR-11`); if `netPaidIdr > 0`, flags `refundPending: true`.
 */
export async function cancelReservation(
  prisma: PrismaClient,
  params: {
    reservationId: string;
    rawInput: unknown;
    actorId: string;
    expectedVersion?: number;
    now?: Date;
  },
): Promise<Reservation & { refundPending: boolean }> {
  const now = params.now ?? new Date();
  const input = cancelReservationSchema.parse(params.rawInput);

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Reservation" WHERE id = ${params.reservationId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new NotFoundError("Reservation not found.");
    }

    const current = await tx.reservation.findUniqueOrThrow({
      where: { id: params.reservationId },
    });

    if (params.expectedVersion !== undefined && current.version !== params.expectedVersion) {
      throw new AppError("VERSION_CONFLICT", 409, "Reservation was updated by another user.");
    }

    assertStatusTransitionAllowed(current.status, "CANCELLED");

    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelReason: input.reason,
        version: { increment: 1 },
      },
    });

    const refundPending = updated.netPaidIdr > 0;

    await writeAuditLog(tx, {
      actorId: params.actorId,
      action: "reservation.cancel",
      entityType: "Reservation",
      entityId: updated.id,
      metadata: {
        code: updated.code,
        reason: input.reason,
        netPaidIdr: updated.netPaidIdr,
        refundPending,
      },
    });

    return {
      ...updated,
      refundPending,
    };
  });
}
