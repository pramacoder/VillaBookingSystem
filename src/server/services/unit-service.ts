import type { Amenity, Prisma, PrismaClient, Unit, UnitBlock, UnitImage } from "@prisma/client";
import { formatDateOnly, todayInPropertyTz } from "@/lib/dates";
import { AppError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  createUnitImageSchema,
  createUnitSchema,
  listUnitsQuerySchema,
  setUnitAmenitiesSchema,
  updateUnitImageSchema,
  updateUnitSchema,
} from "@/lib/validation/unit";
import { writeAuditLog } from "@/server/services/audit-service";
import { BLOCKING_RESERVATION_STATUSES } from "@/server/services/availability-service";

export interface UnitListItem extends Unit {
  imagesCount: number;
  amenitiesCount: number;
  activeReservationsCount: number;
  coverImage: { path: string; altEn: string; altId: string } | null;
}

export async function listUnits(prisma: PrismaClient, rawQuery?: unknown): Promise<UnitListItem[]> {
  const query = listUnitsQuerySchema.parse(rawQuery ?? {});

  const where: Prisma.UnitWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q && query.q.length > 0
      ? {
          OR: [
            { nameEn: { contains: query.q, mode: "insensitive" } },
            { nameId: { contains: query.q, mode: "insensitive" } },
            { slug: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await prisma.unit.findMany({
    where,
    orderBy: [{ [query.sortBy]: query.sortDir }, { id: "asc" }],
    include: {
      images: {
        where: { isCover: true },
        take: 1,
        select: { path: true, altEn: true, altId: true },
      },
      _count: {
        select: {
          images: true,
          amenities: true,
          reservations: {
            where: {
              status: { in: [...BLOCKING_RESERVATION_STATUSES, "PENDING"] },
            },
          },
        },
      },
    },
  });

  return rows.map((r) => ({
    ...r,
    imagesCount: r._count.images,
    amenitiesCount: r._count.amenities,
    activeReservationsCount: r._count.reservations,
    coverImage: r.images[0] ?? null,
  }));
}

export interface UnitDetailResult extends Unit {
  amenities: Array<{
    id: string;
    key: string;
    nameEn: string;
    nameId: string;
    category: string;
    icon: string | null;
  }>;
  images: UnitImage[];
  blocks: UnitBlock[];
  activeReservationsCount: number;
}

export async function getUnitDetail(
  prisma: PrismaClient,
  unitId: string,
): Promise<UnitDetailResult> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      amenities: {
        include: {
          amenity: true,
        },
      },
      images: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      },
      blocks: {
        orderBy: { startDate: "desc" },
      },
      _count: {
        select: {
          reservations: {
            where: {
              status: { in: [...BLOCKING_RESERVATION_STATUSES, "PENDING"] },
            },
          },
        },
      },
    },
  });

  if (!unit) {
    throw new NotFoundError("Unit not found.");
  }

  return {
    ...unit,
    amenities: unit.amenities.map((ua) => ua.amenity),
    activeReservationsCount: unit._count.reservations,
  };
}

export async function createUnit(
  prisma: PrismaClient,
  rawInput: unknown,
  actorId: string,
): Promise<Unit> {
  const input = createUnitSchema.parse(rawInput);

  const existingSlug = await prisma.unit.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });

  if (existingSlug) {
    throw new ValidationError("A unit with this slug already exists.", {
      slug: "slug_already_exists",
    });
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.unit.create({
      data: {
        slug: input.slug,
        status: input.status,
        nameEn: input.nameEn,
        nameId: input.nameId,
        summaryEn: input.summaryEn,
        summaryId: input.summaryId,
        descriptionEn: input.descriptionEn,
        descriptionId: input.descriptionId,
        maxGuests: input.maxGuests,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        areaSqm: input.areaSqm ?? null,
        baseRateIdr: input.baseRateIdr,
        cleaningFeeIdr: input.cleaningFeeIdr,
        minNights: input.minNights,
        maxNights: input.maxNights ?? null,
        isFeatured: input.isFeatured,
        sortOrder: input.sortOrder,
      },
    });

    await writeAuditLog(tx, {
      actorId,
      action: "unit.create",
      entityType: "Unit",
      entityId: created.id,
      metadata: {
        slug: created.slug,
        nameEn: created.nameEn,
        status: created.status,
        baseRateIdr: created.baseRateIdr,
      },
    });

    return created;
  });
}

