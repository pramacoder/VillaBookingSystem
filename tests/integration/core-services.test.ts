import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadLocalEnvFiles } from "../../scripts/db-reset";
import { hashPassword } from "@/server/auth/password";
import {
  createUnitBlockService,
  getPublicUnitAvailability,
} from "@/server/services/availability-service";
import { anonymizeGuest, findOrCreateGuest } from "@/server/services/guest-service";
import { recordPayment, voidPayment } from "@/server/services/payment-service";
import { getPublicUnitQuote } from "@/server/services/pricing-service";
import {
  cancelReservation,
  checkInReservation,
  checkOutReservation,
  confirmReservation,
  createPublicInquiry,
  createStaffReservation,
  resetInquiryIdempotencyStore,
  updateReservation,
} from "@/server/services/reservation-service";

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

const TEST_SLUG = "m3-test-villa";
const TEST_ADMIN_EMAIL = "m3-admin@sagaravillas.example.com";
const TEST_STAFF_EMAIL = "m3-staff@sagaravillas.example.com";

let adminId = "";
let staffId = "";
let unitId = "";

async function cleanupM3Fixtures() {
  const existingUnit = await prisma.unit.findUnique({
    where: { slug: TEST_SLUG },
    select: { id: true },
  });

  if (existingUnit) {
    const reservations = await prisma.reservation.findMany({
      where: { unitId: existingUnit.id },
      select: { id: true, guestId: true },
    });
    const resIds = reservations.map((r) => r.id);
    const guestIds = [...new Set(reservations.map((r) => r.guestId))];

    if (resIds.length > 0) {
      await prisma.payment.deleteMany({
        where: { reservationId: { in: resIds } },
      });
      await prisma.reservation.deleteMany({
        where: { id: { in: resIds } },
      });
    }

    await prisma.unitBlock.deleteMany({
      where: { unitId: existingUnit.id },
    });
    await prisma.rateRule.deleteMany({
      where: { unitId: existingUnit.id },
    });
    await prisma.unit.delete({
      where: { id: existingUnit.id },
    });

    if (guestIds.length > 0) {
      await prisma.guest.deleteMany({
        where: {
          id: { in: guestIds },
          reservations: { none: {} },
        },
      });
    }
  }

  await prisma.guest.deleteMany({
    where: {
      OR: [
        { email: { startsWith: "m3-guest-" } },
        { fullName: { startsWith: "M3 Guest" } },
        { fullName: "Anonymized Guest" },
      ],
      reservations: { none: {} },
    },
  });
}

