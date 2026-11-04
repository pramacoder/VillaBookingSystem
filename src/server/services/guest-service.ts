import type { Guest, PaymentStatus, Prisma, PrismaClient, ReservationStatus } from "@prisma/client";
import { formatDateOnly } from "@/lib/dates";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  createGuestSchema,
  listGuestsQuerySchema,
  updateGuestSchema,
} from "@/lib/validation/guest";
import { type DbOrTx, writeAuditLog } from "@/server/services/audit-service";

export function normalizeGuestEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeGuestPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length < 5) return null;
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

export interface UpsertGuestInput {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  preferredLocale?: string;
  notes?: string | null;
}

/**
 * Matches or creates a Guest record per BR-15 (TC-G01..TC-G03):
 * 1. Match by `emailNormalized` first (case/whitespace insensitive).
 * 2. If no email is provided, match by `phoneNormalized`.
 * 3. If both email and phone are provided and email did not match:
 *    - If an existing guest with the same `phoneNormalized` has `emailNormalized = null`, enrich and reuse that guest.
 *    - If the existing guest with the same phone already has a different email, create a distinct Guest record
 *      so family/assistant shared phone numbers never overwrite another guest's identity.
 */
export async function findOrCreateGuest(tx: DbOrTx, input: UpsertGuestInput): Promise<Guest> {
  const fullName = input.fullName.trim();
  if (!fullName) {
    throw new ValidationError("Guest fullName is required.", {
      fullName: "required",
    });
  }

  const normalizedEmail = normalizeGuestEmail(input.email);
  const normalizedPhone = normalizeGuestPhone(input.phone);
  const rawEmailTrimmed = input.email?.trim() || null;
  const rawPhoneTrimmed = input.phone?.trim() || null;

  // 1. Match by normalized email first (TC-G01)
  if (normalizedEmail) {
    const byEmail = await tx.guest.findFirst({
      where: {
        OR: [
          { emailNormalized: normalizedEmail },
          { email: { equals: normalizedEmail, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    if (byEmail) {
      const needsUpdate =
        byEmail.emailNormalized !== normalizedEmail ||
        (!byEmail.phoneNormalized && normalizedPhone !== null) ||
        (!byEmail.country && Boolean(input.country));

      if (needsUpdate) {
        return tx.guest.update({
          where: { id: byEmail.id },
          data: {
            email: byEmail.email ?? rawEmailTrimmed ?? normalizedEmail,
            emailNormalized: normalizedEmail,
            phone: byEmail.phone ?? rawPhoneTrimmed,
            phoneNormalized: byEmail.phoneNormalized ?? normalizedPhone,
            country: byEmail.country ?? input.country?.trim() ?? null,
          },
        });
      }
      return byEmail;
    }
  }

  // 2. Match by normalized phone (TC-G02, TC-G03)
  if (normalizedPhone) {
    const byPhone = await tx.guest.findFirst({
      where: { phoneNormalized: normalizedPhone },
      orderBy: { createdAt: "asc" },
    });

    if (byPhone) {
      if (!normalizedEmail) {
        // TC-G02: Phone-only guest reuses existing record with same phone
        return byPhone;
      }

      if (!byPhone.emailNormalized) {
        // Phone-only record now has an email -> attach email and reuse
        return tx.guest.update({
          where: { id: byPhone.id },
          data: {
            email: rawEmailTrimmed ?? normalizedEmail,
            emailNormalized: normalizedEmail,
            country: byPhone.country ?? input.country?.trim() ?? null,
          },
        });
      }
      // TC-G03: Existing record has a different email -> create a separate guest record below
    }
  }

  return tx.guest.create({
    data: {
      fullName,
      email: rawEmailTrimmed,
      emailNormalized: normalizedEmail,
      phone: rawPhoneTrimmed,
      phoneNormalized: normalizedPhone,
      country: input.country?.trim() || null,
      preferredLocale: input.preferredLocale === "id" ? "id" : "en",
      notes: input.notes?.trim() || null,
    },
  });
}

/**
 * Anonymizes guest personal data while keeping all Reservation and Payment records intact
 * (DATABASE.md §11, TC-G04).
 */
export async function anonymizeGuest(
  prisma: PrismaClient,
  params: {
    guestId: string;
    actorId: string;
  },
): Promise<Guest> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.guest.findUnique({
      where: { id: params.guestId },
    });

    if (!existing) {
      throw new NotFoundError("Guest not found.");
    }

    const updated = await tx.guest.update({
      where: { id: params.guestId },
      data: {
        fullName: "Anonymized Guest",
        email: null,
        emailNormalized: null,
        phone: null,
        phoneNormalized: null,
        country: null,
        notes: null,
      },
    });

    await writeAuditLog(tx, {
      actorId: params.actorId,
      action: "guest.anonymize",
      entityType: "Guest",
      entityId: updated.id,
      metadata: {
        anonymized: true,
      },
    });

    return updated;
  });
}

export interface GuestListItem {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  preferredLocale: string;
  notes: string | null;
  totalStays: number;
  totalBookedIdr: number;
  totalPaidIdr: number;
  createdAt: string;
}

export interface GuestListResult {
  items: GuestListItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

/**
 * Lists guests with search, sorting, pagination, and aggregated stay counts/totals
 * (FR-16, API.md §5.4).
 */
export async function listGuests(
  prisma: PrismaClient,
  rawQuery: unknown,
): Promise<GuestListResult> {
  const query = listGuestsQuerySchema.parse(rawQuery ?? {});

  const where: Prisma.GuestWhereInput =
    query.q && query.q.length > 0
      ? {
          OR: [
            { fullName: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
            { phone: { contains: query.q, mode: "insensitive" } },
            { country: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {};

  const orderBy: Prisma.GuestOrderByWithRelationInput[] = [
    { [query.sortBy]: query.sortDir },
    { id: "asc" },
  ];

  const skip = (query.page - 1) * query.pageSize;

  const [total, rows] = await Promise.all([
    prisma.guest.count({ where }),
    prisma.guest.findMany({
      where,
      orderBy,
      skip,
      take: query.pageSize,
      include: {
        reservations: {
          select: {
            status: true,
            totalIdr: true,
            netPaidIdr: true,
          },
        },
      },
    }),
  ]);

  const items: GuestListItem[] = rows.map((row) => {
    const activeStays = row.reservations.filter((r) => r.status !== "CANCELLED");
    const totalBookedIdr = activeStays.reduce((sum, r) => sum + r.totalIdr, 0);
    const totalPaidIdr = row.reservations.reduce((sum, r) => sum + r.netPaidIdr, 0);

    return {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      country: row.country,
      preferredLocale: row.preferredLocale,
      notes: row.notes,
      totalStays: row.reservations.length,
      totalBookedIdr,
      totalPaidIdr,
      createdAt: row.createdAt.toISOString(),
    };
  });

  return {
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
    },
  };
}

export interface GuestStayHistoryItem {
  id: string;
  code: string;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  totalIdr: number;
  netPaidIdr: number;
  unit: {
    id: string;
    slug: string;
    nameEn: string;
    nameId: string;
  };
}

export interface GuestDetailResult {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  preferredLocale: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalStays: number;
    completedStays: number;
    totalBookedIdr: number;
    totalPaidIdr: number;
  };
  reservations: GuestStayHistoryItem[];
}

/**
 * Retrieves a guest record with full stay history and lifetime totals (FR-16, API.md §5.4).
 */
export async function getGuestDetail(
  prisma: PrismaClient,
  guestId: string,
): Promise<GuestDetailResult> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: {
      reservations: {
        include: {
          unit: {
            select: {
              id: true,
              slug: true,
              nameEn: true,
              nameId: true,
            },
          },
        },
        orderBy: { checkIn: "desc" },
      },
    },
  });

  if (!guest) {
    throw new NotFoundError("Guest not found.");
  }

  const reservations: GuestStayHistoryItem[] = guest.reservations.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    paymentStatus: r.paymentStatus,
    checkIn: formatDateOnly(r.checkIn),
    checkOut: formatDateOnly(r.checkOut),
    nights: r.nights,
    adults: r.adults,
    children: r.children,
    totalIdr: r.totalIdr,
    netPaidIdr: r.netPaidIdr,
    unit: r.unit,
  }));

  const nonCancelled = reservations.filter((r) => r.status !== "CANCELLED");
  const completedStays = reservations.filter((r) => r.status === "CHECKED_OUT").length;
  const totalBookedIdr = nonCancelled.reduce((sum, r) => sum + r.totalIdr, 0);
  const totalPaidIdr = reservations.reduce((sum, r) => sum + r.netPaidIdr, 0);

  return {
    id: guest.id,
    fullName: guest.fullName,
    email: guest.email,
    phone: guest.phone,
    country: guest.country,
    preferredLocale: guest.preferredLocale,
    notes: guest.notes,
    createdAt: guest.createdAt.toISOString(),
    updatedAt: guest.updatedAt.toISOString(),
    stats: {
      totalStays: reservations.length,
      completedStays,
      totalBookedIdr,
      totalPaidIdr,
    },
    reservations,
  };
}

