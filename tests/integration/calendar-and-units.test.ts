import { PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/server/auth/password";
import { addDays, formatDateOnly, parseDateOnly } from "@/lib/dates";
import { AppError, ConflictError, ValidationError } from "@/lib/errors";

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

import { GET as getCalendarRoute } from "@/app/api/admin/calendar/route";
import { POST as postBlockRoute } from "@/app/api/admin/blocks/route";
import { DELETE as deleteBlockRoute } from "@/app/api/admin/blocks/[id]/route";
import { GET as getUnitsRoute, POST as postUnitsRoute } from "@/app/api/admin/units/route";
import {
  GET as getUnitDetailRoute,
  PATCH as patchUnitRoute,
} from "@/app/api/admin/units/[id]/route";
import { POST as postArchiveUnitRoute } from "@/app/api/admin/units/[id]/archive/route";
import { PUT as putAmenitiesRoute } from "@/app/api/admin/units/[id]/amenities/route";
import { POST as postUnitImageRoute } from "@/app/api/admin/units/[id]/images/route";
import {
  DELETE as deleteUnitImageRoute,
  PATCH as patchUnitImageRoute,
} from "@/app/api/admin/units/[id]/images/[imageId]/route";

import {
  addUnitImage,
  archiveUnit,
  createUnit,
  deleteUnitBlockService,
  deleteUnitImage,
  getUnitDetail,
  listAllAmenities,
  listUnits,
  setUnitAmenities,
  updateUnit,
  updateUnitImage,
} from "@/server/services/unit-service";
import { getAdminCalendar } from "@/server/services/calendar-service";
import { createUnitBlockService } from "@/server/services/availability-service";

const prisma = new PrismaClient();
const TEST_PREFIX = "m6-test-";
const SITE_ORIGIN = "http://localhost:3000";

let adminUserId: string;
let staffUserId: string;
let createdUnitId: string;
let createdUnitSlug: string;
let testAmenityId: string;

function makeRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    origin?: string;
  } = {},
): Request {
  const headers = new Headers();
  headers.set("origin", options.origin ?? SITE_ORIGIN);
  headers.set("host", "localhost:3000");

  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  return new Request(url, {
    method: options.method ?? "GET",
    headers,
    body,
  });
}

function setSession(
  user: { id: string; email: string; name: string; role: "ADMIN" | "STAFF" } | null,
) {
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
    expires: new Date(Date.now() + 86400000).toISOString(),
  } as unknown as Session;
}

beforeAll(async () => {
  // Clean up any stale data from prior interrupted runs
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  });
  await prisma.unit.deleteMany({
    where: { slug: { startsWith: TEST_PREFIX } },
  });

  const passwordHash = await hashPassword("ValidPassword123!");

  const admin = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}admin@example.com`,
      name: "Admin Tester",
      role: "ADMIN",
      passwordHash,
      isActive: true,
    },
  });
  adminUserId = admin.id;

  const staff = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}staff@example.com`,
      name: "Staff Tester",
      role: "STAFF",
      passwordHash,
      isActive: true,
    },
  });
  staffUserId = staff.id;

  // Create an amenity for tests
  const amenity = await prisma.amenity.upsert({
    where: { key: `${TEST_PREFIX}wifi` },
    update: {},
    create: {
      key: `${TEST_PREFIX}wifi`,
      nameEn: "High-Speed WiFi",
      nameId: "WiFi Kecepatan Tinggi",
      category: "IN_VILLA",
      icon: "wifi",
    },
  });
  testAmenityId = amenity.id;
});

