import { PrismaClient, type ReservationStatus, UserRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runSeed } from "../../prisma/seed";
import { loadLocalEnvFiles } from "../../scripts/db-reset";
import { diffNights, parseDateOnly } from "../../src/lib/dates";
import {
  confirmReservationWithConflictGuard,
  createReservationWithConflictGuard,
  createUnitBlockWithConflictGuard,
  DateConflictError,
  isCheckConstraintViolation,
  isExclusionViolation,
} from "../../src/lib/db-constraints";

loadLocalEnvFiles();

const DEFAULT_LOCAL_DB_URL =
  "postgresql://sagara:sagara_local_dev@localhost:5433/sagara_villas?schema=public";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_LOCAL_DB_URL;
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const prisma = new PrismaClient();

describe("PostgreSQL Database Constraints & Seed Integration (M1: TC-D01..TC-D07)", () => {
  let unitAId = "";
  let unitBId = "";
  let guestId = "";
  let staffId = "";
  let codeCounter = 1;

  function nextCode(): string {
    const n = String(codeCounter++).padStart(4, "0");
    return `SGV-2612-T${n.slice(-3)}`;
  }

  async function insertReservationRaw(params: {
    unitId?: string;
    status?: ReservationStatus;
    checkIn: string;
    checkOut: string;
    nights?: number;
    adults?: number;
    children?: number;
    nightlySubtotalIdr?: number;
    cleaningFeeIdr?: number;
    discountIdr?: number;
    totalIdr?: number;
  }) {
    const checkInDate = parseDateOnly(params.checkIn);
    const checkOutDate = parseDateOnly(params.checkOut);
    const nights = params.nights ?? diffNights(checkInDate, checkOutDate);

    return prisma.reservation.create({
      data: {
        code: nextCode(),
        unitId: params.unitId ?? unitAId,
        guestId,
        status: params.status ?? "CONFIRMED",
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights,
        adults: params.adults ?? 2,
        children: params.children ?? 0,
        nightlySubtotalIdr: params.nightlySubtotalIdr ?? 3_000_000,
        cleaningFeeIdr: params.cleaningFeeIdr ?? 250_000,
        discountIdr: params.discountIdr ?? 0,
        totalIdr: params.totalIdr ?? 3_250_000,
        pricingSnapshot: { nights: [] },
      },
    });
  }

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.auditLog.deleteMany(),
      prisma.payment.deleteMany(),
      prisma.reservation.deleteMany(),
      prisma.unitBlock.deleteMany(),
      prisma.rateRule.deleteMany(),
      prisma.unitImage.deleteMany(),
      prisma.unitAmenity.deleteMany(),
      prisma.amenity.deleteMany(),
      prisma.unit.deleteMany(),
      prisma.guest.deleteMany(),
      prisma.user.deleteMany(),
    ]);

    const staff = await prisma.user.create({
      data: {
        email: "test-staff@example.com",
        name: "Test Staff",
        passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$dummy$dummy",
        role: UserRole.STAFF,
      },
    });
    staffId = staff.id;

    const unitA = await prisma.unit.create({
      data: {
        slug: "test-villa-a",
        status: "ACTIVE",
        nameEn: "Test Villa A",
        nameId: "Villa Uji A",
        summaryEn: "Summary A",
        summaryId: "Ringkasan A",
        descriptionEn: "Description A",
        descriptionId: "Deskripsi A",
        maxGuests: 4,
        bedrooms: 2,
        bathrooms: 2,
        baseRateIdr: 1_500_000,
        cleaningFeeIdr: 250_000,
      },
    });
    unitAId = unitA.id;

    const unitB = await prisma.unit.create({
      data: {
        slug: "test-villa-b",
        status: "ACTIVE",
        nameEn: "Test Villa B",
        nameId: "Villa Uji B",
        summaryEn: "Summary B",
        summaryId: "Ringkasan B",
        descriptionEn: "Description B",
        descriptionId: "Deskripsi B",
        maxGuests: 4,
        bedrooms: 2,
        bathrooms: 2,
        baseRateIdr: 2_000_000,
        cleaningFeeIdr: 300_000,
      },
    });
    unitBId = unitB.id;

    const guest = await prisma.guest.create({
      data: {
        fullName: "Test Guest",
        email: "guest@example.com",
        emailNormalized: "guest@example.com",
      },
    });
    guestId = guest.id;
  });

  afterAll(async () => {
    // Restore demo seed data after tests finish so local DB stays populated
    await runSeed(prisma, {
      ...process.env,
      NODE_ENV: "development",
      SEED_ADMIN_EMAIL: "admin@sagaravillas.example.com",
      SEED_ADMIN_PASSWORD: "SagaraDemoAdmin#2026!Secure",
      SEED_STAFF_EMAIL: "staff@sagaravillas.example.com",
      SEED_STAFF_PASSWORD: "SagaraDemoStaff#2026!Secure",
    });
    await prisma.$disconnect();
  });

  it("TC-D01: rejects overlapping CONFIRMED, CHECKED_IN, and CHECKED_OUT stays on the same unit via PostgreSQL 23P01 exclusion constraint", async () => {
    await insertReservationRaw({
      unitId: unitAId,
      status: "CONFIRMED",
      checkIn: "2026-12-10",
      checkOut: "2026-12-15",
    });

    // Partial overlap (2026-12-13..2026-12-18) with CONFIRMED
    let caughtError: unknown = null;
    try {
      await insertReservationRaw({
        unitId: unitAId,
        status: "CONFIRMED",
        checkIn: "2026-12-13",
        checkOut: "2026-12-18",
      });
    } catch (err) {
      caughtError = err;
    }
    expect(isExclusionViolation(caughtError)).toBe(true);

    // Contained overlap (2026-12-11..2026-12-13) with CHECKED_IN
    let caughtCheckedIn: unknown = null;
    try {
      await insertReservationRaw({
        unitId: unitAId,
        status: "CHECKED_IN",
        checkIn: "2026-12-11",
        checkOut: "2026-12-13",
      });
    } catch (err) {
      caughtCheckedIn = err;
    }
    expect(isExclusionViolation(caughtCheckedIn)).toBe(true);

    // Overlap with CHECKED_OUT
    let caughtCheckedOut: unknown = null;
    try {
      await insertReservationRaw({
        unitId: unitAId,
        status: "CHECKED_OUT",
        checkIn: "2026-12-09",
        checkOut: "2026-12-11",
      });
    } catch (err) {
      caughtCheckedOut = err;
    }
    expect(isExclusionViolation(caughtCheckedOut)).toBe(true);
  });

  it("TC-D02: accepts same-day turnover (A checks out on day D, B checks in on day D) on the same unit", async () => {
    const stayA = await insertReservationRaw({
      unitId: unitAId,
      status: "CONFIRMED",
      checkIn: "2026-12-10",
      checkOut: "2026-12-14",
    });

    const stayB = await insertReservationRaw({
      unitId: unitAId,
      status: "CONFIRMED",
      checkIn: "2026-12-14",
      checkOut: "2026-12-18",
    });

    expect(stayA.id).toBeTruthy();
    expect(stayB.id).toBeTruthy();
  });

  it("TC-D03: accepts overlapping CONFIRMED stays on different units", async () => {
    const unitAStay = await insertReservationRaw({
      unitId: unitAId,
      status: "CONFIRMED",
      checkIn: "2026-12-10",
      checkOut: "2026-12-15",
    });

    const unitBStay = await insertReservationRaw({
      unitId: unitBId,
      status: "CONFIRMED",
      checkIn: "2026-12-10",
      checkOut: "2026-12-15",
    });

    expect(unitAStay.unitId).toBe(unitAId);
    expect(unitBStay.unitId).toBe(unitBId);
  });

  it("TC-D04: allows PENDING reservations to overlap each other and an existing CONFIRMED stay, but rejects confirming one that conflicts with DATE_CONFLICT", async () => {
    await insertReservationRaw({
      unitId: unitAId,
      status: "CONFIRMED",
      checkIn: "2026-12-10",
      checkOut: "2026-12-15",
    });

    const pending1 = await insertReservationRaw({
      unitId: unitAId,
      status: "PENDING",
      checkIn: "2026-12-12",
      checkOut: "2026-12-16",
    });

    const pending2 = await insertReservationRaw({
      unitId: unitAId,
      status: "PENDING",
      checkIn: "2026-12-12",
      checkOut: "2026-12-16",
    });

    expect(pending1.status).toBe("PENDING");
    expect(pending2.status).toBe("PENDING");

    // Confirming pending1 against existing CONFIRMED must fail with DateConflictError (23P01)
    await expect(confirmReservationWithConflictGuard(prisma, pending1.id)).rejects.toThrow(
      DateConflictError,
    );
  });

  it("TC-D05: CANCELLED stays do not block overlapping CONFIRMED stays on the same unit", async () => {
    await insertReservationRaw({
      unitId: unitAId,
      status: "CANCELLED",
      checkIn: "2026-12-10",
      checkOut: "2026-12-15",
    });

    const confirmed = await insertReservationRaw({
      unitId: unitAId,
      status: "CONFIRMED",
      checkIn: "2026-12-10",
      checkOut: "2026-12-15",
    });

    expect(confirmed.status).toBe("CONFIRMED");
  });

  it("TC-D06: rejects UnitBlock overlapping a stay and stay overlapping a UnitBlock (while allowing same-day boundary)", async () => {
    // 1. Block created first on 2026-12-20..2026-12-24
    await createUnitBlockWithConflictGuard(prisma, {
      unitId: unitAId,
      startDate: "2026-12-20",
      endDate: "2026-12-24",
      reason: "MAINTENANCE",
      note: "Pool pump service",
    });

    // Stay overlapping the block (2026-12-22..2026-12-26) is rejected
    await expect(
      createReservationWithConflictGuard(prisma, {
        code: nextCode(),
        unitId: unitAId,
        guestId,
        status: "CONFIRMED",
        checkIn: "2026-12-22",
        checkOut: "2026-12-26",
        adults: 2,
        nightlySubtotalIdr: 6_000_000,
        totalIdr: 6_000_000,
      }),
    ).rejects.toThrow(DateConflictError);

    // Stay starting on block endDate (2026-12-24..2026-12-27) is accepted (half-open [start,end))
    const adjacentStay = await createReservationWithConflictGuard(prisma, {
      code: nextCode(),
      unitId: unitAId,
      guestId,
      status: "CONFIRMED",
      checkIn: "2026-12-24",
      checkOut: "2026-12-27",
      adults: 2,
      nightlySubtotalIdr: 4_500_000,
      totalIdr: 4_500_000,
    });
    expect(adjacentStay.status).toBe("CONFIRMED");

    // 2. UnitBlock overlapping the existing CONFIRMED stay (2026-12-25..2026-12-28) is rejected
    await expect(
      createUnitBlockWithConflictGuard(prisma, {
        unitId: unitAId,
        startDate: "2026-12-25",
        endDate: "2026-12-28",
        reason: "OWNER_USE",
      }),
    ).rejects.toThrow(DateConflictError);
  });

  it("TC-D07: enforces database CHECK constraints on dates, nights, guest counts, and non-negative/positive amounts", async () => {
    // 1. checkOut == checkIn rejected (reservation_dates_valid)
    let sameDayErr: unknown = null;
    try {
      await insertReservationRaw({
        checkIn: "2026-12-10",
        checkOut: "2026-12-10",
        nights: 0,
      });
    } catch (err) {
      sameDayErr = err;
    }
    expect(isCheckConstraintViolation(sameDayErr, "reservation_dates_valid")).toBe(true);

    // 2. checkOut < checkIn rejected (reservation_dates_valid)
    let reversedDatesErr: unknown = null;
    try {
      await insertReservationRaw({
        checkIn: "2026-12-12",
        checkOut: "2026-12-10",
        nights: -2,
      });
    } catch (err) {
      reversedDatesErr = err;
    }
    expect(isCheckConstraintViolation(reversedDatesErr, "reservation_dates_valid")).toBe(true);

    // 3. nights != (checkOut - checkIn) rejected (reservation_nights_matches)
    let wrongNightsErr: unknown = null;
    try {
      await insertReservationRaw({
        checkIn: "2026-12-10",
        checkOut: "2026-12-13",
        nights: 5,
      });
    } catch (err) {
      wrongNightsErr = err;
    }
    expect(isCheckConstraintViolation(wrongNightsErr, "reservation_nights_matches")).toBe(true);

    // 4. adults < 1 rejected (reservation_guests_valid)
    let zeroAdultsErr: unknown = null;
    try {
      await insertReservationRaw({
        checkIn: "2026-12-10",
        checkOut: "2026-12-12",
        adults: 0,
      });
    } catch (err) {
      zeroAdultsErr = err;
    }
    expect(isCheckConstraintViolation(zeroAdultsErr, "reservation_guests_valid")).toBe(true);

    // 5. negative totalIdr rejected (reservation_amounts_valid)
    let negativeTotalErr: unknown = null;
    try {
      await insertReservationRaw({
        checkIn: "2026-12-10",
        checkOut: "2026-12-12",
        totalIdr: -100,
      });
    } catch (err) {
      negativeTotalErr = err;
    }
    expect(isCheckConstraintViolation(negativeTotalErr, "reservation_amounts_valid")).toBe(true);

    // 6. UnitBlock endDate <= startDate rejected (unit_block_dates_valid)
    let badBlockErr: unknown = null;
    try {
      await prisma.unitBlock.create({
        data: {
          unitId: unitAId,
          startDate: parseDateOnly("2026-12-10"),
          endDate: parseDateOnly("2026-12-10"),
          reason: "MAINTENANCE",
        },
      });
    } catch (err) {
      badBlockErr = err;
    }
    expect(isCheckConstraintViolation(badBlockErr, "unit_block_dates_valid")).toBe(true);

    // 7. RateRule endDate < startDate rejected (rate_rule_dates_valid)
    let badRateRuleErr: unknown = null;
    try {
      await prisma.rateRule.create({
        data: {
          unitId: unitAId,
          label: "Invalid Rule",
          startDate: parseDateOnly("2026-12-15"),
          endDate: parseDateOnly("2026-12-10"),
          nightlyRateIdr: 2_000_000,
        },
      });
    } catch (err) {
      badRateRuleErr = err;
    }
    expect(isCheckConstraintViolation(badRateRuleErr, "rate_rule_dates_valid")).toBe(true);

    // 8. Payment amountIdr <= 0 rejected (payment_amount_positive)
    const validRes = await insertReservationRaw({
      checkIn: "2026-12-10",
      checkOut: "2026-12-12",
    });

    let zeroPaymentErr: unknown = null;
    try {
      await prisma.payment.create({
        data: {
          reservationId: validRes.id,
          kind: "PAYMENT",
          amountIdr: 0,
          method: "CASH",
          paidAt: new Date(),
          recordedById: staffId,
        },
      });
    } catch (err) {
      zeroPaymentErr = err;
    }
    expect(isCheckConstraintViolation(zeroPaymentErr, "payment_amount_positive")).toBe(true);
  });

  it("seeds 40 fictional reservations across all statuses and payment states with argon2id hashed users", async () => {
    const summary = await runSeed(prisma, {
      ...process.env,
      NODE_ENV: "development",
      SEED_ADMIN_EMAIL: "admin@sagaravillas.example.com",
      SEED_ADMIN_PASSWORD: "SagaraDemoAdmin#2026!Secure",
      SEED_STAFF_EMAIL: "staff@sagaravillas.example.com",
      SEED_STAFF_PASSWORD: "SagaraDemoStaff#2026!Secure",
    });

    expect(summary.usersCount).toBe(2);
    expect(summary.unitsCount).toBe(5);
    expect(summary.amenitiesCount).toBe(10);
    expect(summary.guestsCount).toBe(20);
    expect(summary.reservationsCount).toBe(40);

    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@sagaravillas.example.com" },
    });
    expect(admin.role).toBe("ADMIN");
    expect(admin.passwordHash.startsWith("$argon2id$")).toBe(true);

    const statusCounts = await prisma.reservation.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const statuses = new Set(statusCounts.map((s) => s.status));
    expect(statuses).toEqual(
      new Set(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"]),
    );

    const paymentStatusCounts = await prisma.reservation.groupBy({
      by: ["paymentStatus"],
      _count: { _all: true },
    });
    const paymentStatuses = new Set(paymentStatusCounts.map((p) => p.paymentStatus));
    expect(paymentStatuses).toEqual(new Set(["UNPAID", "PARTIAL", "PAID"]));
  });
});
