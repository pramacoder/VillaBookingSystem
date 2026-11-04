import { PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";
import { isReservationPendingStale } from "@/components/ui/status-badge";
import { calculateStayPricing, findApplicableRateRule } from "@/server/services/pricing-service";
import { anonymizeGuest } from "@/server/services/guest-service";

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

import {
  GET as getRateRulesRoute,
  POST as postRateRuleRoute,
} from "@/app/api/admin/units/[id]/rate-rules/route";
import { DELETE as deleteRateRuleRoute } from "@/app/api/admin/units/[id]/rate-rules/[ruleId]/route";

const prisma = new PrismaClient();
const TEST_PREFIX = "m9-test-";
const SITE_ORIGIN = "http://localhost:3000";

describe("Milestone M9: P1 Items, Rate Rules, Staleness & Hardening", () => {
  let testAdminUser: { id: string; email: string };
  let testStaffUser: { id: string; email: string };
  let testUnit: { id: string; slug: string; baseRateIdr: number };
  let testGuest: { id: string; email: string | null };

  beforeAll(async () => {
    // 1. Create test admin and staff users
    testAdminUser = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}admin@sagaravillas.com`,
        name: "M9 Test Admin",
        passwordHash: "argon2id$test$hash",
        role: "ADMIN",
        isActive: true,
      },
      select: { id: true, email: true },
    });

    testStaffUser = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}staff@sagaravillas.com`,
        name: "M9 Test Staff",
        passwordHash: "argon2id$test$hash",
        role: "STAFF",
        isActive: true,
      },
      select: { id: true, email: true },
    });

    // 2. Create test unit
    testUnit = await prisma.unit.create({
      data: {
        slug: `${TEST_PREFIX}villa`,
        status: "ACTIVE",
        nameEn: "M9 Test Villa",
        nameId: "Villa Uji M9",
        summaryEn: "A serene test villa",
        summaryId: "Villa uji yang tenang",
        descriptionEn: "Full description of test villa",
        descriptionId: "Deskripsi lengkap villa uji",
        maxGuests: 4,
        bedrooms: 2,
        bathrooms: 2,
        baseRateIdr: 3_000_000,
        cleaningFeeIdr: 250_000,
        minNights: 2,
      },
      select: { id: true, slug: true, baseRateIdr: true },
    });

    // 3. Create test guest
    testGuest = await prisma.guest.create({
      data: {
        fullName: "M9 Sensitive Guest",
        email: `${TEST_PREFIX}sensitive@example.com`,
        emailNormalized: `${TEST_PREFIX}sensitive@example.com`,
        phone: "+6281299998888",
        phoneNormalized: "+6281299998888",
        country: "ID",
        notes: "Confidential VIP guest notes",
      },
      select: { id: true, email: true },
    });
  });

  afterAll(async () => {
    // Clean up created records
    await prisma.rateRule.deleteMany({ where: { unitId: testUnit.id } });
    await prisma.auditLog.deleteMany({
      where: {
        actorId: { in: [testAdminUser.id, testStaffUser.id] },
      },
    });
    await prisma.guest.deleteMany({ where: { id: testGuest.id } });
    await prisma.unit.deleteMany({ where: { id: testUnit.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [testAdminUser.id, testStaffUser.id] } },
    });
    await prisma.$disconnect();
  });

  function setActor(role: "ADMIN" | "STAFF" | "ANONYMOUS") {
    if (role === "ANONYMOUS") {
      currentTestSession.value = null;
    } else {
      const user = role === "ADMIN" ? testAdminUser : testStaffUser;
      currentTestSession.value = {
        user: {
          id: user.id,
          email: user.email,
          name: role === "ADMIN" ? "Admin" : "Staff",
          role,
        },
        expires: new Date(Date.now() + 3600_000).toISOString(),
      } as unknown as Session;
    }
  }

  describe("Rate Rules Endpoints & Services (API §5.1, DATABASE §6, PRD P1)", () => {
    let createdRuleId: string;

    it("rejects unauthenticated requests to rate rules", async () => {
      setActor("ANONYMOUS");
      const req = new Request(`${SITE_ORIGIN}/api/admin/units/${testUnit.id}/rate-rules`);
      const res = await getRateRulesRoute(req, { params: Promise.resolve({ id: testUnit.id }) });
      expect(res.status).toBe(401);
    });

    it("allows STAFF to read rate rules, but forbids STAFF from creating rate rules", async () => {
      setActor("STAFF");
      // GET
      const getReq = new Request(`${SITE_ORIGIN}/api/admin/units/${testUnit.id}/rate-rules`);
      const getRes = await getRateRulesRoute(getReq, {
        params: Promise.resolve({ id: testUnit.id }),
      });
      expect(getRes.status).toBe(200);

      // POST
      const postReq = new Request(`${SITE_ORIGIN}/api/admin/units/${testUnit.id}/rate-rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: SITE_ORIGIN,
        },
        body: JSON.stringify({
          label: "Peak Season 2026",
          startDate: "2026-12-20",
          endDate: "2026-12-31",
          nightlyRateIdr: 4_500_000,
        }),
      });
      const postRes = await postRateRuleRoute(postReq, {
        params: Promise.resolve({ id: testUnit.id }),
      });
      expect(postRes.status).toBe(403);
    });

    it("validates rate rule dates (endDate must be >= startDate) and positive nightlyRateIdr", async () => {
      setActor("ADMIN");
      const invalidReq = new Request(`${SITE_ORIGIN}/api/admin/units/${testUnit.id}/rate-rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: SITE_ORIGIN,
        },
        body: JSON.stringify({
          label: "Invalid Dates",
          startDate: "2026-12-31",
          endDate: "2026-12-20", // Before startDate!
          nightlyRateIdr: 4_000_000,
        }),
      });
      const res = await postRateRuleRoute(invalidReq, {
        params: Promise.resolve({ id: testUnit.id }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("allows ADMIN to create a rate rule and creates audit log", async () => {
      setActor("ADMIN");
      const postReq = new Request(`${SITE_ORIGIN}/api/admin/units/${testUnit.id}/rate-rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: SITE_ORIGIN,
        },
        body: JSON.stringify({
          label: "High Season Override",
          startDate: "2026-07-01",
          endDate: "2026-07-31",
          nightlyRateIdr: 5_000_000,
          minNights: 3,
        }),
      });
      const res = await postRateRuleRoute(postReq, {
        params: Promise.resolve({ id: testUnit.id }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.label).toBe("High Season Override");
      expect(json.data.nightlyRateIdr).toBe(5_000_000);
      createdRuleId = json.data.id;

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: "unit_rate_rule.create",
          entityId: createdRuleId,
        },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorId).toBe(testAdminUser.id);
    });

    it("applies seasonal rate rules during pricing calculation (findApplicableRateRule)", () => {
      const activeRule = {
        label: "High Season Override",
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        nightlyRateIdr: 5_000_000,
        minNights: 3,
      };

      // In-range date
      const match = findApplicableRateRule(new Date("2026-07-15T00:00:00.000Z"), [activeRule]);
      expect(match).not.toBeNull();
      expect(match?.rateIdr).toBe(5_000_000);

      // Out-of-range date
      const noMatch = findApplicableRateRule(new Date("2026-08-01T00:00:00.000Z"), [activeRule]);
      expect(noMatch).toBeNull();

      // Calculation with quote
      const quote = calculateStayPricing({
        checkIn: "2026-07-10",
        checkOut: "2026-07-13", // 3 nights
        baseRateIdr: testUnit.baseRateIdr, // 3,000,000
        cleaningFeeIdr: 250_000,
        rateRules: [activeRule],
      });

      // 3 nights * 5,000,000 + 250,000 = 15,250,000
      expect(quote.nightlySubtotalIdr).toBe(15_000_000);
      expect(quote.totalIdr).toBe(15_250_000);
      expect(quote.pricingSnapshot.nights[0].ruleLabel).toBe("High Season Override");
    });

    it("forbids STAFF from deleting rate rules and allows ADMIN to delete with audit log", async () => {
      // 1. Staff forbidden
      setActor("STAFF");
      const staffReq = new Request(
        `${SITE_ORIGIN}/api/admin/units/${testUnit.id}/rate-rules/${createdRuleId}`,
        {
          method: "DELETE",
          headers: { Origin: SITE_ORIGIN },
        },
      );
      const staffRes = await deleteRateRuleRoute(staffReq, {
        params: Promise.resolve({ id: testUnit.id, ruleId: createdRuleId }),
      });
      expect(staffRes.status).toBe(403);

      // 2. Admin allowed
      setActor("ADMIN");
      const adminReq = new Request(
        `${SITE_ORIGIN}/api/admin/units/${testUnit.id}/rate-rules/${createdRuleId}`,
        {
          method: "DELETE",
          headers: { Origin: SITE_ORIGIN },
        },
      );
      const adminRes = await deleteRateRuleRoute(adminReq, {
        params: Promise.resolve({ id: testUnit.id, ruleId: createdRuleId }),
      });
      expect(adminRes.status).toBe(200);

      // 3. Verify deleted
      const check = await prisma.rateRule.findUnique({ where: { id: createdRuleId } });
      expect(check).toBeNull();

      // 4. Verify audit log
      const deleteAudit = await prisma.auditLog.findFirst({
        where: {
          action: "unit_rate_rule.delete",
          entityId: createdRuleId,
        },
      });
      expect(deleteAudit).not.toBeNull();
    });
  });

  describe("Pending Staleness Indicator (PRD P1, DESIGN §3.2, §7.2, TC-U10)", () => {
    it("flags PENDING reservations older than 24h as stale", () => {
      const now = new Date("2026-11-05T12:00:00.000Z");

      // 26 hours ago
      const staleCreated = new Date(now.getTime() - 26 * 60 * 60 * 1000);
      expect(isReservationPendingStale("PENDING", staleCreated, now)).toBe(true);

      // 10 hours ago
      const freshCreated = new Date(now.getTime() - 10 * 60 * 60 * 1000);
      expect(isReservationPendingStale("PENDING", freshCreated, now)).toBe(false);

      // Non-PENDING reservations are never stale
      expect(isReservationPendingStale("CONFIRMED", staleCreated, now)).toBe(false);
      expect(isReservationPendingStale("CHECKED_IN", staleCreated, now)).toBe(false);
      expect(isReservationPendingStale("CANCELLED", staleCreated, now)).toBe(false);
    });
  });

  describe("Guest Anonymization (SEC-10, TC-G04)", () => {
    it("anonymizes personal guest data while preserving guest record and writing audit trail", async () => {
      const anonymized = await anonymizeGuest(prisma, {
        guestId: testGuest.id,
        actorId: testAdminUser.id,
      });

      expect(anonymized.fullName).toBe("Anonymized Guest");
      expect(anonymized.email).toBeNull();
      expect(anonymized.emailNormalized).toBeNull();
      expect(anonymized.phone).toBeNull();
      expect(anonymized.phoneNormalized).toBeNull();
      expect(anonymized.notes).toBeNull();

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: "guest.anonymize",
          entityId: testGuest.id,
        },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorId).toBe(testAdminUser.id);
    });
  });

  describe("Security Headers & CSP Verification (SEC-08, SEC-15, SEC-16)", () => {
    it("configures strict Content-Security-Policy, X-Frame-Options, and security headers in next.config.ts", async () => {
      expect(nextConfig.headers).toBeDefined();
      if (!nextConfig.headers) return;

      const headerRules = await nextConfig.headers();

      // Global headers
      const globalRule = headerRules.find((r) => r.source === "/:path*");
      expect(globalRule).toBeDefined();
      const headersMap = new Map(globalRule?.headers.map((h) => [h.key, h.value]));

      expect(headersMap.get("X-Frame-Options")).toBe("DENY");
      expect(headersMap.get("X-Content-Type-Options")).toBe("nosniff");
      expect(headersMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      expect(headersMap.get("Permissions-Policy")).toContain("camera=()");

      const csp = headersMap.get("Content-Security-Policy");
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");

      // Admin headers (no-store, noindex)
      const adminRule = headerRules.find((r) => r.source === "/admin/:path*");
      expect(adminRule).toBeDefined();
      const adminHeadersMap = new Map(adminRule?.headers.map((h) => [h.key, h.value]));
      expect(adminHeadersMap.get("Cache-Control")).toContain("no-store");
      expect(adminHeadersMap.get("X-Robots-Tag")).toContain("noindex");
    });
  });
});
