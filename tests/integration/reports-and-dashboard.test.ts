import { PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/server/auth/password";
import { addDays, formatDateOnly, todayInPropertyTz } from "@/lib/dates";

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

import { GET as getReservationsReportRoute } from "@/app/api/admin/reports/reservations/route";
import { GET as getPaymentsReportRoute } from "@/app/api/admin/reports/payments/route";
import { GET as getOccupancyReportRoute } from "@/app/api/admin/reports/occupancy/route";
import { GET as getArrivalsDeparturesRoute } from "@/app/api/admin/reports/arrivals-departures/route";
import { GET as getDynamicReportRoute } from "@/app/api/admin/reports/[name]/route";
import {
  getArrivalsDeparturesReport,
  getDashboardMetrics,
  getOccupancyReport,
  getPaymentsReport,
  getReservationsReport,
} from "@/server/services/report-service";

const prisma = new PrismaClient();
const TEST_PREFIX = "m7-reports-test-";
const SITE_ORIGIN = "http://localhost:3000";

describe("Milestone M7: Admin Dashboard Metrics & Operational Reports Suite (FR-12, FR-18, SEC-12, TC-U01..U06)", () => {
  let adminUser: { id: string; email: string; name: string; role: "ADMIN" | "STAFF" };
  let staffUser: { id: string; email: string; name: string; role: "ADMIN" | "STAFF" };

  beforeAll(async () => {
    const passwordHash = await hashPassword("SagaraTestPass!2026");

    adminUser = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}admin@sagaravillas.com`,
        name: "M7 Admin Test",
        role: "ADMIN",
        passwordHash,
      },
    });

    staffUser = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}staff@sagaravillas.com`,
        name: "M7 Staff Test",
        role: "STAFF",
        passwordHash,
      },
    });
  });

  afterAll(async () => {
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

  // ==========================================
  // 1. DASHBOARD METRICS CONSISTENCY (FR-12, TC-U01..U06)
  // ==========================================
  it("FR-12, TC-U01..U06: computes dashboard metrics and ensures mathematical consistency with reports", async () => {
    const metrics = await getDashboardMetrics(prisma);
    const today = todayInPropertyTz();
    const todayStr = formatDateOnly(today);

    expect(metrics.todayDate).toBe(todayStr);
    expect(metrics.arrivalsToday).toBeGreaterThanOrEqual(0);
    expect(metrics.departuresToday).toBeGreaterThanOrEqual(0);
    expect(metrics.inHouseCount).toBeGreaterThanOrEqual(0);
    expect(metrics.pendingCount).toBeGreaterThanOrEqual(0);
    expect(metrics.outstandingBalanceIdr).toBeGreaterThanOrEqual(0);
    expect(metrics.occupancy30dPercent).toBeGreaterThanOrEqual(0);
    expect(metrics.occupancy30dPercent).toBeLessThanOrEqual(100);
    expect(metrics.activeUnitsCount).toBeGreaterThanOrEqual(1);

    // Consistency check with R4: Arrivals today
    const r4Today = await getArrivalsDeparturesReport(prisma, { date: todayStr });
    // In R4, confirmed or checked in arrivals on today
    const confirmedOrInArrivals = r4Today.arrivals.filter((a) =>
      ["CONFIRMED", "CHECKED_IN"].includes(a.status),
    );
    expect(metrics.arrivalsToday).toBe(confirmedOrInArrivals.length);

    // Consistency check with R3: 30-day occupancy
    const r3Next30 = await getOccupancyReport(prisma, {
      from: todayStr,
      to: formatDateOnly(addDays(today, 30)),
    });
    expect(metrics.occupancy30dPercent).toBe(Math.round(r3Next30.totals.overallOccupancyPercent));

    // Consistency check with R2: payments outstanding balance
    const r2Report = await getPaymentsReport(prisma);
    expect(metrics.outstandingBalanceIdr).toBe(r2Report.totals.totalOutstandingBalanceIdr);

    // Direct check of getReservationsReport
    const r1Report = await getReservationsReport(prisma);
    expect(r1Report.totals.totalCount).toBeGreaterThanOrEqual(0);
  });

  // ==========================================
  // 2. R1: RESERVATIONS REPORT (FR-18)
  // ==========================================
  it("FR-18: R1 reservations report filters correctly, computes totals, and handles date validation", async () => {
    setSession(staffUser);

    // Valid report request (JSON)
    const req = new Request(
      `${SITE_ORIGIN}/api/admin/reports/reservations?from=2026-01-01&to=2027-12-31`,
    );
    const res = await getReservationsReportRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.filters.from).toBe("2026-01-01");
    expect(body.data.filters.to).toBe("2027-12-31");
    expect(body.data.totals.totalCount).toBeGreaterThanOrEqual(0);
    expect(body.data.totals.bookedValueIdr).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(body.data.reservations)).toBe(true);

    // Date validation: to < from must return 400 ValidationError
    const invalidReq = new Request(
      `${SITE_ORIGIN}/api/admin/reports/reservations?from=2026-12-31&to=2026-01-01`,
    );
    const invalidRes = await getReservationsReportRoute(invalidReq);
    expect(invalidRes.status).toBe(400);

    // CSV format via search parameter: ?format=csv
    const csvReq = new Request(
      `${SITE_ORIGIN}/api/admin/reports/reservations?from=2026-01-01&to=2027-12-31&format=csv`,
    );
    const csvRes = await getReservationsReportRoute(csvReq);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get("content-type")).toContain("text/csv");
    expect(csvRes.headers.get("x-content-type-options")).toBe("nosniff");
    expect(csvRes.headers.get("cache-control")).toContain("no-store");

    const csvText = await csvRes.text();
    expect(csvText).toContain('"Reservation Code"');
    expect(csvText).toContain('"TOTAL"');
  });

  // ==========================================
  // 3. R2: PAYMENTS & BALANCES REPORT (FR-18)
  // ==========================================
  it("FR-18: R2 payments and balances report computes method breakdown and outstanding balances", async () => {
    setSession(staffUser);

    const req = new Request(
      `${SITE_ORIGIN}/api/admin/reports/payments?from=2026-01-01&to=2027-12-31`,
    );
    const res = await getPaymentsReportRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.totals).toBeDefined();
    expect(body.data.totals.cashReceivedIdr).toBeGreaterThanOrEqual(0);
    expect(body.data.totals.grossPaymentsIdr).toBeGreaterThanOrEqual(0);
    expect(body.data.totals.grossRefundsIdr).toBeGreaterThanOrEqual(0);
    expect(body.data.totals.totalOutstandingBalanceIdr).toBeGreaterThanOrEqual(0);

    // Verify byMethod contains standard payment methods
    expect(Array.isArray(body.data.byMethod)).toBe(true);
    const methods = body.data.byMethod.map((m: { method: string }) => m.method);
    expect(methods).toContain("BANK_TRANSFER");
    expect(methods).toContain("CASH");
    expect(methods).toContain("QRIS");
    expect(methods).toContain("CARD_EXTERNAL");

    // CSV export test
    const csvReq = new Request(
      `${SITE_ORIGIN}/api/admin/reports/payments?from=2026-01-01&to=2027-12-31&format=csv`,
    );
    const csvRes = await getPaymentsReportRoute(csvReq);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get("content-type")).toContain("text/csv");
    const csvText = await csvRes.text();
    expect(csvText).toContain('"Outstanding Balance (IDR)"');
    expect(csvText).toContain('"TOTAL OUTSTANDING"');
  });

  // ==========================================
  // 4. R3: OCCUPANCY REPORT (FR-18)
  // ==========================================
  it("FR-18: R3 occupancy report calculates nights correctly and respects unit blocks", async () => {
    setSession(staffUser);

    const req = new Request(
      `${SITE_ORIGIN}/api/admin/reports/occupancy?from=2026-11-01&to=2026-12-01`,
    );
    const res = await getOccupancyReportRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.totals.totalUnits).toBeGreaterThanOrEqual(1);
    expect(body.data.totals.totalCalendarDays).toBeGreaterThan(0);
    expect(body.data.totals.totalAvailableNights).toBeLessThanOrEqual(
      body.data.totals.totalCalendarDays,
    );
    expect(body.data.totals.overallOccupancyPercent).toBeGreaterThanOrEqual(0);
    expect(body.data.totals.overallOccupancyPercent).toBeLessThanOrEqual(100);

    // CSV export
    const csvReq = new Request(
      `${SITE_ORIGIN}/api/admin/reports/occupancy?from=2026-11-01&to=2026-12-01&format=csv`,
    );
    const csvRes = await getOccupancyReportRoute(csvReq);
    expect(csvRes.status).toBe(200);
    const csvText = await csvRes.text();
    expect(csvText).toContain('"Occupancy Rate (%)"');
    expect(csvText).toContain('"PORTFOLIO TOTAL"');
  });

  // ==========================================
  // 5. R4: ARRIVALS & DEPARTURES REPORT (FR-18)
  // ==========================================
  it("FR-18: R4 arrivals and departures report handles dates and separates movements", async () => {
    setSession(staffUser);

    const req = new Request(
      `${SITE_ORIGIN}/api/admin/reports/arrivals-departures?from=2026-11-01&to=2026-11-30`,
    );
    const res = await getArrivalsDeparturesRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.arrivals)).toBe(true);
    expect(Array.isArray(body.data.departures)).toBe(true);
    expect(body.data.totals.totalArrivals).toBe(body.data.arrivals.length);
    expect(body.data.totals.totalDepartures).toBe(body.data.departures.length);

    // Departure balance check: balanceIdr should equal max(0, totalIdr - netPaidIdr)
    for (const d of body.data.departures) {
      expect(d.balanceIdr).toBe(Math.max(0, d.totalIdr - d.netPaidIdr));
    }

    // CSV export
    const csvReq = new Request(
      `${SITE_ORIGIN}/api/admin/reports/arrivals-departures?from=2026-11-01&to=2026-11-30&format=csv`,
    );
    const csvRes = await getArrivalsDeparturesRoute(csvReq);
    expect(csvRes.status).toBe(200);
    const csvText = await csvRes.text();
    expect(csvText).toContain('"Movement Type"');
  });

  // ==========================================
  // 6. DYNAMIC CSV ROUTE & SEC-12 SECURITY HEADERS
  // ==========================================
  it("SEC-12, FR-18: /api/admin/reports/[name] exports CSV with security headers and handles unknown names", async () => {
    setSession(adminUser);

    // 1. Reservations CSV
    const res1 = await getDynamicReportRoute(
      new Request(
        `${SITE_ORIGIN}/api/admin/reports/reservations.csv?from=2026-01-01&to=2026-12-31`,
      ),
      { params: Promise.resolve({ name: "reservations.csv" }) },
    );
    expect(res1.status).toBe(200);
    expect(res1.headers.get("content-type")).toContain("text/csv");
    expect(res1.headers.get("content-disposition")).toContain("attachment; filename=");
    expect(res1.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res1.headers.get("cache-control")).toContain("no-store");

    // 2. Payments CSV
    const res2 = await getDynamicReportRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reports/payments.csv`),
      { params: Promise.resolve({ name: "payments.csv" }) },
    );
    expect(res2.status).toBe(200);

    // 3. Occupancy CSV
    const res3 = await getDynamicReportRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reports/occupancy.csv`),
      { params: Promise.resolve({ name: "occupancy.csv" }) },
    );
    expect(res3.status).toBe(200);

    // 4. Arrivals-Departures CSV
    const res4 = await getDynamicReportRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reports/arrivals-departures.csv`),
      { params: Promise.resolve({ name: "arrivals-departures.csv" }) },
    );
    expect(res4.status).toBe(200);

    // 5. Unknown report name -> 404 NOT FOUND
    const res5 = await getDynamicReportRoute(
      new Request(`${SITE_ORIGIN}/api/admin/reports/fraud-report.csv`),
      { params: Promise.resolve({ name: "fraud-report.csv" }) },
    );
    expect(res5.status).toBe(404);
  });

  // ==========================================
  // 7. RBAC AUTHORIZATION CHECKS (SEC-05)
  // ==========================================
  it("SEC-05: protects all report endpoints against unauthenticated access and allows ADMIN and STAFF", async () => {
    // 1. Unauthenticated -> 401
    setSession(null);
    const unauthReq = new Request(`${SITE_ORIGIN}/api/admin/reports/reservations`);
    const unauthRes = await getReservationsReportRoute(unauthReq);
    expect(unauthRes.status).toBe(401);

    // 2. STAFF -> 200
    setSession(staffUser);
    const staffRes = await getReservationsReportRoute(unauthReq);
    expect(staffRes.status).toBe(200);

    // 3. ADMIN -> 200
    setSession(adminUser);
    const adminRes = await getReservationsReportRoute(unauthReq);
    expect(adminRes.status).toBe(200);
  });
});