afterAll(async () => {
  // Clean up test data
  await prisma.unitBlock.deleteMany({
    where: { note: { startsWith: TEST_PREFIX } },
  });
  await prisma.unitImage.deleteMany({
    where: { source: { startsWith: TEST_PREFIX } },
  });
  await prisma.unitAmenity.deleteMany({
    where: { amenityId: testAmenityId },
  });
  await prisma.amenity.deleteMany({
    where: { key: { startsWith: TEST_PREFIX } },
  });
  await prisma.reservation.deleteMany({
    where: { code: { startsWith: "SGV-M6" } },
  });
  await prisma.unit.deleteMany({
    where: { slug: { startsWith: TEST_PREFIX } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  });
  await prisma.$disconnect();
});

beforeEach(() => {
  setSession(null);
});

describe("Milestone 6: Calendar Service and Constraints", () => {
  it("rejects window exceeding 62 days per API.md §5.3 / NFR-02", async () => {
    await expect(
      getAdminCalendar(prisma, {
        from: "2026-06-01",
        to: "2026-08-15", // 75 days > 62
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects invalid date range where 'to' is on or before 'from'", async () => {
    await expect(
      getAdminCalendar(prisma, {
        from: "2026-06-10",
        to: "2026-06-05",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("executes single-query calendar fetch for window <= 62 days", async () => {
    const calendar = await getAdminCalendar(prisma, {
      from: "2026-06-01",
      to: "2026-06-30",
    });

    expect(calendar).toBeDefined();
    expect(calendar.from).toBe("2026-06-01");
    expect(calendar.to).toBe("2026-06-30");
    expect(calendar.daysCount).toBe(29);
    expect(Array.isArray(calendar.units)).toBe(true);
  });
});

describe("Milestone 6: Unit Service & Management Rules", () => {
  it("creates a unit in DRAFT status with full specification", async () => {
    createdUnitSlug = `${TEST_PREFIX}villa-deluxe`;
    const unit = await createUnit(
      prisma,
      {
        slug: createdUnitSlug,
        nameEn: "Deluxe Cliff Villa",
        nameId: "Villa Tebing Mewah",
        summaryEn: "Panoramic sea view villa",
        summaryId: "Villa dengan pemandangan laut panoramik",
        descriptionEn: "Complete luxury cliffside retreat with private pool.",
        descriptionId: "Penginapan mewah di tepi tebing dengan kolam renang pribadi.",
        maxGuests: 4,
        bedrooms: 2,
        bathrooms: 2,
        areaSqm: 180,
        baseRateIdr: 4500000,
        cleaningFeeIdr: 250000,
        minNights: 2,
        sortOrder: 10,
        status: "DRAFT",
      },
      adminUserId,
    );

    expect(unit.id).toBeDefined();
    expect(unit.slug).toBe(createdUnitSlug);
    expect(unit.status).toBe("DRAFT");
    expect(unit.baseRateIdr).toBe(4500000);
    createdUnitId = unit.id;
  });

  it("allows changing slug while unit is in DRAFT status (API.md §5.1)", async () => {
    const newSlug = `${TEST_PREFIX}villa-deluxe-v2`;
    const updated = await updateUnit(prisma, createdUnitId, { slug: newSlug }, adminUserId);
    expect(updated.slug).toBe(newSlug);
    createdUnitSlug = newSlug;
  });

  it("rejects slug change once unit is ACTIVE (API.md §5.1)", async () => {
    // Activate the unit first
    await updateUnit(prisma, createdUnitId, { status: "ACTIVE" }, adminUserId);

    // Attempting to change slug on ACTIVE unit must throw AppError / 422 BUSINESS_RULE
    await expect(
      updateUnit(prisma, createdUnitId, { slug: `${TEST_PREFIX}cannot-change-now` }, adminUserId),
    ).rejects.toThrow(AppError);
  });

  it("manages unit amenities (replace set)", async () => {
    const result = await setUnitAmenities(
      prisma,
      createdUnitId,
      { amenityIds: [testAmenityId] },
      adminUserId,
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(testAmenityId);

    const detail = await getUnitDetail(prisma, createdUnitId);
    expect(detail.amenities.some((a) => a.id === testAmenityId)).toBe(true);
  });

  it("registers unit images with full asset manifest compliance (CONTENT_GUIDE §8)", async () => {
    const img = await addUnitImage(
      prisma,
      createdUnitId,
      {
        path: "/images/units/cliff-bedroom.webp",
        altEn: "Master bedroom facing Indian ocean",
        altId: "Kamar tidur utama menghadap samudra hindia",
        source: `${TEST_PREFIX}Original In-house shoot`,
        license: "Proprietary Sagara Villas",
        credit: "Photo by Studio Sagara",
        isCover: true,
        sortOrder: 1,
      },
      adminUserId,
    );

    expect(img.id).toBeDefined();
    expect(img.isCover).toBe(true);
    expect(img.source).toContain(TEST_PREFIX);

    // Update image
    const updatedImg = await updateUnitImage(
      prisma,
      createdUnitId,
      img.id,
      { sortOrder: 5, isCover: false },
      adminUserId,
    );
    expect(updatedImg.sortOrder).toBe(5);
    expect(updatedImg.isCover).toBe(false);

    // Delete image
    await deleteUnitImage(prisma, createdUnitId, img.id, adminUserId);
    const detailAfter = await getUnitDetail(prisma, createdUnitId);
    expect(detailAfter.images.some((i) => i.id === img.id)).toBe(false);
  });

  it("blocks archiving a unit with active or future reservations (409 HAS_DEPENDENCIES / FR-13)", async () => {
    // Create a future reservation on this unit
    const guest = await prisma.guest.create({
      data: {
        fullName: "Dependency Tester",
        email: `${TEST_PREFIX}dependency@example.com`,
      },
    });

    const futureCheckIn = addDays(new Date(), 10);
    const futureCheckOut = addDays(new Date(), 14);

    const reservation = await prisma.reservation.create({
      data: {
        code: "SGV-M6-DEP1",
        unitId: createdUnitId,
        guestId: guest.id,
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
        checkIn: parseDateOnly(formatDateOnly(futureCheckIn)),
        checkOut: parseDateOnly(formatDateOnly(futureCheckOut)),
        adults: 2,
        children: 0,
        nights: 4,
        nightlySubtotalIdr: 18000000,
        totalIdr: 18000000,
        pricingSnapshot: {},
      },
    });

    // Attempting to archive the unit must throw ConflictError (409 HAS_DEPENDENCIES)
    await expect(archiveUnit(prisma, createdUnitId, adminUserId)).rejects.toThrow(ConflictError);

    // Clean up reservation
    await prisma.reservation.delete({ where: { id: reservation.id } });
    await prisma.guest.delete({ where: { id: guest.id } });
  });

  it("successfully archives unit when no future reservations exist", async () => {
    const archived = await archiveUnit(prisma, createdUnitId, adminUserId);
    expect(archived.status).toBe("ARCHIVED");

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: "Unit",
        entityId: createdUnitId,
        action: "unit.archive",
      },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe(adminUserId);
  });
});

describe("Milestone 6: Maintenance Blocks & Availability Conflicts", () => {
  let blockUnitId: string;

  beforeAll(async () => {
    const u = await prisma.unit.create({
      data: {
        slug: `${TEST_PREFIX}block-unit`,
        nameEn: "Block Test Unit",
        nameId: "Unit Uji Blok",
        summaryEn: "Summary",
        summaryId: "Ringkasan",
        descriptionEn: "Desc",
        descriptionId: "Desk",
        maxGuests: 2,
        bedrooms: 1,
        bathrooms: 1,
        baseRateIdr: 2000000,
        status: "ACTIVE",
      },
    });
    blockUnitId = u.id;
  });

  afterAll(async () => {
    await prisma.unitBlock.deleteMany({ where: { unitId: blockUnitId } });
    await prisma.unit.delete({ where: { id: blockUnitId } });
  });

  it("creates and deletes a unit maintenance block with audit trail", async () => {
    const startStr = "2026-11-01";
    const endStr = "2026-11-05";

    const block = await createUnitBlockService(
      prisma,
      {
        unitId: blockUnitId,
        startDate: startStr,
        endDate: endStr,
        reason: "MAINTENANCE",
        note: `${TEST_PREFIX}Air conditioner replacement`,
      },
      staffUserId,
    );

    expect(block.id).toBeDefined();
    expect(formatDateOnly(block.startDate)).toBe(startStr);
    expect(formatDateOnly(block.endDate)).toBe(endStr);

    // Verify deletion
    await deleteUnitBlockService(prisma, block.id, adminUserId);

    const check = await prisma.unitBlock.findUnique({ where: { id: block.id } });
    expect(check).toBeNull();
  });

  it("detects and rejects block overlapping confirmed reservation (TC-D06)", async () => {
    const guest = await prisma.guest.create({
      data: {
        fullName: "Block Conflict Guest",
        email: `${TEST_PREFIX}blockconflict@example.com`,
      },
    });

    const res = await prisma.reservation.create({
      data: {
        code: "SGV-M6-CONF1",
        unitId: blockUnitId,
        guestId: guest.id,
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
        checkIn: parseDateOnly("2026-11-10"),
        checkOut: parseDateOnly("2026-11-15"),
        adults: 2,
        children: 0,
        nights: 5,
        nightlySubtotalIdr: 10000000,
        totalIdr: 10000000,
        pricingSnapshot: {},
      },
    });

    // Attempting to create block overlapping [2026-11-12 .. 2026-11-17) must be rejected
    await expect(
      createUnitBlockService(
        prisma,
        {
          unitId: blockUnitId,
          startDate: "2026-11-12",
          endDate: "2026-11-17",
          reason: "MAINTENANCE",
          note: "Conflict block",
        },
        staffUserId,
      ),
    ).rejects.toThrow();

    await prisma.reservation.delete({ where: { id: res.id } });
    await prisma.guest.delete({ where: { id: guest.id } });
  });
});

describe("Milestone 6: API Routes & Role-Based Authorization", () => {
  it("enforces RBAC on GET /api/admin/calendar (STAFF and ADMIN allowed, anonymous rejected)", async () => {
    // Anonymous
    setSession(null);
    const resAnon = await getCalendarRoute(
      makeRequest("http://localhost:3000/api/admin/calendar?from=2026-06-01&to=2026-06-15"),
    );
    expect(resAnon.status).toBe(401);

    // STAFF
    setSession({
      id: staffUserId,
      email: `${TEST_PREFIX}staff@example.com`,
      name: "Staff",
      role: "STAFF",
    });
    const resStaff = await getCalendarRoute(
      makeRequest("http://localhost:3000/api/admin/calendar?from=2026-06-01&to=2026-06-15"),
    );
    expect(resStaff.status).toBe(200);
    const bodyStaff = (await resStaff.json()) as { data: { daysCount: number } };
    expect(bodyStaff.data.daysCount).toBe(14);
  });

  it("enforces RBAC on POST /api/admin/units (STAFF forbidden 403, ADMIN creates 201)", async () => {
    const payload = {
      slug: `${TEST_PREFIX}staff-forbidden-villa`,
      nameEn: "Staff Villa",
      nameId: "Villa Staf",
      summaryEn: "Summary",
      summaryId: "Ringkasan",
      descriptionEn: "Desc",
      descriptionId: "Desk",
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 1,
      baseRateIdr: 2000000,
    };

    // STAFF
    setSession({
      id: staffUserId,
      email: `${TEST_PREFIX}staff@example.com`,
      name: "Staff",
      role: "STAFF",
    });
    const resStaff = await postUnitsRoute(
      makeRequest("http://localhost:3000/api/admin/units", {
        method: "POST",
        body: payload,
      }),
    );
    expect(resStaff.status).toBe(403);

    // ADMIN
    setSession({
      id: adminUserId,
      email: `${TEST_PREFIX}admin@example.com`,
      name: "Admin",
      role: "ADMIN",
    });
    const resAdmin = await postUnitsRoute(
      makeRequest("http://localhost:3000/api/admin/units", {
        method: "POST",
        body: payload,
      }),
    );
    expect(resAdmin.status).toBe(201);
  });

  it("handles GET /api/admin/units and detail route", async () => {
    setSession({
      id: staffUserId,
      email: `${TEST_PREFIX}staff@example.com`,
      name: "Staff",
      role: "STAFF",
    });

    const listRes = await getUnitsRoute(makeRequest("http://localhost:3000/api/admin/units"));
    expect(listRes.status).toBe(200);

    const detailRes = await getUnitDetailRoute(
      makeRequest(`http://localhost:3000/api/admin/units/${createdUnitId}`),
      { params: Promise.resolve({ id: createdUnitId }) },
    );
    expect(detailRes.status).toBe(200);

    const allUnits = await listUnits(prisma);
    expect(Array.isArray(allUnits)).toBe(true);
    const amenities = await listAllAmenities(prisma);
    expect(Array.isArray(amenities)).toBe(true);

    // ADMIN can patch unit via route
    setSession({
      id: adminUserId,
      email: `${TEST_PREFIX}admin@example.com`,
      name: "Admin",
      role: "ADMIN",
    });

    const patchUnitRes = await patchUnitRoute(
      makeRequest(`http://localhost:3000/api/admin/units/${createdUnitId}`, {
        method: "PATCH",
        body: { nameEn: "Patched Villa Name" },
      }),
      { params: Promise.resolve({ id: createdUnitId }) },
    );
    expect(patchUnitRes.status).toBe(200);

    const archiveRes = await postArchiveUnitRoute(
      makeRequest(`http://localhost:3000/api/admin/units/${createdUnitId}/archive`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: createdUnitId }) },
    );
    expect([200, 409]).toContain(archiveRes.status);
  });

  it("enforces RBAC on unit image and amenity routes", async () => {
    // STAFF forbidden from amenities PUT
    setSession({
      id: staffUserId,
      email: `${TEST_PREFIX}staff@example.com`,
      name: "Staff",
      role: "STAFF",
    });

    const putAmenityStaff = await putAmenitiesRoute(
      makeRequest(`http://localhost:3000/api/admin/units/${createdUnitId}/amenities`, {
        method: "PUT",
        body: { amenityIds: [testAmenityId] },
      }),
      { params: Promise.resolve({ id: createdUnitId }) },
    );
    expect(putAmenityStaff.status).toBe(403);

    // ADMIN can PUT amenities
    setSession({
      id: adminUserId,
      email: `${TEST_PREFIX}admin@example.com`,
      name: "Admin",
      role: "ADMIN",
    });

    const putAmenityAdmin = await putAmenitiesRoute(
      makeRequest(`http://localhost:3000/api/admin/units/${createdUnitId}/amenities`, {
        method: "PUT",
        body: { amenityIds: [testAmenityId] },
      }),
      { params: Promise.resolve({ id: createdUnitId }) },
    );
    expect(putAmenityAdmin.status).toBe(200);

    // ADMIN add image route
    const addImgRes = await postUnitImageRoute(
      makeRequest(`http://localhost:3000/api/admin/units/${createdUnitId}/images`, {
        method: "POST",
        body: {
          path: "/images/units/route-test.webp",
          altEn: "Route test image",
          altId: "Foto uji rute",
          source: `${TEST_PREFIX}Route Test`,
          license: "MIT",
          sortOrder: 2,
        },
      }),
      { params: Promise.resolve({ id: createdUnitId }) },
    );
    expect(addImgRes.status).toBe(201);
    const imgData = (await addImgRes.json()) as { data: { id: string } };

    // PATCH image
    const patchImgRes = await patchUnitImageRoute(
      makeRequest(
        `http://localhost:3000/api/admin/units/${createdUnitId}/images/${imgData.data.id}`,
        {
          method: "PATCH",
          body: { sortOrder: 10 },
        },
      ),
      { params: Promise.resolve({ id: createdUnitId, imageId: imgData.data.id }) },
    );
    expect(patchImgRes.status).toBe(200);

    // DELETE image
    const delImgRes = await deleteUnitImageRoute(
      makeRequest(
        `http://localhost:3000/api/admin/units/${createdUnitId}/images/${imgData.data.id}`,
        {
          method: "DELETE",
        },
      ),
      { params: Promise.resolve({ id: createdUnitId, imageId: imgData.data.id }) },
    );
    expect(delImgRes.status).toBe(200);
  });

  it("handles block creation and deletion routes", async () => {
    setSession({
      id: staffUserId,
      email: `${TEST_PREFIX}staff@example.com`,
      name: "Staff",
      role: "STAFF",
    });

    const createBlockRes = await postBlockRoute(
      makeRequest("http://localhost:3000/api/admin/blocks", {
        method: "POST",
        body: {
          unitId: createdUnitId,
          startDate: "2026-12-01",
          endDate: "2026-12-05",
          reason: "MAINTENANCE",
          note: `${TEST_PREFIX}API block test`,
        },
      }),
    );
    expect(createBlockRes.status).toBe(201);
    const blockData = (await createBlockRes.json()) as { data: { id: string } };

    const delBlockRes = await deleteBlockRoute(
      makeRequest(`http://localhost:3000/api/admin/blocks/${blockData.data.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: blockData.data.id }) },
    );
    expect(delBlockRes.status).toBe(200);
  });
});
