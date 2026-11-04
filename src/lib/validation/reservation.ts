import { z } from "zod";
import { DATE_ONLY_REGEX } from "@/lib/dates";

const dateOnlyString = z
  .string()
  .trim()
  .regex(DATE_ONLY_REGEX, "Date must be in YYYY-MM-DD format.");

export const quoteRequestSchema = z
  .object({
    unitSlug: z.string().trim().min(1).max(100),
    checkIn: dateOnlyString,
    checkOut: dateOnlyString,
    adults: z.number().int().min(1).max(30),
    children: z.number().int().min(0).max(30).default(0),
    discountIdr: z.number().int().min(0).max(2_000_000_000).optional(),
  })
  .strict();

export const publicInquirySchema = z
  .object({
    unitSlug: z.string().trim().min(1).max(100),
    checkIn: dateOnlyString,
    checkOut: dateOnlyString,
    adults: z.number().int().min(1).max(30),
    children: z.number().int().min(0).max(30).default(0),
    name: z.string().trim().min(1, "Name is required.").max(120),
    email: z
      .string()
      .trim()
      .email("Invalid email address.")
      .max(254)
      .transform((val) => val.toLowerCase()),
    phone: z.string().trim().max(40).optional().nullable(),
    country: z.string().trim().max(80).optional().nullable(),
    message: z.string().trim().max(2000).optional().nullable(),
    privacyAccepted: z.literal(true, {
      error: "Privacy consent must be accepted.",
    }),
    locale: z.enum(["en", "id"]).default("en"),
    website: z.string().max(500).optional().default(""),
  })
  .strict();

export const staffCreateReservationSchema = z
  .object({
    unitId: z.string().trim().min(1).max(100),
    checkIn: dateOnlyString,
    checkOut: dateOnlyString,
    adults: z.number().int().min(1).max(30),
    children: z.number().int().min(0).max(30).default(0),
    status: z.enum(["PENDING", "CONFIRMED"]).default("CONFIRMED"),
    source: z.enum(["WEBSITE", "ADMIN", "WHATSAPP", "PHONE", "OTHER"]).default("ADMIN"),
    discountIdr: z.number().int().min(0).max(2_000_000_000).default(0),
    locale: z.enum(["en", "id"]).default("en"),
    specialRequests: z.string().trim().max(2000).optional().nullable(),
    internalNotes: z.string().trim().max(2000).optional().nullable(),
    guest: z
      .object({
        fullName: z.string().trim().min(1).max(120),
        email: z
          .string()
          .trim()
          .email()
          .max(254)
          .transform((val) => val.toLowerCase())
          .optional()
          .nullable(),
        phone: z.string().trim().max(40).optional().nullable(),
        country: z.string().trim().max(80).optional().nullable(),
        preferredLocale: z.enum(["en", "id"]).optional().default("en"),
        notes: z.string().trim().max(2000).optional().nullable(),
      })
      .strict(),
  })
  .strict();

export const staffUpdateReservationSchema = z
  .object({
    unitId: z.string().trim().min(1).max(100).optional(),
    checkIn: dateOnlyString.optional(),
    checkOut: dateOnlyString.optional(),
    adults: z.number().int().min(1).max(30).optional(),
    children: z.number().int().min(0).max(30).optional(),
    discountIdr: z.number().int().min(0).max(2_000_000_000).optional(),
    specialRequests: z.string().trim().max(2000).optional().nullable(),
    internalNotes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export const cancelReservationSchema = z
  .object({
    reason: z.string().trim().min(1, "Cancellation reason is required.").max(500),
    expectedVersion: z.number().int().min(1).optional(),
  })
  .strict();

export const confirmReservationBodySchema = z
  .object({
    expectedVersion: z.number().int().min(1).optional(),
  })
  .strict();

export const checkInReservationBodySchema = z
  .object({
    expectedVersion: z.number().int().min(1).optional(),
    overrideEarlyCheckIn: z.boolean().optional(),
  })
  .strict();

export const checkOutReservationBodySchema = z
  .object({
    expectedVersion: z.number().int().min(1).optional(),
  })
  .strict();

export const listReservationsQuerySchema = z
  .object({
    status: z.enum(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"]).optional(),
    paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]).optional(),
    unitId: z.string().trim().min(1).max(100).optional(),
    source: z.enum(["WEBSITE", "ADMIN", "WHATSAPP", "PHONE", "OTHER"]).optional(),
    from: dateOnlyString.optional(),
    to: dateOnlyString.optional(),
    q: z.string().trim().max(120).optional(),
    sortBy: z.enum(["checkIn", "createdAt", "totalIdr", "code"]).default("checkIn"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const createUnitBlockSchema = z
  .object({
    unitId: z.string().trim().min(1).max(100),
    startDate: dateOnlyString,
    endDate: dateOnlyString,
    reason: z.enum(["MAINTENANCE", "OWNER_USE", "OTHER"]).default("MAINTENANCE"),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;
export type PublicInquiryInput = z.infer<typeof publicInquirySchema>;
export type StaffCreateReservationInput = z.infer<typeof staffCreateReservationSchema>;
export type StaffUpdateReservationInput = z.infer<typeof staffUpdateReservationSchema>;
export type CancelReservationInput = z.infer<typeof cancelReservationSchema>;
export type ConfirmReservationBodyInput = z.infer<typeof confirmReservationBodySchema>;
export type CheckInReservationBodyInput = z.infer<typeof checkInReservationBodySchema>;
export type CheckOutReservationBodyInput = z.infer<typeof checkOutReservationBodySchema>;
export type ListReservationsQuery = z.infer<typeof listReservationsQuerySchema>;
export type CreateUnitBlockInput = z.infer<typeof createUnitBlockSchema>;