/**
 * Staff guest creation (or deduplicated match) inside a single transaction with AuditLog (FR-16, BR-15).
 */
export async function createGuest(
  prisma: PrismaClient,
  params: {
    rawInput: unknown;
    actorId: string;
  },
): Promise<Guest> {
  const input = createGuestSchema.parse(params.rawInput);

  return prisma.$transaction(async (tx) => {
    const guest = await findOrCreateGuest(tx, input);

    await writeAuditLog(tx, {
      actorId: params.actorId,
      action: "guest.create",
      entityType: "Guest",
      entityId: guest.id,
      metadata: {
        preferredLocale: guest.preferredLocale,
      },
    });

    return guest;
  });
}

/**
 * Updates a guest's contact information and notes inside a single transaction with AuditLog (FR-16).
 */
export async function updateGuest(
  prisma: PrismaClient,
  params: {
    guestId: string;
    rawInput: unknown;
    actorId: string;
  },
): Promise<Guest> {
  const patch = updateGuestSchema.parse(params.rawInput);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.guest.findUnique({
      where: { id: params.guestId },
    });

    if (!existing) {
      throw new NotFoundError("Guest not found.");
    }

    const nextEmail = patch.email !== undefined ? patch.email : existing.email;
    const nextPhone = patch.phone !== undefined ? patch.phone : existing.phone;

    const updated = await tx.guest.update({
      where: { id: existing.id },
      data: {
        ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
        ...(patch.email !== undefined
          ? {
              email: nextEmail,
              emailNormalized: normalizeGuestEmail(nextEmail),
            }
          : {}),
        ...(patch.phone !== undefined
          ? {
              phone: nextPhone,
              phoneNormalized: normalizeGuestPhone(nextPhone),
            }
          : {}),
        ...(patch.country !== undefined ? { country: patch.country } : {}),
        ...(patch.preferredLocale !== undefined ? { preferredLocale: patch.preferredLocale } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      },
    });

    await writeAuditLog(tx, {
      actorId: params.actorId,
      action: "guest.update",
      entityType: "Guest",
      entityId: updated.id,
      metadata: {
        updatedFields: Object.keys(patch),
      },
    });

    return updated;
  });
}