export async function updateUnit(
  prisma: PrismaClient,
  unitId: string,
  rawInput: unknown,
  actorId: string,
): Promise<Unit> {
  const patch = updateUnitSchema.parse(rawInput);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.unit.findUnique({
      where: { id: unitId },
    });

    if (!existing) {
      throw new NotFoundError("Unit not found.");
    }

    // Slug change allowed only for DRAFT units (API.md §5.1)
    if (patch.slug && patch.slug !== existing.slug) {
      if (existing.status !== "DRAFT") {
        throw new AppError(
          "BUSINESS_RULE",
          422,
          "Unit slug can only be modified while the unit is in DRAFT status (API.md §5.1).",
          { slug: "slug_change_only_allowed_for_draft" },
        );
      }

      const duplicate = await tx.unit.findUnique({
        where: { slug: patch.slug },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== existing.id) {
        throw new ValidationError("A unit with this slug already exists.", {
          slug: "slug_already_exists",
        });
      }
    }

    const updated = await tx.unit.update({
      where: { id: unitId },
      data: {
        ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.nameEn !== undefined ? { nameEn: patch.nameEn } : {}),
        ...(patch.nameId !== undefined ? { nameId: patch.nameId } : {}),
        ...(patch.summaryEn !== undefined ? { summaryEn: patch.summaryEn } : {}),
        ...(patch.summaryId !== undefined ? { summaryId: patch.summaryId } : {}),
        ...(patch.descriptionEn !== undefined ? { descriptionEn: patch.descriptionEn } : {}),
        ...(patch.descriptionId !== undefined ? { descriptionId: patch.descriptionId } : {}),
        ...(patch.maxGuests !== undefined ? { maxGuests: patch.maxGuests } : {}),
        ...(patch.bedrooms !== undefined ? { bedrooms: patch.bedrooms } : {}),
        ...(patch.bathrooms !== undefined ? { bathrooms: patch.bathrooms } : {}),
        ...(patch.areaSqm !== undefined ? { areaSqm: patch.areaSqm } : {}),
        ...(patch.baseRateIdr !== undefined ? { baseRateIdr: patch.baseRateIdr } : {}),
        ...(patch.cleaningFeeIdr !== undefined ? { cleaningFeeIdr: patch.cleaningFeeIdr } : {}),
        ...(patch.minNights !== undefined ? { minNights: patch.minNights } : {}),
        ...(patch.maxNights !== undefined ? { maxNights: patch.maxNights } : {}),
        ...(patch.isFeatured !== undefined ? { isFeatured: patch.isFeatured } : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
      },
    });

    await writeAuditLog(tx, {
      actorId,
      action: "unit.update",
      entityType: "Unit",
      entityId: updated.id,
      metadata: {
        updatedFields: Object.keys(patch),
      },
    });

    return updated;
  });
}

/**
 * Archives a unit (FR-13, API.md §5.1):
 * Rejects with 409 HAS_DEPENDENCIES if future blocking or pending reservations exist.
 */
export async function archiveUnit(
  prisma: PrismaClient,
  unitId: string,
  actorId: string,
  now: Date = new Date(),
): Promise<Unit> {
  const today = todayInPropertyTz(now);

  return prisma.$transaction(async (tx) => {
    const unit = await tx.unit.findUnique({
      where: { id: unitId },
      include: {
        reservations: {
          where: {
            checkOut: { gt: today },
            status: { in: [...BLOCKING_RESERVATION_STATUSES, "PENDING"] },
          },
          select: { id: true, code: true, checkIn: true, checkOut: true, status: true },
        },
      },
    });

    if (!unit) {
      throw new NotFoundError("Unit not found.");
    }

    if (unit.reservations.length > 0) {
      throw new ConflictError(
        "Cannot archive unit with future or pending reservations.",
        "HAS_DEPENDENCIES",
        {
          unitId,
          activeReservationsCount: unit.reservations.length,
          reservations: unit.reservations.map((r) => ({
            code: r.code,
            status: r.status,
            checkIn: formatDateOnly(r.checkIn),
            checkOut: formatDateOnly(r.checkOut),
          })),
        },
      );
    }

    const updated = await tx.unit.update({
      where: { id: unitId },
      data: { status: "ARCHIVED" },
    });

    await writeAuditLog(tx, {
      actorId,
      action: "unit.archive",
      entityType: "Unit",
      entityId: updated.id,
      metadata: {
        slug: updated.slug,
        previousStatus: unit.status,
      },
    });

    return updated;
  });
}

