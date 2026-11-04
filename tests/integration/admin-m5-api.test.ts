import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/server/auth/password";

const currentTestSession = vi.hoisted(() => {
  const defaultLocalDbUrl =
    "postgresql://sagara:sagara_local_dev@localhost:5433/sagara_villas?schema=public";
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = defaultLocalDbUrl;
  }
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
  return {
    value: null as Session | null,
  };
});

vi.mock("@/server/auth", () => ({
  auth: async () => currentTestSession.value,
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { GET as getAuditLogs } from "@/app/api/admin/audit/route";
import { POST as postAnonymizeGuest } from "@/app/api/admin/guests/[id]/anonymize/route";
import {
  GET as getGuestDetailRoute,
  PATCH as patchGuestRoute,
} from "@/app/api/admin/guests/[id]/route";
import { GET as getGuestsRoute, POST as postGuestsRoute } from "@/app/api/admin/guests/route";
import { POST as postVoidPaymentRoute } from "@/app/api/admin/payments/[paymentId]/void/route";
import { POST as postCancelReservationRoute } from "@/app/api/admin/reservations/[id]/cancel/route";
import { POST as postCheckInReservationRoute } from "@/app/api/admin/reservations/[id]/check-in/route";
import { POST as postCheckOutReservationRoute } from "@/app/api/admin/reservations/[id]/check-out/route";
import { POST as postConfirmReservationRoute } from "@/app/api/admin/reservations/[id]/confirm/route";
import { POST as postRecordPaymentRoute } from "@/app/api/admin/reservations/[id]/payments/route";
import {
  GET as getReservationDetailRoute,
  PATCH as patchReservationRoute,
} from "@/app/api/admin/reservations/[id]/route";
import {
  GET as getReservationsRoute,
  POST as postReservationsRoute,
} from "@/app/api/admin/reservations/route";

const prisma = new PrismaClient();
const TEST_PREFIX = "m5-api-test-";
const SITE_ORIGIN = "http://localhost:3000";

function collectRouteAndPageFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectRouteAndPageFiles(full, out);
    } else if (entry.name === "route.ts" || entry.name === "page.tsx") {
      out.push(full);
    }
  }
  return out;
}

