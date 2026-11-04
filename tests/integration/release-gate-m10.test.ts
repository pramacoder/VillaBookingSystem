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

import { GET as getHealthRoute } from "@/app/api/health/route";
import GET_ROBOTS from "@/app/robots";
import GET_SITEMAP from "@/app/sitemap";
import { addDays, formatDateOnly } from "@/lib/dates";
import {
  confirmReservation,
  createStaffReservation,
  updateReservation,
} from "@/server/services/reservation-service";

const prisma = new PrismaClient();
const TEST_PREFIX = "m10-gate-";

describe("Milestone M10: QA, Release Gate & Handover Suite", () => {
  let adminId: string;
  let staffId: string;
  let unitId: string;

  beforeAll(async () => {
    // Setup test admin & staff
    const admin = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}admin@sagaravillas.com`,
        name: "M10 Gate Admin",
        passwordHash: "argon2id$mock$hash",
        role: "ADMIN",
        isActive: true,
      },
    });
    adminId = admin.id;

    const staff = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}staff@sagaravillas.com`,
        name: "M10 Gate Staff",
        passwordHash: "argon2id$mock$hash",
        role: "STAFF",
        isActive: true,
      },
    });
    staffId = staff.id;

    const unit = await prisma.unit.create({
      data: {
        slug: `${TEST_PREFIX}villa`,
        status: "ACTIVE",
        nameEn: "M10 Release Gate Villa",
        nameId: "Villa Gerbang Rilis M10",
        summaryEn: "Serene test unit for release gate",
        summaryId: "Unit uji yang tenang untuk gerbang rilis",
        descriptionEn: "Long description",
        descriptionId: "Deskripsi panjang",
        maxGuests: 4,
        bedrooms: 2,
        bathrooms: 2,
        baseRateIdr: 2_500_000,
        cleaningFeeIdr: 200_000,
        minNights: 1,
      },
    });
    unitId = unit.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.reservation.deleteMany({
      where: { unitId },
    });
    await prisma.unit.deleteMany({
      where: { id: unitId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminId, staffId] } },
    });
    await prisma.$disconnect();
  });

  describe("Health Check Endpoint (DEPLOYMENT §7, §9)", () => {
    it("returns 200 with status ok and database ok", async () => {
      const res = await getHealthRoute();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("ok");
      expect(json.database).toBe("ok");
      expect(json.timestamp).toBeDefined();
    });
  });

  describe("SEO, Sitemap & Robots Validation (TESTING §8, DEPLOYMENT §7)", () => {
    it("robots.txt disallows admin and internal API routes while exposing sitemap", () => {
      const robots = GET_ROBOTS();
      expect(robots.rules).toBeDefined();

      const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
      const disallows = rules.flatMap((r) => (Array.isArray(r.disallow) ? r.disallow : [r.disallow]));
      expect(disallows).toContain("/admin/");
      expect(disallows).toContain("/api/admin/");
      expect(robots.sitemap).toContain("/sitemap.xml");
    });

    it("sitemap.xml includes localized home, static pages, and active units", async () => {
      const sitemap = await GET_SITEMAP();
      expect(sitemap.length).toBeGreaterThan(0);

      const urls = sitemap.map((entry) => entry.url);
      expect(urls.some((u) => u.includes("/en"))).toBe(true);
      expect(urls.some((u) => u.includes("/id"))).toBe(true);
      expect(urls.some((u) => u.includes("/villas"))).toBe(true);
      expect(urls.some((u) => u.includes("/about"))).toBe(true);

      // No admin or private routes in sitemap
      expect(urls.some((u) => u.includes("/admin"))).toBe(false);
      expect(urls.some((u) => u.includes("/api"))).toBe(false);
    });
  });

  describe("Concurrency Stress Verification (20 Iterations, TESTING §9 Release Gate)", () => {
    it("repeats parallel confirms 20 times with 0 race condition flakes (TC-C01)", async () => {
      const now = new Date("2026-11-05T01:00:00.000Z");

      for (let i = 0; i < 20; i++) {
        // Offset each iteration by 5 days so iterations never collide with each other
        const iterBase = addDays(new Date("2028-01-01T00:00:00.000Z"), i * 5);
        const checkIn = formatDateOnly(iterBase);
        const checkOut = formatDateOnly(addDays(iterBase, 3));

        // Create two overlapping PENDING requests for the exact same dates
        const [p1, p2] = await Promise.all([
          createStaffReservation(
            prisma,
            {
              unitId,
              checkIn,
              checkOut,
              adults: 2,
              children: 0,
              status: "PENDING",
              guest: {
                fullName: `Conc Test Guest A-${i}`,
                email: `conc-a-${i}@example.com`,
              },
            },
            { actorId: staffId, now },
          ),
          createStaffReservation(
            prisma,
            {
              unitId,
              checkIn,
              checkOut,
              adults: 2,
              children: 0,
              status: "PENDING",
              guest: {
                fullName: `Conc Test Guest B-${i}`,
                email: `conc-b-${i}@example.com`,
              },
            },
            { actorId: staffId, now },
          ),
        ]);

        // Confirm both in parallel
        const results = await Promise.allSettled([
          confirmReservation(prisma, {
            reservationId: p1.id,
            actorId: staffId,
            now,
          }),
          confirmReservation(prisma, {
            reservationId: p2.id,
            actorId: adminId,
            now,
          }),
        ]);

        const fulfilled = results.filter((r) => r.status === "fulfilled");
        const rejected = results.filter((r) => r.status === "rejected");

        expect(
          fulfilled,
          `Iteration ${i + 1}: exactly one parallel confirmation must succeed`,
        ).toHaveLength(1);
        expect(
          rejected,
          `Iteration ${i + 1}: exactly one parallel confirmation must fail with DATE_CONFLICT`,
        ).toHaveLength(1);
      }
    });

    it("repeats concurrent optimistic concurrency edits 20 times with 0 lost updates (TC-C03)", async () => {
      const now = new Date("2026-11-05T01:00:00.000Z");

      for (let i = 0; i < 20; i++) {
        const iterBase = addDays(new Date("2029-01-01T00:00:00.000Z"), i * 5);
        const checkIn = formatDateOnly(iterBase);
        const checkOut = formatDateOnly(addDays(iterBase, 3));

        const res = await createStaffReservation(
          prisma,
          {
            unitId,
            checkIn,
            checkOut,
            adults: 2,
            children: 0,
            status: "PENDING",
            guest: {
              fullName: `Optimistic Guest ${i}`,
              email: `optimistic-${i}@example.com`,
            },
          },
          { actorId: staffId, now },
        );

        // Two edits sharing the initial version
        const editResults = await Promise.allSettled([
          updateReservation(prisma, {
            reservationId: res.id,
            expectedVersion: res.version,
            rawPatch: { adults: 3, internalNotes: `Update A from iteration ${i}` },
            actorId: staffId,
          }),
          updateReservation(prisma, {
            reservationId: res.id,
            expectedVersion: res.version,
            rawPatch: { adults: 4, internalNotes: `Update B from iteration ${i}` },
            actorId: adminId,
          }),
        ]);

        const fulfilled = editResults.filter((r) => r.status === "fulfilled");
        const rejected = editResults.filter((r) => r.status === "rejected");

        expect(
          fulfilled,
          `Iteration ${i + 1}: exactly one concurrent edit with matching version must succeed`,
        ).toHaveLength(1);
        expect(
          rejected,
          `Iteration ${i + 1}: exactly one concurrent edit must be rejected with VERSION_CONFLICT`,
        ).toHaveLength(1);
      }
    });
  });

  describe("Security Sanitization & Secret Scanning (SEC-12, SEC-14)", () => {
    it("ensures source tree components contain no hardcoded production passwords or secrets", async () => {
      // In Next.js client bundles, no process.env.DATABASE_URL or AUTH_SECRET should be referenced
      const clientComponentsPath = "src/components";
      const fs = await import("node:fs");
      const path = await import("node:path");

      function scanDir(dir: string): string[] {
        let files: string[] = [];
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, item.name);
          if (item.isDirectory()) {
            files = files.concat(scanDir(full));
          } else if (item.name.endsWith(".tsx") || item.name.endsWith(".ts")) {
            files.push(full);
          }
        }
        return files;
      }

      const files = scanDir(clientComponentsPath);
      for (const file of files) {
        const content = fs.readFileSync(file, "utf8");
        expect(content).not.toContain("process.env.DATABASE_URL");
        expect(content).not.toContain("process.env.DIRECT_URL");
        expect(content).not.toContain("process.env.AUTH_SECRET");
        expect(content).not.toContain("process.env.SEED_ADMIN_PASSWORD");
      }
    });
  });
});