export async function setUnitAmenities(
  prisma: PrismaClient,
  unitId: string,
  rawInput: unknown,
  actorId: string,
): Promise<Amenity[]> {
  const input = setUnitAmenitiesSchema.parse(rawInput);

  return prisma.$transaction(async (tx) => {
    const unit = await tx.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });

    if (!unit) {
      throw new NotFoundError("Unit not found.");
    }

    // Replace amenity set
    await tx.unitAmenity.deleteMany({
      where: { unitId },
    });

    if (input.amenityIds.length > 0) {
      const validAmenities = await tx.amenity.findMany({
        where: { id: { in: input.amenityIds } },
        select: { id: true },
      });

      if (validAmenities.length !== input.amenityIds.length) {
        throw new ValidationError("One or more amenity IDs do not exist.");
      }

      await tx.unitAmenity.createMany({
        data: input.amenityIds.map((amenityId) => ({
          unitId,
          amenityId,
        })),
        skipDuplicates: true,
      });
    }

    const updatedAmenities = await tx.unitAmenity.findMany({
      where: { unitId },
      include: { amenity: true },
    });

    await writeAuditLog(tx, {
      actorId,
      action: "unit.set_amenities",
      entityType: "Unit",
      entityId: unitId,
      metadata: {
        count: input.amenityIds.length,
        amenityIds: input.amenityIds,
      },
    });

    return updatedAmenities.map((ua) => ua.amenity);
  });
}

export async function addUnitImage(
  prisma: PrismaClient,
  unitId: string,
  rawInput: unknown,
  actorId: string,
): Promise<UnitImage> {
  const input = createUnitImageSchema.parse(rawInput);

  return prisma.$transaction(async (tx) => {
    const unit = await tx.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });

    if (!unit) {
      throw new NotFoundError("Unit not found.");
    }

    if (input.isCover) {
      await tx.unitImage.updateMany({
        where: { unitId },
        data: { isCover: false },
      });
    }

    const image = await tx.unitImage.create({
      data: {
        unitId,
        path: input.path,
        altEn: input.altEn,
        altId: input.altId,
        isCover: input.isCover,
        sortOrder: input.sortOrder,
        source: input.source,
        license: input.license,
        credit: input.credit ?? null,
      },
    });

    await writeAuditLog(tx, {
      actorId,
      action: "unit_image.create",
      entityType: "UnitImage",
      entityId: image.id,
      metadata: {
        unitId,
        path: image.path,
        license: image.license,
      },
    });

    return image;
  });
}

export async function updateUnitImage(
  prisma: PrismaClient,
  unitId: string,
  imageId: string,
  rawInput: unknown,
  actorId: string,
): Promise<UnitImage> {
  const patch = updateUnitImageSchema.parse(rawInput);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.unitImage.findFirst({
      where: { id: imageId, unitId },
    });

    if (!existing) {
      throw new NotFoundError("Unit image not found.");
    }

    if (patch.isCover) {
      await tx.unitImage.updateMany({
        where: { unitId },
        data: { isCover: false },
      });
    }

    const updated = await tx.unitImage.update({
      where: { id: imageId },
      data: {
        ...(patch.altEn !== undefined ? { altEn: patch.altEn } : {}),
        ...(patch.altId !== undefined ? { altId: patch.altId } : {}),
        ...(patch.isCover !== undefined ? { isCover: patch.isCover } : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        ...(patch.source !== undefined ? { source: patch.source } : {}),
        ...(patch.license !== undefined ? { license: patch.license } : {}),
        ...(patch.credit !== undefined ? { credit: patch.credit } : {}),
      },
    });

    await writeAuditLog(tx, {
      actorId,
      action: "unit_image.update",
      entityType: "UnitImage",
      entityId: updated.id,
      metadata: {
        unitId,
        imageId,
        updatedFields: Object.keys(patch),
      },
    });

    return updated;
  });
}