describe("M5 Admin API, RBAC, Optimistic Concurrency, Payments & Audit Suite", () => {
  let adminUser: { id: string; email: string; name: string; role: "ADMIN" };
  let staffUser: { id: string; email: string; name: string; role: "STAFF" };
  let testUnit: { id: string; slug: string };

  async function cleanupTestData() {
    const units = await prisma.unit.findMany({
      where: { slug: { startsWith: TEST_PREFIX } },
      select: { id: true },
    });
    const unitIds = units.map((u) => u.id);

    const reservations = await prisma.reservation.findMany({
      where: {
        OR: [{ unitId: { in: unitIds } }, { guest: { email: { startsWith: TEST_PREFIX } } }],
      },
      select: { id: true },
    });
    const resIds = reservations.map((r) => r.id);

    if (resIds.length > 0) {
      const payments = await prisma.payment.findMany({
        where: { reservationId: { in: resIds } },
        select: { id: true },
      });
      const payIds = payments.map((p) => p.id);
      if (payIds.length > 0) {
        await prisma.auditLog.deleteMany({
          where: { entityType: "Payment", entityId: { in: payIds } },
        });
        await prisma.payment.deleteMany({
          where: { id: { in: payIds } },
        });
      }
      await prisma.auditLog.deleteMany({
        where: { entityType: "Reservation", entityId: { in: resIds } },
      });
      await prisma.reservation.deleteMany({
        where: { id: { in: resIds } },
      });
    }

    await prisma.guest.deleteMany({
      where: {
        OR: [{ email: { startsWith: TEST_PREFIX } }, { notes: { contains: TEST_PREFIX } }],
      },
    });
  }

  beforeAll(async () => {
    await cleanupTestData();
    const passwordHash = await hashPassword("SagaraTestPass!2026");

    const createdAdmin = await prisma.user.upsert({
      where: { email: `${TEST_PREFIX}admin@sagaravillas.example.com` },
      update: { isActive: true, role: "ADMIN" },
      create: {
        email: `${TEST_PREFIX}admin@sagaravillas.example.com`,
        name: "M5 Admin Tester",
        role: "ADMIN",
        passwordHash,
        isActive: true,
      },
    });
    adminUser = {
      id: createdAdmin.id,
      email: createdAdmin.email,
      name: createdAdmin.name,
      role: "ADMIN",
    };

    const createdStaff = await prisma.user.upsert({
      where: { email: `${TEST_PREFIX}staff@sagaravillas.example.com` },
      update: { isActive: true, role: "STAFF" },
      create: {
        email: `${TEST_PREFIX}staff@sagaravillas.example.com`,
        name: "M5 Staff Tester",
        role: "STAFF",
        passwordHash,
        isActive: true,
      },
    });
    staffUser = {
      id: createdStaff.id,
      email: createdStaff.email,
      name: createdStaff.name,
      role: "STAFF",
    };

    const createdUnit = await prisma.unit.upsert({
      where: { slug: `${TEST_PREFIX}ocean-villa` },
      update: {
        status: "ACTIVE",
        baseRateIdr: 2_000_000,
        cleaningFeeIdr: 250_000,
        maxGuests: 4,
        minNights: 1,
      },
      create: {
        slug: `${TEST_PREFIX}ocean-villa`,
        nameEn: "M5 Test Ocean Villa",
        nameId: "Villa Laut Uji M5",
        summaryEn: "Test summary EN",
        summaryId: "Ringkasan uji ID",
        descriptionEn: "Test description EN",
        descriptionId: "Deskripsi uji ID",
        status: "ACTIVE",
        bedrooms: 2,
        bathrooms: 2,
        maxGuests: 4,
        areaSqm: 120,
        baseRateIdr: 2_000_000,
        cleaningFeeIdr: 250_000,
        minNights: 1,
        maxNights: 14,
      },
    });
    testUnit = { id: createdUnit.id, slug: createdUnit.slug };
  });

  beforeEach(async () => {
    currentTestSession.value = null;
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.unit.deleteMany({
      where: { slug: { startsWith: TEST_PREFIX } },
    });
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [adminUser.id, staffUser.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUser.id, staffUser.id] } },
    });
    await prisma.$disconnect();
  });

  function setSession(user: typeof adminUser | typeof staffUser | null) {
    if (!user) {
      currentTestSession.value = null;
      return;
    }
    currentTestSession.value = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    } as unknown as Session;
  }

  it("TC-X06 (SEC-05): meta-test verifies every /api/admin/** route and /admin/(app)/** page calls requireRole or requirePageRole", () => {
    const apiAdminDir = path.join(process.cwd(), "src", "app", "api", "admin");
    const appAdminDir = path.join(process.cwd(), "src", "app", "admin", "(app)");
    const files = [
      ...collectRouteAndPageFiles(apiAdminDir),
      ...collectRouteAndPageFiles(appAdminDir),
    ];

    expect(files.length).toBeGreaterThanOrEqual(15);

    const missingGuard: string[] = [];
    for (const filePath of files) {
      const source = fs.readFileSync(filePath, "utf8");
      if (!source.includes("requireRole(") && !source.includes("requirePageRole(")) {
        missingGuard.push(path.relative(process.cwd(), filePath));
      }
    }

    expect(missingGuard).toEqual([]);
  });

  it("TC-X05 & TC-X07: enforces RBAC across M5 endpoints (401 anonymous, 403 STAFF on ADMIN-only anonymize/audit, 403 cross-origin POST)", async () => {
    // 1. Anonymous GET /api/admin/reservations -> 401
    setSession(null);
    const anonRes = await getReservationsRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations`),
    );
    expect(anonRes.status).toBe(401);

    // 2. Cross-origin POST /api/admin/reservations -> 403 FORBIDDEN (TC-X07)
    setSession(staffUser);
    const crossOriginPost = await postReservationsRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example.com",
          "sec-fetch-site": "cross-site",
        },
        body: JSON.stringify({}),
      }),
    );
    expect(crossOriginPost.status).toBe(403);

    // 3. STAFF accessing GET /api/admin/audit -> 403 FORBIDDEN
    const staffAuditRes = await getAuditLogs(new Request(`${SITE_ORIGIN}/api/admin/audit`));
    expect(staffAuditRes.status).toBe(403);

    // 4. ADMIN accessing GET /api/admin/audit -> 200 OK
    setSession(adminUser);
    const adminAuditRes = await getAuditLogs(
      new Request(`${SITE_ORIGIN}/api/admin/audit?limit=10`),
    );
    expect(adminAuditRes.status).toBe(200);
  });

  it("FR-14, TC-C03, TC-U15, TC-S01..TC-S03: creates reservation, filters list, enforces If-Match version conflict, and executes status transitions", async () => {
    setSession(staffUser);

    // 1. Create a PENDING staff reservation
    const createRes = await postReservationsRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
        },
        body: JSON.stringify({
          unitId: testUnit.id,
          checkIn: "2027-06-10",
          checkOut: "2027-06-13",
          adults: 2,
          children: 1,
          status: "PENDING",
          source: "WHATSAPP",
          discountIdr: 150_000,
          locale: "en",
          specialRequests: "Baby cot please",
          internalNotes: `${TEST_PREFIX}note`,
          guest: {
            fullName: "Made Wirawan",
            email: `${TEST_PREFIX}made@example.com`,
            phone: "+62 813 1111 2222",
            country: "Indonesia",
            preferredLocale: "id",
          },
        }),
      }),
    );

    expect(createRes.status).toBe(201);
    const createdBody = (await createRes.json()) as {
      data: {
        id: string;
        code: string;
        status: string;
        nights: number;
        totalIdr: number;
        version: number;
      };
    };
    expect(createdBody.data.status).toBe("PENDING");
    expect(createdBody.data.nights).toBe(3);
    // 3 * 2,000,000 + 250,000 - 150,000 = 6,100,000
    expect(createdBody.data.totalIdr).toBe(6_100_000);
    expect(createdBody.data.version).toBe(1);

    const reservationId = createdBody.data.id;

    // 2. List reservations with filters (status=PENDING, q=Made)
    const listRes = await getReservationsRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations?status=PENDING&q=Made&page=1&pageSize=10`),
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as {
      data: Array<{ id: string; code: string }>;
      meta: { total: number };
    };
    expect(listBody.meta.total).toBeGreaterThanOrEqual(1);
    expect(listBody.data.some((r) => r.id === reservationId)).toBe(true);

    // 3. PATCH without If-Match -> 400 VALIDATION_ERROR
    const patchNoIfMatch = await patchReservationRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations/${reservationId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
        },
        body: JSON.stringify({ adults: 3 }),
      }),
      { params: Promise.resolve({ id: reservationId }) },
    );
    expect(patchNoIfMatch.status).toBe(400);

    // 4. PATCH with matching If-Match: 1 -> 200 OK, increments version to 2
    const patchOk = await patchReservationRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations/${reservationId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
          "if-match": "1",
        },
        body: JSON.stringify({
          checkIn: "2027-06-10",
          checkOut: "2027-06-14", // 4 nights
          discountIdr: 250_000,
        }),
      }),
      { params: Promise.resolve({ id: reservationId }) },
    );
    expect(patchOk.status).toBe(200);
    const patchedBody = (await patchOk.json()) as {
      data: { nights: number; totalIdr: number; version: number };
    };
    expect(patchedBody.data.nights).toBe(4);
    // 4 * 2,000,000 + 250,000 - 250,000 = 8,000,000
    expect(patchedBody.data.totalIdr).toBe(8_000_000);
    expect(patchedBody.data.version).toBe(2);

    // 5. PATCH with stale If-Match: 1 -> 409 VERSION_CONFLICT (TC-C03, TC-U15)
    const patchStale = await patchReservationRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations/${reservationId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
          "if-match": "1",
        },
        body: JSON.stringify({ adults: 3 }),
      }),
      { params: Promise.resolve({ id: reservationId }) },
    );
    expect(patchStale.status).toBe(409);
    const staleErr = (await patchStale.json()) as { error: { code: string } };
    expect(staleErr.error.code).toBe("VERSION_CONFLICT");

    // 6. Disallowed status transition: PENDING -> CHECKED_OUT -> 409 INVALID_TRANSITION (TC-S02)
    const badTransition = await postCheckOutReservationRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations/${reservationId}/check-out`, {
        method: "POST",
        headers: { origin: SITE_ORIGIN },
      }),
      { params: Promise.resolve({ id: reservationId }) },
    );
    expect(badTransition.status).toBe(409);
    const badTransitionErr = (await badTransition.json()) as {
      error: { code: string };
    };
    expect(badTransitionErr.error.code).toBe("INVALID_TRANSITION");

    // 7. Confirm reservation: PENDING -> CONFIRMED
    const confirmRes = await postConfirmReservationRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations/${reservationId}/confirm`, {
        method: "POST",
        headers: { origin: SITE_ORIGIN },
      }),
      { params: Promise.resolve({ id: reservationId }) },
    );
    expect(confirmRes.status).toBe(200);

    // 8. Check-in with early override: CONFIRMED -> CHECKED_IN (TC-S04)
    const checkInRes = await postCheckInReservationRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations/${reservationId}/check-in`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
        },
        body: JSON.stringify({ overrideEarlyCheckIn: true }),
      }),
      { params: Promise.resolve({ id: reservationId }) },
    );
    expect(checkInRes.status).toBe(200);

    // 9. Check-out: CHECKED_IN -> CHECKED_OUT
    const checkOutRes = await postCheckOutReservationRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations/${reservationId}/check-out`, {
        method: "POST",
        headers: { origin: SITE_ORIGIN },
      }),
      { params: Promise.resolve({ id: reservationId }) },
    );
    expect(checkOutRes.status).toBe(200);
  });

  it("FR-16, FR-17, TC-Y01..TC-Y08, TC-G04: records partial/full/overpaid payments, voids payment with reason, cancels paid stay with refundPending, and anonymizes guest", async () => {
    setSession(staffUser);

    // 1. Create a CONFIRMED reservation (2 nights = 4,250,000 IDR)
    const createRes = await postReservationsRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
        },
        body: JSON.stringify({
          unitId: testUnit.id,
          checkIn: "2027-07-01",
          checkOut: "2027-07-03",
          adults: 2,
          children: 0,
          status: "CONFIRMED",
          source: "ADMIN",
          discountIdr: 0,
          locale: "en",
          guest: {
            fullName: "Kadek Surya",
            email: `${TEST_PREFIX}kadek@example.com`,
            phone: "+62 819 9999 0000",
          },
        }),
      }),
    );
    expect(createRes.status).toBe(201);
    const { id: reservationId } = (
      (await createRes.json()) as {
        data: { id: string };
      }
    ).data;

    // 2. Record partial payment (2,000,000) -> PARTIAL (TC-Y01)
    const pay1Res = await postRecordPaymentRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations/${reservationId}/payments`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
        },
        body: JSON.stringify({
          kind: "PAYMENT",
          amountIdr: 2_000_000,
          method: "BANK_TRANSFER",
          reference: "TRX-M5-01",
          note: "50% deposit",
        }),
      }),
      { params: Promise.resolve({ id: reservationId }) },
    );
    expect(pay1Res.status).toBe(201);
    const pay1Body = (await pay1Res.json()) as {
      data: {
        payment: { id: string };
        netPaidIdr: number;
        paymentStatus: string;
        overpaidIdr: number;
      };
    };
    expect(pay1Body.data.paymentStatus).toBe("PARTIAL");
    expect(pay1Body.data.netPaidIdr).toBe(2_000_000);
    expect(pay1Body.data.overpaidIdr).toBe(0);

    // 3. Record second payment (2,500,000) -> PAID with overpaidIdr = 250,000 (TC-Y05)
    const pay2Res = await postRecordPaymentRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations/${reservationId}/payments`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
        },
        body: JSON.stringify({
          kind: "PAYMENT",
          amountIdr: 2_500_000,
          method: "QRIS",
          reference: "TRX-M5-02",
        }),
      }),
      { params: Promise.resolve({ id: reservationId }) },
    );
    expect(pay2Res.status).toBe(201);
    const pay2Body = (await pay2Res.json()) as {
      data: {
        payment: { id: string };
        netPaidIdr: number;
        paymentStatus: string;
        overpaidIdr: number;
      };
    };
    expect(pay2Body.data.paymentStatus).toBe("PAID");
    expect(pay2Body.data.netPaidIdr).toBe(4_500_000);
    expect(pay2Body.data.overpaidIdr).toBe(250_000);

    // 4. Void the second payment -> back to PARTIAL (2,000,000) and voided row stays visible (TC-Y02)
    const voidRes = await postVoidPaymentRoute(
      new Request(`${SITE_ORIGIN}/api/admin/payments/${pay2Body.data.payment.id}/void`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
        },
        body: JSON.stringify({ reason: "Entered wrong QRIS amount" }),
      }),
      { params: Promise.resolve({ paymentId: pay2Body.data.payment.id }) },
    );
    expect(voidRes.status).toBe(200);
    const voidBody = (await voidRes.json()) as {
      data: { netPaidIdr: number; paymentStatus: string; overpaidIdr: number };
    };
    expect(voidBody.data.paymentStatus).toBe("PARTIAL");
    expect(voidBody.data.netPaidIdr).toBe(2_000_000);
    expect(voidBody.data.overpaidIdr).toBe(0);

    // 5. Cancel reservation with netPaid > 0 -> requires reason and flags refundPending = true (TC-S03, TC-Y06)
    const cancelNoReason = await postCancelReservationRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations/${reservationId}/cancel`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
        },
        body: JSON.stringify({ reason: "   " }),
      }),
      { params: Promise.resolve({ id: reservationId }) },
    );
    expect(cancelNoReason.status).toBe(400);

    const cancelOk = await postCancelReservationRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations/${reservationId}/cancel`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
        },
        body: JSON.stringify({ reason: "Guest flight cancelled" }),
      }),
      { params: Promise.resolve({ id: reservationId }) },
    );
    expect(cancelOk.status).toBe(200);
    const cancelBody = (await cancelOk.json()) as {
      data: { status: string; refundPending: boolean };
    };
    expect(cancelBody.data.status).toBe("CANCELLED");
    expect(cancelBody.data.refundPending).toBe(true);

    // 6. Verify GET /api/admin/reservations/[id] returns both payments (including voided) and audit logs
    const detailRes = await getReservationDetailRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reservations/${reservationId}`),
      { params: Promise.resolve({ id: reservationId }) },
    );
    expect(detailRes.status).toBe(200);
    const detailBody = (await detailRes.json()) as {
      data: {
        guest: { id: string; fullName: string };
        payments: Array<{ id: string; voidedAt: string | null; voidReason: string | null }>;
        auditLogs: Array<{ action: string }>;
        refundPending: boolean;
      };
    };
    expect(detailBody.data.payments).toHaveLength(2);
    expect(
      detailBody.data.payments.some(
        (p) => p.voidedAt !== null && p.voidReason === "Entered wrong QRIS amount",
      ),
    ).toBe(true);
    expect(detailBody.data.auditLogs.length).toBeGreaterThanOrEqual(4);
    expect(detailBody.data.refundPending).toBe(true);

    const guestId = detailBody.data.guest.id;

    // 7. Guest list, update, and ADMIN-only anonymize (FR-16, TC-G04)
    const guestsListRes = await getGuestsRoute(
      new Request(`${SITE_ORIGIN}/api/admin/guests?q=Kadek`),
    );
    expect(guestsListRes.status).toBe(200);

    const patchGuestRes = await patchGuestRoute(
      new Request(`${SITE_ORIGIN}/api/admin/guests/${guestId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
        },
        body: JSON.stringify({
          country: "Singapore",
          notes: `${TEST_PREFIX}updated-guest-note`,
        }),
      }),
      { params: Promise.resolve({ id: guestId }) },
    );
    expect(patchGuestRes.status).toBe(200);

    // STAFF cannot anonymize guest -> 403 FORBIDDEN
    const staffAnonRes = await postAnonymizeGuest(
      new Request(`${SITE_ORIGIN}/api/admin/guests/${guestId}/anonymize`, {
        method: "POST",
        headers: { origin: SITE_ORIGIN },
      }),
      { params: Promise.resolve({ id: guestId }) },
    );
    expect(staffAnonRes.status).toBe(403);

    // ADMIN can anonymize guest -> 200 OK, reservations & payments remain intact (TC-G04)
    setSession(adminUser);
    const adminAnonRes = await postAnonymizeGuest(
      new Request(`${SITE_ORIGIN}/api/admin/guests/${guestId}/anonymize`, {
        method: "POST",
        headers: { origin: SITE_ORIGIN },
      }),
      { params: Promise.resolve({ id: guestId }) },
    );
    expect(adminAnonRes.status).toBe(200);

    const guestDetailRes = await getGuestDetailRoute(
      new Request(`${SITE_ORIGIN}/api/admin/guests/${guestId}`),
      { params: Promise.resolve({ id: guestId }) },
    );
    expect(guestDetailRes.status).toBe(200);
    const guestDetailBody = (await guestDetailRes.json()) as {
      data: {
        fullName: string;
        email: string | null;
        phone: string | null;
        reservations: Array<{ id: string }>;
      };
    };
    expect(guestDetailBody.data.fullName).toBe("Anonymized Guest");
    expect(guestDetailBody.data.email).toBeNull();
    expect(guestDetailBody.data.phone).toBeNull();
    expect(guestDetailBody.data.reservations).toHaveLength(1);

    // Also test POST /api/admin/guests directly
    const createGuestRes = await postGuestsRoute(
      new Request(`${SITE_ORIGIN}/api/admin/guests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
        },
        body: JSON.stringify({
          fullName: "Direct Created Guest",
          email: `${TEST_PREFIX}direct@example.com`,
          preferredLocale: "en",
        }),
      }),
    );
    expect(createGuestRes.status).toBe(201);
  });
});