describe("M3 Core Services Integration & Concurrency Suite (BR-01..BR-15, TC-P*, TC-R*, TC-G*, TC-S*, TC-Y*, TC-C*)", () => {
  beforeAll(async () => {
    await cleanupM3Fixtures();
    const passwordHash = await hashPassword("SagaraM3Pass!2026");

    const admin = await prisma.user.upsert({
      where: { email: TEST_ADMIN_EMAIL },
      update: { isActive: true, role: "ADMIN" },
      create: {
        email: TEST_ADMIN_EMAIL,
        name: "M3 Test Admin",
        role: "ADMIN",
        passwordHash,
        isActive: true,
      },
    });
    adminId = admin.id;

    const staff = await prisma.user.upsert({
      where: { email: TEST_STAFF_EMAIL },
      update: { isActive: true, role: "STAFF" },
      create: {
        email: TEST_STAFF_EMAIL,
        name: "M3 Test Staff",
        role: "STAFF",
        passwordHash,
        isActive: true,
      },
    });
    staffId = staff.id;
  });

  beforeEach(async () => {
    resetInquiryIdempotencyStore();
    await cleanupM3Fixtures();

    const unit = await prisma.unit.create({
      data: {
        slug: TEST_SLUG,
        status: "ACTIVE",
        nameEn: "M3 Test Pool Villa",
        nameId: "Vila Kolam Uji M3",
        summaryEn: "Test summary EN",
        summaryId: "Ringkasan uji ID",
        descriptionEn: "Full description EN",
        descriptionId: "Deskripsi lengkap ID",
        bedrooms: 2,
        bathrooms: 2,
        maxGuests: 4,
        areaSqm: 140,
        baseRateIdr: 1_500_000,
        cleaningFeeIdr: 250_000,
        minNights: 2,
        maxNights: 14,
      },
    });
    unitId = unit.id;
  });

  afterAll(async () => {
    await cleanupM3Fixtures();
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [adminId, staffId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminId, staffId] } },
    });
    await prisma.$disconnect();
  });

  it("TC-P04 & TC-P05 (BR-08): quote matches stored reservation amounts, and changing unit base rate does not alter existing reservations", async () => {
    const fixedNow = new Date("2026-11-04T04:00:00.000Z"); // 2026-11-04 in Asia/Makassar

    const quote = await getPublicUnitQuote(prisma, {
      unitSlug: TEST_SLUG,
      checkIn: "2026-11-20",
      checkOut: "2026-11-23", // 3 nights
      adults: 2,
      children: 1,
    });

    expect(quote.nights).toBe(3);
    expect(quote.nightlySubtotalIdr).toBe(4_500_000);
    expect(quote.cleaningFeeIdr).toBe(250_000);
    expect(quote.totalIdr).toBe(4_750_000);
    expect(quote.available).toBe(true);
    expect(quote.isDemo).toBe(true);

    const inquiry = await createPublicInquiry(
      prisma,
      {
        unitSlug: TEST_SLUG,
        checkIn: "2026-11-20",
        checkOut: "2026-11-23",
        adults: 2,
        children: 1,
        name: "M3 Guest Quote",
        email: "m3-guest-quote@example.com",
        privacyAccepted: true,
        locale: "en",
      },
      { now: fixedNow },
    );

    const stored = await prisma.reservation.findUniqueOrThrow({
      where: { id: inquiry.id },
    });
    expect(stored.totalIdr).toBe(quote.totalIdr);
    expect(stored.nightlySubtotalIdr).toBe(quote.nightlySubtotalIdr);
    expect(stored.cleaningFeeIdr).toBe(quote.cleaningFeeIdr);

    // TC-P04: Change unit base rate from 1,500,000 to 2,800,000
    await prisma.unit.update({
      where: { id: unitId },
      data: { baseRateIdr: 2_800_000 },
    });

    const afterRateChange = await prisma.reservation.findUniqueOrThrow({
      where: { id: inquiry.id },
    });
    expect(afterRateChange.totalIdr).toBe(4_750_000);
    expect(afterRateChange.nightlySubtotalIdr).toBe(4_500_000);
  });

  it("TC-R01..TC-R07, TC-D09, TC-X10: enforces public inquiry rules, honeypot, idempotency, past check-in rules, blocked dates, and PII-free availability", async () => {
    const fixedNow = new Date("2026-11-04T04:00:00.000Z"); // Today = 2026-11-04 in Asia/Makassar

    // TC-R04: Honeypot filled -> returns 201-style PENDING payload, stores nothing in DB
    const honeypotRes = await createPublicInquiry(
      prisma,
      {
        unitSlug: TEST_SLUG,
        checkIn: "2026-11-15",
        checkOut: "2026-11-18",
        adults: 2,
        children: 0,
        name: "M3 Guest Bot",
        email: "m3-guest-bot@example.com",
        privacyAccepted: true,
        locale: "en",
        website: "https://spam-bot.example.com",
      },
      { now: fixedNow },
    );
    expect(honeypotRes.status).toBe("PENDING");
    expect(honeypotRes.honeypotTriggered).toBe(true);
    const botCount = await prisma.reservation.count({
      where: { unitId },
    });
    expect(botCount).toBe(0);

    // TC-R03: privacyAccepted required
    await expect(
      createPublicInquiry(
        prisma,
        {
          unitSlug: TEST_SLUG,
          checkIn: "2026-11-15",
          checkOut: "2026-11-18",
          adults: 2,
          children: 0,
          name: "M3 Guest No Consent",
          email: "m3-guest-noconsent@example.com",
          privacyAccepted: false,
          locale: "en",
        },
        { now: fixedNow },
      ),
    ).rejects.toThrow();

    // TC-D09 (BR-13): Past check-in rejected for public inquiry
    await expect(
      createPublicInquiry(
        prisma,
        {
          unitSlug: TEST_SLUG,
          checkIn: "2026-11-02", // before 2026-11-04
          checkOut: "2026-11-05",
          adults: 2,
          children: 0,
          name: "M3 Guest Past",
          email: "m3-guest-past@example.com",
          privacyAccepted: true,
          locale: "en",
        },
        { now: fixedNow },
      ),
    ).rejects.toMatchObject({ code: "BUSINESS_RULE", status: 422 });

    // TC-D09 (BR-13): Staff MAY backdate check-in (walk-in/correction) and action is audited
    const backdatedStaffRes = await createStaffReservation(
      prisma,
      {
        unitId,
        checkIn: "2026-10-20",
        checkOut: "2026-10-23",
        adults: 2,
        children: 0,
        status: "CONFIRMED",
        source: "ADMIN",
        guest: {
          fullName: "M3 Guest Backdated Walk-in",
          email: "m3-guest-walkin@example.com",
        },
      },
      { actorId: staffId, now: fixedNow },
    );
    expect(backdatedStaffRes.status).toBe("CONFIRMED");

    const backdateAudit = await prisma.auditLog.findFirst({
      where: {
        entityType: "Reservation",
        entityId: backdatedStaffRes.id,
        action: "reservation.create",
      },
    });
    expect(backdateAudit?.metadata).toMatchObject({ backdated: true });

    // TC-R01 & TC-R06: Valid public inquiry + Idempotency-Key replay
    const firstInquiry = await createPublicInquiry(
      prisma,
      {
        unitSlug: TEST_SLUG,
        checkIn: "2026-12-01",
        checkOut: "2026-12-04",
        adults: 2,
        children: 0,
        name: "M3 Guest Idempotent",
        email: "m3-guest-idem@example.com",
        privacyAccepted: true,
        locale: "en",
      },
      { idempotencyKey: "idem-key-001", now: fixedNow },
    );

    const replayInquiry = await createPublicInquiry(
      prisma,
      {
        unitSlug: TEST_SLUG,
        checkIn: "2026-12-01",
        checkOut: "2026-12-04",
        adults: 2,
        children: 0,
        name: "M3 Guest Idempotent",
        email: "m3-guest-idem@example.com",
        privacyAccepted: true,
        locale: "en",
      },
      { idempotencyKey: "idem-key-001", now: fixedNow },
    );

    expect(replayInquiry.id).toBe(firstInquiry.id);
    expect(replayInquiry.code).toBe(firstInquiry.code);

    // Confirm firstInquiry so [2026-12-01, 2026-12-04) is now blocked
    await confirmReservation(prisma, {
      reservationId: firstInquiry.id,
      actorId: staffId,
      now: fixedNow,
    });

    // TC-R07: Public inquiry for already blocked dates returns 409 DATE_CONFLICT
    await expect(
      createPublicInquiry(
        prisma,
        {
          unitSlug: TEST_SLUG,
          checkIn: "2026-12-02",
          checkOut: "2026-12-05",
          adults: 2,
          children: 0,
          name: "M3 Guest Blocked",
          email: "m3-guest-blocked@example.com",
          privacyAccepted: true,
          locale: "en",
        },
        { now: fixedNow },
      ),
    ).rejects.toMatchObject({ code: "DATE_CONFLICT", status: 409 });

    // TC-X10 (SEC-09): Public availability endpoint returns ONLY blocked ranges & minNights, zero guest PII
    const availability = await getPublicUnitAvailability(prisma, {
      unitSlug: TEST_SLUG,
      from: "2026-11-30",
      to: "2026-12-10",
    });
    expect(availability).toEqual({
      unit: TEST_SLUG,
      blockedRanges: [["2026-12-01", "2026-12-04"]],
      minNights: 2,
    });
    const serializedAvail = JSON.stringify(availability);
    expect(serializedAvail).not.toContain("m3-guest-idem");
    expect(serializedAvail).not.toContain(firstInquiry.code);
  });

  it("TC-D06 & TC-D11: unit blocks reject overlapping stays, and editing reservation dates to a conflicting range rolls back cleanly", async () => {
    const fixedNow = new Date("2026-11-04T04:00:00.000Z");

    const resA = await createStaffReservation(
      prisma,
      {
        unitId,
        checkIn: "2026-12-10",
        checkOut: "2026-12-14",
        adults: 2,
        children: 0,
        status: "CONFIRMED",
        guest: {
          fullName: "M3 Guest Stay A",
          email: "m3-guest-staya@example.com",
        },
      },
      { actorId: adminId, now: fixedNow },
    );

    // TC-D06: Creating a UnitBlock overlapping CONFIRMED resA fails with 409 DATE_CONFLICT
    await expect(
      createUnitBlockService(
        prisma,
        {
          unitId,
          startDate: "2026-12-12",
          endDate: "2026-12-15",
          reason: "MAINTENANCE",
          note: "Pool maintenance",
        },
        adminId,
      ),
    ).rejects.toMatchObject({ code: "DATE_CONFLICT", status: 409 });

    // Creating a UnitBlock on free dates [2026-12-20, 2026-12-23) succeeds
    await createUnitBlockService(
      prisma,
      {
        unitId,
        startDate: "2026-12-20",
        endDate: "2026-12-23",
        reason: "MAINTENANCE",
        note: "Roof inspection",
      },
      adminId,
    );

    // TC-D11: Editing resA to overlap the block [2026-12-20, 2026-12-23) fails and leaves resA untouched
    await expect(
      updateReservation(prisma, {
        reservationId: resA.id,
        expectedVersion: resA.version,
        rawPatch: {
          checkIn: "2026-12-19",
          checkOut: "2026-12-22",
        },
        actorId: adminId,
      }),
    ).rejects.toMatchObject({ code: "DATE_CONFLICT", status: 409 });

    const unchangedResA = await prisma.reservation.findUniqueOrThrow({
      where: { id: resA.id },
    });
    expect(unchangedResA.version).toBe(resA.version);
    expect(unchangedResA.checkIn.toISOString().slice(0, 10)).toBe("2026-12-10");
  });

  it("TC-G01..TC-G04 (BR-15): deduplicates guests by email and phone and anonymizes guest PII without losing reservations or payments", async () => {
    // TC-G01: Same email with different casing/spacing reuses the guest record
    const g1 = await findOrCreateGuest(prisma, {
      fullName: "M3 Guest Ayu",
      email: "  M3-Guest-Ayu@Example.COM ",
      phone: "+62 812-1111-2222",
    });

    const g1Duplicate = await findOrCreateGuest(prisma, {
      fullName: "M3 Guest Ayu Updated",
      email: "m3-guest-ayu@example.com",
    });
    expect(g1Duplicate.id).toBe(g1.id);

    // TC-G02: Phone-only guest reuses existing record with the same normalized phone
    const g2PhoneOnly = await findOrCreateGuest(prisma, {
      fullName: "M3 Guest Phone Only",
      email: null,
      phone: "+62 813 9999 8888",
    });

    const g2PhoneReuse = await findOrCreateGuest(prisma, {
      fullName: "M3 Guest Phone Only Again",
      email: null,
      phone: "+62-813-9999-8888",
    });
    expect(g2PhoneReuse.id).toBe(g2PhoneOnly.id);

    // TC-G03: Different email with same phone as g1 (who already has an email) creates a distinct guest record
    const g3DifferentEmail = await findOrCreateGuest(prisma, {
      fullName: "M3 Guest Family Member",
      email: "m3-guest-family@example.com",
      phone: "+6281211112222",
    });
    expect(g3DifferentEmail.id).not.toBe(g1.id);

    // TC-G04: Anonymize removes PII while keeping reservation and payment records intact
    const res = await createStaffReservation(
      prisma,
      {
        unitId,
        checkIn: "2026-11-25",
        checkOut: "2026-11-27",
        adults: 2,
        children: 0,
        status: "CONFIRMED",
        guest: {
          fullName: "M3 Guest To Anonymize",
          email: "m3-guest-anon@example.com",
          phone: "+6281277776666",
        },
      },
      { actorId: adminId },
    );

    await recordPayment(prisma, {
      reservationId: res.id,
      rawInput: {
        kind: "PAYMENT",
        amountIdr: 1_000_000,
        method: "BANK_TRANSFER",
      },
      actorId: adminId,
    });

    const anonymized = await anonymizeGuest(prisma, {
      guestId: res.guestId,
      actorId: adminId,
    });
    expect(anonymized.fullName).toBe("Anonymized Guest");
    expect(anonymized.email).toBeNull();
    expect(anonymized.phone).toBeNull();

    const preservedRes = await prisma.reservation.findUniqueOrThrow({
      where: { id: res.id },
      include: { payments: true },
    });
    expect(preservedRes.netPaidIdr).toBe(1_000_000);
    expect(preservedRes.payments).toHaveLength(1);
  });

  it("TC-S01..TC-S04 (BR-12): enforces allowed transitions, timestamps, required cancel reason, and early check-in guard", async () => {
    const fixedNow = new Date("2026-11-04T04:00:00.000Z"); // 2026-11-04 in Asia/Makassar

    const pending = await createStaffReservation(
      prisma,
      {
        unitId,
        checkIn: "2026-11-10",
        checkOut: "2026-11-12",
        adults: 2,
        children: 0,
        status: "PENDING",
        guest: {
          fullName: "M3 Guest Workflow",
          email: "m3-guest-workflow@example.com",
        },
      },
      { actorId: staffId, now: fixedNow },
    );

    // Confirm: PENDING -> CONFIRMED
    const confirmed = await confirmReservation(prisma, {
      reservationId: pending.id,
      actorId: staffId,
      now: fixedNow,
    });
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.confirmedAt).not.toBeNull();

    // TC-S04: Check-in on 2026-11-04 (before checkIn 2026-11-10) rejected without override
    await expect(
      checkInReservation(prisma, {
        reservationId: confirmed.id,
        actorId: staffId,
        now: fixedNow,
      }),
    ).rejects.toMatchObject({ code: "BUSINESS_RULE", status: 422 });

    // Check-in on scheduled date 2026-11-10 succeeds
    const checkInTime = new Date("2026-11-10T06:00:00.000Z");
    const checkedIn = await checkInReservation(prisma, {
      reservationId: confirmed.id,
      actorId: staffId,
      now: checkInTime,
    });
    expect(checkedIn.status).toBe("CHECKED_IN");
    expect(checkedIn.checkedInAt?.toISOString()).toBe(checkInTime.toISOString());

    // TC-S02: Disallowed transition CHECKED_IN -> CANCELLED fails with 409 INVALID_TRANSITION
    await expect(
      cancelReservation(prisma, {
        reservationId: checkedIn.id,
        rawInput: { reason: "Try cancelling after check-in" },
        actorId: staffId,
        now: checkInTime,
      }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION", status: 409 });

    // Check-out: CHECKED_IN -> CHECKED_OUT
    const checkOutTime = new Date("2026-11-12T03:00:00.000Z");
    const checkedOut = await checkOutReservation(prisma, {
      reservationId: checkedIn.id,
      actorId: staffId,
      now: checkOutTime,
    });
    expect(checkedOut.status).toBe("CHECKED_OUT");
    expect(checkedOut.checkedOutAt?.toISOString()).toBe(checkOutTime.toISOString());

    // TC-S03: Cancel requires a non-empty reason
    const toCancel = await createStaffReservation(
      prisma,
      {
        unitId,
        checkIn: "2026-11-15",
        checkOut: "2026-11-17",
        adults: 2,
        children: 0,
        status: "PENDING",
        guest: {
          fullName: "M3 Guest Cancel",
          email: "m3-guest-cancel@example.com",
        },
      },
      { actorId: staffId, now: fixedNow },
    );

    await expect(
      cancelReservation(prisma, {
        reservationId: toCancel.id,
        rawInput: { reason: "   " },
        actorId: staffId,
        now: fixedNow,
      }),
    ).rejects.toThrow();

    const cancelled = await cancelReservation(prisma, {
      reservationId: toCancel.id,
      rawInput: { reason: "Guest requested date change" },
      actorId: staffId,
      now: fixedNow,
    });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelReason).toBe("Guest requested date change");
    expect(cancelled.cancelledAt).not.toBeNull();
  });

  it("TC-Y01..TC-Y08 (DATABASE.md §5.4): executes full payment transition table, void permissions, overpaid calculation, and refundPending flag", async () => {
    const day1 = new Date("2026-11-04T04:00:00.000Z"); // 2026-11-04 in Asia/Makassar
    const day2 = new Date("2026-11-05T04:00:00.000Z"); // 2026-11-05 in Asia/Makassar

    // Create a 2-night reservation with totalIdr = 3,000,000 (2 * 1,500,000 + 250,000 cleaning - 250,000 discount)
    const res = await createStaffReservation(
      prisma,
      {
        unitId,
        checkIn: "2026-12-01",
        checkOut: "2026-12-03",
        adults: 2,
        children: 0,
        discountIdr: 250_000,
        status: "CONFIRMED",
        guest: {
          fullName: "M3 Guest Payments",
          email: "m3-guest-payments@example.com",
        },
      },
      { actorId: staffId, now: day1 },
    );
    expect(res.totalIdr).toBe(3_000_000);
    expect(res.netPaidIdr).toBe(0);
    expect(res.paymentStatus).toBe("UNPAID");

    // TC-Y07: Amount <= 0 or non-integer rejected
    await expect(
      recordPayment(prisma, {
        reservationId: res.id,
        rawInput: { kind: "PAYMENT", amountIdr: 0, method: "CASH" },
        actorId: staffId,
      }),
    ).rejects.toThrow();

    await expect(
      recordPayment(prisma, {
        reservationId: res.id,
        rawInput: { kind: "PAYMENT", amountIdr: 1500.5, method: "CASH" },
        actorId: staffId,
      }),
    ).rejects.toThrow();

    // Row 2 of §5.4: +1,000,000 -> net = 1,000,000, PARTIAL (TC-Y01)
    const p1 = await recordPayment(prisma, {
      reservationId: res.id,
      rawInput: {
        kind: "PAYMENT",
        amountIdr: 1_000_000,
        method: "BANK_TRANSFER",
        reference: "TRX-1",
      },
      actorId: staffId,
      now: day1,
    });
    expect(p1.netPaidIdr).toBe(1_000_000);
    expect(p1.paymentStatus).toBe("PARTIAL");
    expect(p1.overpaidIdr).toBe(0);

    // Row 3 of §5.4: +2,000,000 -> net = 3,000,000, PAID (TC-Y01)
    const p2 = await recordPayment(prisma, {
      reservationId: res.id,
      rawInput: {
        kind: "PAYMENT",
        amountIdr: 2_000_000,
        method: "BANK_TRANSFER",
        reference: "TRX-2",
      },
      actorId: staffId,
      now: day1,
    });
    expect(p2.netPaidIdr).toBe(3_000_000);
    expect(p2.paymentStatus).toBe("PAID");
    expect(p2.overpaidIdr).toBe(0);

    // Row 4 of §5.4: refund 500,000 -> net = 2,500,000, PARTIAL (TC-Y04)
    const r1 = await recordPayment(prisma, {
      reservationId: res.id,
      rawInput: {
        kind: "REFUND",
        amountIdr: 500_000,
        method: "BANK_TRANSFER",
        note: "Partial refund",
      },
      actorId: staffId,
      now: day1,
    });
    expect(r1.netPaidIdr).toBe(2_500_000);
    expect(r1.paymentStatus).toBe("PARTIAL");

    // Row 5 of §5.4: +1,000,000 -> net = 3,500,000, PAID (overpaid 500,000) (TC-Y05)
    const p3 = await recordPayment(prisma, {
      reservationId: res.id,
      rawInput: {
        kind: "PAYMENT",
        amountIdr: 1_000_000,
        method: "CASH",
      },
      actorId: staffId,
      now: day1,
    });
    expect(p3.netPaidIdr).toBe(3_500_000);
    expect(p3.paymentStatus).toBe("PAID");
    expect(p3.overpaidIdr).toBe(500_000);

    // TC-Y02: STAFF can void same-day payment (day1), but cannot void on day2
    const voidP3 = await voidPayment(prisma, {
      paymentId: p3.payment.id,
      rawInput: { reason: "Duplicate cash entry" },
      actorId: staffId,
      actorRole: "STAFF",
      now: day1,
    });
    expect(voidP3.netPaidIdr).toBe(2_500_000);
    expect(voidP3.paymentStatus).toBe("PARTIAL");
    expect(voidP3.payment.voidReason).toBe("Duplicate cash entry");

    // On day2, STAFF attempting to void p2 (created on day1) is rejected with 403 FORBIDDEN
    await expect(
      voidPayment(prisma, {
        paymentId: p2.payment.id,
        rawInput: { reason: "Next day staff void attempt" },
        actorId: staffId,
        actorRole: "STAFF",
        now: day2,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    // ADMIN can void p2 on day2
    const voidP2 = await voidPayment(prisma, {
      paymentId: p2.payment.id,
      rawInput: { reason: "Admin reversal" },
      actorId: adminId,
      actorRole: "ADMIN",
      now: day2,
    });
    expect(voidP2.netPaidIdr).toBe(500_000); // 1,000,000 (p1) - 500,000 (r1) = 500,000
    expect(voidP2.paymentStatus).toBe("PARTIAL");

    // TC-Y06 (BR-11): Cancelling reservation with netPaidIdr > 0 keeps payments and sets refundPending: true
    const cancelledWithPaid = await cancelReservation(prisma, {
      reservationId: res.id,
      rawInput: { reason: "Flight cancelled" },
      actorId: adminId,
      now: day2,
    });
    expect(cancelledWithPaid.refundPending).toBe(true);
    expect(cancelledWithPaid.netPaidIdr).toBe(500_000);

    // TC-Y08: Verify audit entries exist for payment.record, payment.refund, and payment.void
    const paymentAudits = await prisma.auditLog.findMany({
      where: {
        entityType: "Payment",
        entityId: { in: [p1.payment.id, p2.payment.id, r1.payment.id, p3.payment.id] },
      },
    });
    expect(paymentAudits.length).toBeGreaterThanOrEqual(6);
  });

  it("TC-C01..TC-C04: proves concurrency safety under parallel confirms, parallel staff creations, parallel If-Match edits, and parallel payments", async () => {
    const fixedNow = new Date("2026-11-04T04:00:00.000Z");

    // 1. TC-C01: Two simultaneous confirms of overlapping PENDING reservations -> exactly one CONFIRMED, one DATE_CONFLICT
    const pending1 = await createStaffReservation(
      prisma,
      {
        unitId,
        checkIn: "2027-01-10",
        checkOut: "2027-01-14",
        adults: 2,
        children: 0,
        status: "PENDING",
        guest: {
          fullName: "M3 Guest Concurrent 1",
          email: "m3-guest-conc1@example.com",
        },
      },
      { actorId: staffId, now: fixedNow },
    );

    const pending2 = await createStaffReservation(
      prisma,
      {
        unitId,
        checkIn: "2027-01-12",
        checkOut: "2027-01-16",
        adults: 2,
        children: 0,
        status: "PENDING",
        guest: {
          fullName: "M3 Guest Concurrent 2",
          email: "m3-guest-conc2@example.com",
        },
      },
      { actorId: staffId, now: fixedNow },
    );

    const confirmSettled = await Promise.allSettled([
      confirmReservation(prisma, {
        reservationId: pending1.id,
        actorId: staffId,
        now: fixedNow,
      }),
      confirmReservation(prisma, {
        reservationId: pending2.id,
        actorId: adminId,
        now: fixedNow,
      }),
    ]);

    const confirmSuccesses = confirmSettled.filter((r) => r.status === "fulfilled");
    const confirmFailures = confirmSettled.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    expect(confirmSuccesses).toHaveLength(1);
    expect(confirmFailures).toHaveLength(1);
    expect(confirmFailures[0]?.reason).toMatchObject({
      code: "DATE_CONFLICT",
      status: 409,
    });

    // 2. TC-C02: Two simultaneous staff creations (CONFIRMED) for the same range -> exactly one succeeds
    const createSettled = await Promise.allSettled([
      createStaffReservation(
        prisma,
        {
          unitId,
          checkIn: "2027-02-01",
          checkOut: "2027-02-04",
          adults: 2,
          children: 0,
          status: "CONFIRMED",
          guest: {
            fullName: "M3 Guest Parallel Create A",
            email: "m3-guest-parcreatea@example.com",
          },
        },
        { actorId: staffId, now: fixedNow },
      ),
      createStaffReservation(
        prisma,
        {
          unitId,
          checkIn: "2027-02-02",
          checkOut: "2027-02-05",
          adults: 2,
          children: 0,
          status: "CONFIRMED",
          guest: {
            fullName: "M3 Guest Parallel Create B",
            email: "m3-guest-parcreateb@example.com",
          },
        },
        { actorId: adminId, now: fixedNow },
      ),
    ]);

    expect(createSettled.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const createRejected = createSettled.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    expect(createRejected).toHaveLength(1);
    expect(createRejected[0]?.reason).toMatchObject({
      code: "DATE_CONFLICT",
      status: 409,
    });

    // 3. TC-C03: Two simultaneous edits with the same If-Match version -> one succeeds, one VERSION_CONFLICT
    const editableRes = await createStaffReservation(
      prisma,
      {
        unitId,
        checkIn: "2027-03-01",
        checkOut: "2027-03-04",
        adults: 2,
        children: 0,
        status: "PENDING",
        guest: {
          fullName: "M3 Guest Editable",
          email: "m3-guest-editable@example.com",
        },
      },
      { actorId: staffId, now: fixedNow },
    );

    const editSettled = await Promise.allSettled([
      updateReservation(prisma, {
        reservationId: editableRes.id,
        expectedVersion: editableRes.version,
        rawPatch: { adults: 3, internalNotes: "Edit A" },
        actorId: staffId,
      }),
      updateReservation(prisma, {
        reservationId: editableRes.id,
        expectedVersion: editableRes.version,
        rawPatch: { adults: 4, internalNotes: "Edit B" },
        actorId: adminId,
      }),
    ]);

    expect(editSettled.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const editRejected = editSettled.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    expect(editRejected).toHaveLength(1);
    expect(editRejected[0]?.reason).toMatchObject({
      code: "VERSION_CONFLICT",
      status: 409,
    });

    // 4. TC-C04: Four concurrent payment recordings on one reservation produce exact netPaidIdr (no lost update)
    const payAmounts = [400_000, 600_000, 800_000, 1_200_000];
    await Promise.all(
      payAmounts.map((amountIdr, idx) =>
        recordPayment(prisma, {
          reservationId: editableRes.id,
          rawInput: {
            kind: "PAYMENT",
            amountIdr,
            method: "BANK_TRANSFER",
            reference: `CONC-PAY-${idx + 1}`,
          },
          actorId: staffId,
          now: fixedNow,
        }),
      ),
    );

    const finalRes = await prisma.reservation.findUniqueOrThrow({
      where: { id: editableRes.id },
    });
    expect(finalRes.netPaidIdr).toBe(3_000_000);
  });
});