export async function deleteUnitImage(
  prisma: PrismaClient,
  unitId: string,
  imageId: string,
  actorId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.unitImage.findFirst({
      where: { id: imageId, unitId },
    });

    if (!existing) {
      throw new NotFoundError("Unit image not found.");
    }

    await tx.unitImage.delete({
      where: { id: imageId },
    });

    await writeAuditLog(tx, {
      actorId,
      action: "unit_image.delete",
      entityType: "UnitImage",
      entityId: imageId,
      metadata: { unitId },
    });
  });
}

export async function deleteUnitBlockService(
  prisma: PrismaClient,
  blockId: string,
  actorId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const block = await tx.unitBlock.findUnique({
      where: { id: blockId },
    });

    if (!block) {
      throw new NotFoundError("Unit block not found.");
    }

    await tx.unitBlock.delete({
      where: { id: blockId },
    });

    await writeAuditLog(tx, {
      actorId,
      action: "unit_block.delete",
      entityType: "UnitBlock",
      entityId: blockId,
      metadata: {
        unitId: block.unitId,
        startDate: formatDateOnly(block.startDate),
        endDate: formatDateOnly(block.endDate),
      },
    });
  });
}

export async function listAllAmenities(prisma: PrismaClient): Promise<Amenity[]> {
  return prisma.amenity.findMany({
    orderBy: [{ category: "asc" }, { nameEn: "asc" }],
  });
}

// ==========================================
// PUBLIC UNIT SERVICES (API §3.1, §3.2, §3.3)
// ==========================================

export interface PublicUnitSummary {
  id: string;
  slug: string;
  name: string;
  summary: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  areaSqm: number | null;
  baseRateIdr: number;
  cleaningFeeIdr: number;
  minNights: number;
  maxNights: number | null;
  isFeatured: boolean;
  coverImage: { path: string; alt: string } | null;
  amenities: Array<{
    id: string;
    key: string;
    name: string;
    category: string;
    icon: string | null;
  }>;
  isDemo: true;
}

export async function listPublicUnits(
  prisma: PrismaClient,
  locale: "en" | "id" = "en",
): Promise<PublicUnitSummary[]> {
  const isId = locale === "id";
  const units = await prisma.unit.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      images: {
        where: { isCover: true },
        take: 1,
        select: { path: true, altEn: true, altId: true },
      },
      amenities: {
        include: { amenity: true },
      },
    },
  });

  return units.map((u) => {
    const cover = u.images[0]
      ? { path: u.images[0].path, alt: isId ? u.images[0].altId : u.images[0].altEn }
      : null;

    return {
      id: u.id,
      slug: u.slug,
      name: isId ? u.nameId : u.nameEn,
      summary: isId ? u.summaryId : u.summaryEn,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      maxGuests: u.maxGuests,
      areaSqm: u.areaSqm,
      baseRateIdr: u.baseRateIdr,
      cleaningFeeIdr: u.cleaningFeeIdr,
      minNights: u.minNights,
      maxNights: u.maxNights,
      isFeatured: u.isFeatured,
      coverImage: cover,
      amenities: u.amenities.map((ua) => ({
        id: ua.amenity.id,
        key: ua.amenity.key,
        name: isId ? ua.amenity.nameId : ua.amenity.nameEn,
        category: ua.amenity.category,
        icon: ua.amenity.icon,
      })),
      isDemo: true,
    };
  });
}

export interface PublicUnitDetail extends PublicUnitSummary {
  description: string;
  images: Array<{
    id: string;
    path: string;
    alt: string;
    isCover: boolean;
    sortOrder: number;
  }>;
  houseRules: {
    checkInTime: string;
    checkOutTime: string;
    quietHours: string;
    smoking: string;
    pets: string;
  };
}

