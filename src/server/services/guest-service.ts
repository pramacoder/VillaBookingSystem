import type { Guest, PrismaClient } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
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
