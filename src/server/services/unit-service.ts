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
