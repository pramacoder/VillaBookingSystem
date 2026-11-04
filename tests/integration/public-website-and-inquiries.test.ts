import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const defaultLocalDbUrl =
    "postgresql://sagara:sagara_local_dev@localhost:5433/sagara_villas?schema=public";
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = defaultLocalDbUrl;
  }
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
});

import { GET as getPublicUnitsRoute } from "@/app/api/public/units/route";
import { GET as getPublicUnitBySlugRoute } from "@/app/api/public/units/[slug]/route";
import { GET as getPublicUnitAvailabilityRoute } from "@/app/api/public/units/[slug]/availability/route";
import { POST as postPublicQuoteRoute } from "@/app/api/public/quote/route";
import { POST as postPublicInquiryRoute } from "@/app/api/public/inquiries/route";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { addDays, formatDateOnly, todayInPropertyTz } from "@/lib/dates";

const prisma = new PrismaClient();
const TEST_PREFIX = "m8-public-test-";
const SITE_ORIGIN = "http://localhost:3000";

describe("Milestone M8: Public Website API, Availability, Quotes, and Inquiries Suite (FR-01..FR-07)", () => {
  const today = todayInPropertyTz();
  const futureCheckIn = formatDateOnly(addDays(today, 60));
  const futureCheckOut = formatDateOnly(addDays(today, 63));

  async function cleanupTestData() {
    const reservations = await prisma.reservation.findMany({
      where: { guest: { email: { startsWith: TEST_PREFIX } } },
      select: { id: true },
    });
    const resIds = reservations.map((r) => r.id);

    if (resIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { entityType: "Reservation", entityId: { in: resIds } },
      });
      await prisma.reservation.deleteMany({
        where: { id: { in: resIds } },
      });
    }

    await prisma.guest.deleteMany({
      where: { email: { startsWith: TEST_PREFIX } },
    });
  }

  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  // ==========================================
  // 1. GET /api/public/units (FR-02)
  // ==========================================
  it("FR-02: lists active units only, excludes draft/archived units, and supports localization", async () => {
    // English request
    const reqEn = new Request(`${SITE_ORIGIN}/api/public/units?locale=en`);
    const resEn = await getPublicUnitsRoute(reqEn);
    expect(resEn.status).toBe(200);

    const bodyEn = await resEn.json();
    expect(Array.isArray(bodyEn.data)).toBe(true);
    expect(bodyEn.data.length).toBeGreaterThanOrEqual(4);

    const slugs = bodyEn.data.map((u: { slug: string }) => u.slug);
    expect(slugs).toContain("garden-villa");
    expect(slugs).toContain("pool-villa");
    expect(slugs).toContain("family-residence");
    expect(slugs).toContain("loft-suite");

    // DRAFT unit must NOT appear in public catalog
    expect(slugs).not.toContain("cliff-pavilion");

    const gardenUnitEn = bodyEn.data.find((u: { slug: string }) => u.slug === "garden-villa");
    expect(gardenUnitEn.name).toBe("Sagara Garden Villa");
    expect(gardenUnitEn.isDemo).toBe(true);
    expect(gardenUnitEn.bedrooms).toBe(1);
    expect(gardenUnitEn.maxGuests).toBe(2);

    // Indonesian request
    const reqId = new Request(`${SITE_ORIGIN}/api/public/units?locale=id`);
    const resId = await getPublicUnitsRoute(reqId);
    expect(resId.status).toBe(200);

    const bodyId = await resId.json();
    const gardenUnitId = bodyId.data.find((u: { slug: string }) => u.slug === "garden-villa");
    expect(gardenUnitId.name).toBe("Villa Taman Sagara");
  });

  // ==========================================
  // 2. GET /api/public/units/[slug] (FR-03)
  // ==========================================
  it("FR-03: returns detailed unit information for active units and 404 for draft/unknown units", async () => {
    // 1. Active unit -> 200
    const reqActive = new Request(`${SITE_ORIGIN}/api/public/units/garden-villa`);
    const resActive = await getPublicUnitBySlugRoute(reqActive, {
      params: Promise.resolve({ slug: "garden-villa" }),
    });
    expect(resActive.status).toBe(200);

    const body = await resActive.json();
    expect(body.data.slug).toBe("garden-villa");
    expect(body.data.name).toBe("Sagara Garden Villa");
    expect(body.data.description).toBeDefined();
    expect(Array.isArray(body.data.amenities)).toBe(true);
    expect(body.data.amenities.length).toBeGreaterThan(0);
    expect(body.data.houseRules).toBeDefined();
    expect(body.data.isDemo).toBe(true);

    // 2. Draft unit -> 404 NOT FOUND
    const reqDraft = new Request(`${SITE_ORIGIN}/api/public/units/cliff-pavilion`);
    const resDraft = await getPublicUnitBySlugRoute(reqDraft, {
      params: Promise.resolve({ slug: "cliff-pavilion" }),
    });
    expect(resDraft.status).toBe(404);

    // 3. Non-existent slug -> 404 NOT FOUND
    const reqUnknown = new Request(`${SITE_ORIGIN}/api/public/units/phantom-villa`);
    const resUnknown = await getPublicUnitBySlugRoute(reqUnknown, {
      params: Promise.resolve({ slug: "phantom-villa" }),
    });
    expect(resUnknown.status).toBe(404);
  });

  // ==========================================
  // 3. GET /api/public/units/[slug]/availability (FR-04)
  // ==========================================
  it("FR-04: returns blocked ranges without exposing guest personal data", async () => {
    const req = new Request(`${SITE_ORIGIN}/api/public/units/garden-villa/availability`);
    const res = await getPublicUnitAvailabilityRoute(req, {
      params: Promise.resolve({ slug: "garden-villa" }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.unit).toBe("garden-villa");
    expect(Array.isArray(body.data.blockedRanges)).toBe(true);
    expect(body.data.minNights).toBeGreaterThanOrEqual(1);

    // Zero guest personal information in the payload
    const rawJson = JSON.stringify(body);
    expect(rawJson).not.toContain("fullName");
    expect(rawJson).not.toContain("email");
    expect(rawJson).not.toContain("phone");
    expect(rawJson).not.toContain("notes");
  });

  // ==========================================
  // 4. POST /api/public/quote (FR-04, TC-P05)
  // ==========================================
  it("FR-04, TC-P05: calculates informational quotes and validates stay rules", async () => {
    // 1. Valid quote
    const req = new Request(`${SITE_ORIGIN}/api/public/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitSlug: "garden-villa",
        checkIn: futureCheckIn,
        checkOut: futureCheckOut,
        adults: 2,
        children: 0,
      }),
    });

    const res = await postPublicQuoteRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.unitSlug).toBe("garden-villa");
    expect(body.data.nights).toBe(3);
    expect(body.data.nightlySubtotalIdr).toBe(1_500_000 * 3);
    expect(body.data.cleaningFeeIdr).toBe(250_000);
    expect(body.data.totalIdr).toBe(1_500_000 * 3 + 250_000);
    expect(body.data.isDemo).toBe(true);
    expect(body.data.available).toBe(true);

    // 2. Check-out before check-in -> 400 VALIDATION_ERROR
    const invalidDateReq = new Request(`${SITE_ORIGIN}/api/public/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitSlug: "garden-villa",
        checkIn: futureCheckOut,
        checkOut: futureCheckIn,
        adults: 2,
      }),
    });
    const invalidDateRes = await postPublicQuoteRoute(invalidDateReq);
    expect(invalidDateRes.status).toBe(400);

    // 3. Exceeds max guests -> 422 BUSINESS_RULE
    const exceedGuestsReq = new Request(`${SITE_ORIGIN}/api/public/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitSlug: "garden-villa",
        checkIn: futureCheckIn,
        checkOut: futureCheckOut,
        adults: 5, // maxGuests for garden-villa is 2
      }),
    });
    const exceedGuestsRes = await postPublicQuoteRoute(exceedGuestsReq);
    expect(exceedGuestsRes.status).toBe(422);
  });

  // ==========================================
  // 5. POST /api/public/inquiries (FR-05, TC-R01..R07)
  // ==========================================
  it("FR-05: creates PENDING reservation with guest, supports idempotency, honeypot, and rate limits", async () => {
    const testEmail = `${TEST_PREFIX}guest1@example.com`;

    // 1. Valid booking inquiry creation
    const req = new Request(`${SITE_ORIGIN}/api/public/inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitSlug: "garden-villa",
        checkIn: futureCheckIn,
        checkOut: futureCheckOut,
        adults: 2,
        children: 0,
        name: "M8 Public Guest",
        email: testEmail,
        phone: "+62 812 3456 7890",
        message: "Late check-in requested",
        privacyAccepted: true,
        locale: "en",
        website: "", // Empty honeypot
      }),
    });

    const res = await postPublicInquiryRoute(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.data.code).toMatch(/^SGV-\d{4}-[A-Z0-9]{4}$/);
    expect(body.data.status).toBe("PENDING");

    // Verify in database: status must be PENDING, paymentStatus UNPAID, source WEBSITE
    const createdReservation = await prisma.reservation.findUnique({
      where: { code: body.data.code },
      include: { guest: true },
    });
    expect(createdReservation).toBeDefined();
    expect(createdReservation?.status).toBe("PENDING");
    expect(createdReservation?.paymentStatus).toBe("UNPAID");
    expect(createdReservation?.source).toBe("WEBSITE");
    expect(createdReservation?.guest.email).toBe(testEmail);

    // 2. Anti-spam honeypot test (TC-R04): silent discard
    const honeypotEmail = `${TEST_PREFIX}bot@example.com`;
    const honeypotReq = new Request(`${SITE_ORIGIN}/api/public/inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitSlug: "garden-villa",
        checkIn: futureCheckIn,
        checkOut: futureCheckOut,
        adults: 2,
        children: 0,
        name: "Bot Spammer",
        email: honeypotEmail,
        privacyAccepted: true,
        website: "https://spam-viagra-casino.example.com", // Filled honeypot!
      }),
    });

    const honeypotRes = await postPublicInquiryRoute(honeypotReq);
    expect(honeypotRes.status).toBe(201); // Returns 201 to deceive bot

    // BUT nothing was saved to database!
    const discardedGuest = await prisma.guest.findFirst({
      where: { email: honeypotEmail },
    });
    expect(discardedGuest).toBeNull();

    // 3. Idempotency test (TC-R06): same Idempotency-Key returns original result
    const idempotencyKey = `idem-${Date.now()}`;
    const idemEmail = `${TEST_PREFIX}idem@example.com`;
    const idemCheckIn = formatDateOnly(addDays(today, 70));
    const idemCheckOut = formatDateOnly(addDays(today, 72));

    const idemReq1 = new Request(`${SITE_ORIGIN}/api/public/inquiries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        unitSlug: "garden-villa",
        checkIn: idemCheckIn,
        checkOut: idemCheckOut,
        adults: 1,
        name: "Idempotent Guest",
        email: idemEmail,
        privacyAccepted: true,
      }),
    });

    const idemRes1 = await postPublicInquiryRoute(idemReq1);
    expect(idemRes1.status).toBe(201);
    const idemBody1 = await idemRes1.json();

    // Replay with identical key
    const idemReq2 = new Request(`${SITE_ORIGIN}/api/public/inquiries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        unitSlug: "garden-villa",
        checkIn: idemCheckIn,
        checkOut: idemCheckOut,
        adults: 1,
        name: "Idempotent Guest",
        email: idemEmail,
        privacyAccepted: true,
      }),
    });

    const idemRes2 = await postPublicInquiryRoute(idemReq2);
    expect(idemRes2.status).toBe(201);
    const idemBody2 = await idemRes2.json();
    expect(idemBody2.data.code).toBe(idemBody1.data.code);

    // 4. Rate limit check: exceeding limit triggers 429 RATE_LIMITED
    const rateLimitIp = "192.0.2.99";
    for (let i = 0; i < 5; i++) {
      const rlReq = new Request(`${SITE_ORIGIN}/api/public/inquiries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": rateLimitIp,
        },
        body: JSON.stringify({
          unitSlug: "loft-suite",
          checkIn: formatDateOnly(addDays(today, 80 + i * 4)),
          checkOut: formatDateOnly(addDays(today, 82 + i * 4)),
          adults: 1,
          name: `RL Guest ${i}`,
          email: `${TEST_PREFIX}rl${i}@example.com`,
          privacyAccepted: true,
        }),
      });
      const rlRes = await postPublicInquiryRoute(rlReq);
      expect(rlRes.status).toBe(201);
    }

    // 6th request from same IP must be rejected with 429
    const blockedReq = new Request(`${SITE_ORIGIN}/api/public/inquiries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": rateLimitIp,
      },
      body: JSON.stringify({
        unitSlug: "loft-suite",
        checkIn: formatDateOnly(addDays(today, 120)),
        checkOut: formatDateOnly(addDays(today, 122)),
        adults: 1,
        name: "Blocked Guest",
        email: `${TEST_PREFIX}blocked@example.com`,
        privacyAccepted: true,
      }),
    });
    const blockedRes = await postPublicInquiryRoute(blockedReq);
    expect(blockedRes.status).toBe(429);
  });

  // ==========================================
  // 6. SEO METADATA, SITEMAP & ROBOTS (FR-07)
  // ==========================================
  it("FR-07: sitemap generates routes for both locales and robots.txt disallows admin paths", async () => {
    // 1. Sitemap
    const sitemapEntries = await sitemap();
    expect(Array.isArray(sitemapEntries)).toBe(true);
    expect(sitemapEntries.length).toBeGreaterThanOrEqual(10);

    const urls = sitemapEntries.map((e) => e.url);
    expect(urls.some((u) => u.includes("/en"))).toBe(true);
    expect(urls.some((u) => u.includes("/id"))).toBe(true);
    expect(urls.some((u) => u.includes("/en/villas"))).toBe(true);
    expect(urls.some((u) => u.includes("/id/villas"))).toBe(true);
    expect(urls.some((u) => u.includes("/en/book"))).toBe(true);

    // 2. Robots.txt
    const robotsConfig = robots();
    expect(robotsConfig.rules).toBeDefined();
    const rules = Array.isArray(robotsConfig.rules) ? robotsConfig.rules[0] : robotsConfig.rules;
    expect(rules?.disallow).toContain("/admin/");
    expect(rules?.disallow).toContain("/api/admin/");
    expect(robotsConfig.sitemap).toContain("/sitemap.xml");
  });
});