export async function getPublicUnitBySlug(
  prisma: PrismaClient,
  slug: string,
  locale: "en" | "id" = "en",
): Promise<PublicUnitDetail> {
  const isId = locale === "id";
  const unit = await prisma.unit.findUnique({
    where: { slug },
    include: {
      images: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      },
      amenities: {
        include: { amenity: true },
      },
    },
  });

  if (!unit || unit.status !== "ACTIVE") {
    throw new NotFoundError("Unit not found.");
  }

  const cover = unit.images.find((img) => img.isCover) ?? unit.images[0] ?? null;

  return {
    id: unit.id,
    slug: unit.slug,
    name: isId ? unit.nameId : unit.nameEn,
    summary: isId ? unit.summaryId : unit.summaryEn,
    description: isId ? unit.descriptionId : unit.descriptionEn,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    maxGuests: unit.maxGuests,
    areaSqm: unit.areaSqm,
    baseRateIdr: unit.baseRateIdr,
    cleaningFeeIdr: unit.cleaningFeeIdr,
    minNights: unit.minNights,
    maxNights: unit.maxNights,
    isFeatured: unit.isFeatured,
    coverImage: cover ? { path: cover.path, alt: isId ? cover.altId : cover.altEn } : null,
    images: unit.images.map((img) => ({
      id: img.id,
      path: img.path,
      alt: isId ? img.altId : img.altEn,
      isCover: img.isCover,
      sortOrder: img.sortOrder,
    })),
    amenities: unit.amenities.map((ua) => ({
      id: ua.amenity.id,
      key: ua.amenity.key,
      name: isId ? ua.amenity.nameId : ua.amenity.nameEn,
      category: ua.amenity.category,
      icon: ua.amenity.icon,
    })),
    houseRules: {
      checkInTime: "14:00 WITA",
      checkOutTime: "11:00 WITA",
      quietHours: isId ? "22:00 – 07:00 WITA" : "10:00 PM – 7:00 AM WITA",
      smoking: isId ? "Dilarang merokok di dalam kamar" : "Non-smoking inside villas",
      pets: isId ? "Hewan peliharaan tidak diperkenankan" : "No pets allowed",
    },
    isDemo: true,
  };
}

export interface PublicAvailabilityResult {
  unit: string;
  blockedRanges: Array<[string, string]>;
  minNights: number;
  maxNights: number | null;
}

export async function getPublicUnitAvailability(
  prisma: PrismaClient,
  slug: string,
  rawFrom?: string,
  rawTo?: string,
): Promise<PublicAvailabilityResult> {
  const unit = await prisma.unit.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true, minNights: true, maxNights: true },
  });

  if (!unit || unit.status !== "ACTIVE") {
    throw new NotFoundError("Unit not found.");
  }

  const today = todayInPropertyTz();
  const defaultFrom = formatDateOnly(today);
  const defaultTo = formatDateOnly(
    new Date(Date.UTC(today.getUTCFullYear() + 1, today.getUTCMonth(), today.getUTCDate())),
  );

  const fromStr = rawFrom || defaultFrom;
  const toStr = rawTo || defaultTo;

  const fromDate = new Date(`${fromStr}T00:00:00.000Z`);
  const toDate = new Date(`${toStr}T00:00:00.000Z`);

  // 1. Blocking reservations in range (CONFIRMED, CHECKED_IN, CHECKED_OUT)
  const reservations = await prisma.reservation.findMany({
    where: {
      unitId: unit.id,
      status: { in: [...BLOCKING_RESERVATION_STATUSES] },
      checkIn: { lt: toDate },
      checkOut: { gt: fromDate },
    },
    select: { checkIn: true, checkOut: true },
    orderBy: { checkIn: "asc" },
  });

  // 2. Unit blocks in range
  const blocks = await prisma.unitBlock.findMany({
    where: {
      unitId: unit.id,
      startDate: { lt: toDate },
      endDate: { gt: fromDate },
    },
    select: { startDate: true, endDate: true },
    orderBy: { startDate: "asc" },
  });

  const blockedRanges: Array<[string, string]> = [];

  for (const r of reservations) {
    blockedRanges.push([formatDateOnly(r.checkIn), formatDateOnly(r.checkOut)]);
  }

  for (const b of blocks) {
    blockedRanges.push([formatDateOnly(b.startDate), formatDateOnly(b.endDate)]);
  }

  // Sort ranges chronologically
  blockedRanges.sort((a, b) => a[0].localeCompare(b[0]));

  return {
    unit: unit.slug,
    blockedRanges,
    minNights: unit.minNights,
    maxNights: unit.maxNights,
  };
}
