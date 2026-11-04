import { z } from "zod";
import { DATE_ONLY_REGEX } from "@/lib/dates";

const dateOnlyString = z
  .string()
  .trim()
  .regex(DATE_ONLY_REGEX, "Date must be in YYYY-MM-DD format.");

export const createUnitSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2, "Slug must be at least 2 characters.")
      .max(100)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must contain only lowercase letters, numbers, and single hyphens.",
      ),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
    nameEn: z.string().trim().min(1, "English name is required.").max(120),
    nameId: z.string().trim().min(1, "Indonesian name is required.").max(120),
    summaryEn: z.string().trim().min(1, "English summary is required.").max(500),
    summaryId: z.string().trim().min(1, "Indonesian summary is required.").max(500),
    descriptionEn: z.string().trim().min(1, "English description is required.").max(5000),
    descriptionId: z.string().trim().min(1, "Indonesian description is required.").max(5000),
    maxGuests: z.number().int().min(1).max(30),
    bedrooms: z.number().int().min(1).max(20),
    bathrooms: z.number().int().min(1).max(20),
    areaSqm: z.number().int().min(1).max(2000).optional().nullable(),
    baseRateIdr: z
      .number()
      .int()
      .positive("Base rate must be greater than zero.")
      .max(2_000_000_000),
    cleaningFeeIdr: z.number().int().min(0).max(100_000_000).default(0),
    minNights: z.number().int().min(1).max(365).default(1),
    maxNights: z.number().int().min(1).max(365).optional().nullable(),
    isFeatured: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(1000).default(0),
  })
  .strict();

export const updateUnitSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    nameEn: z.string().trim().min(1).max(120).optional(),
    nameId: z.string().trim().min(1).max(120).optional(),
    summaryEn: z.string().trim().min(1).max(500).optional(),
    summaryId: z.string().trim().min(1).max(500).optional(),
    descriptionEn: z.string().trim().min(1).max(5000).optional(),
    descriptionId: z.string().trim().min(1).max(5000).optional(),
    maxGuests: z.number().int().min(1).max(30).optional(),
    bedrooms: z.number().int().min(1).max(20).optional(),
    bathrooms: z.number().int().min(1).max(20).optional(),
    areaSqm: z.number().int().min(1).max(2000).optional().nullable(),
    baseRateIdr: z.number().int().positive().max(2_000_000_000).optional(),
    cleaningFeeIdr: z.number().int().min(0).max(100_000_000).optional(),
    minNights: z.number().int().min(1).max(365).optional(),
    maxNights: z.number().int().min(1).max(365).optional().nullable(),
    isFeatured: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })
  .strict();

export const listUnitsQuerySchema = z
  .object({
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    q: z.string().trim().max(100).optional(),
    sortBy: z.enum(["sortOrder", "nameEn", "baseRateIdr", "createdAt"]).default("sortOrder"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
  })
  .strict();

export const setUnitAmenitiesSchema = z
  .object({
    amenityIds: z.array(z.string().trim().min(1).max(100)),
  })
  .strict();

export const createUnitImageSchema = z
  .object({
    path: z.string().trim().min(1, "Image path is required.").max(300),
    altEn: z.string().trim().min(1, "English alt text is required.").max(200),
    altId: z.string().trim().min(1, "Indonesian alt text is required.").max(200),
    isCover: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(100).default(0),
    source: z.string().trim().min(1, "Asset source is required (CONTENT_GUIDE §8).").max(200),
    license: z.string().trim().min(1, "Asset license is required (CONTENT_GUIDE §8).").max(100),
    credit: z.string().trim().max(200).optional().nullable(),
  })
  .strict();

export const updateUnitImageSchema = z
  .object({
    altEn: z.string().trim().min(1).max(200).optional(),
    altId: z.string().trim().min(1).max(200).optional(),
    isCover: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(100).optional(),
    source: z.string().trim().min(1).max(200).optional(),
    license: z.string().trim().min(1).max(100).optional(),
    credit: z.string().trim().max(200).optional().nullable(),
  })
  .strict();

export const calendarQuerySchema = z
  .object({
    from: dateOnlyString,
    to: dateOnlyString,
    unitIds: z.string().trim().optional(),
  })
  .strict();

export const createRateRuleSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required.").max(100),
    startDate: dateOnlyString,
    endDate: dateOnlyString,
    nightlyRateIdr: z
      .number()
      .int()
      .positive("Nightly rate must be greater than zero.")
      .max(2_000_000_000),
    minNights: z.number().int().min(1).max(365).optional().nullable(),
  })
  .strict()
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date.",
    path: ["endDate"],
  });

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type ListUnitsQuery = z.infer<typeof listUnitsQuerySchema>;
export type SetUnitAmenitiesInput = z.infer<typeof setUnitAmenitiesSchema>;
export type CreateUnitImageInput = z.infer<typeof createUnitImageSchema>;
export type UpdateUnitImageInput = z.infer<typeof updateUnitImageSchema>;
export type CalendarQueryInput = z.infer<typeof calendarQuerySchema>;
export type CreateRateRuleInput = z.infer<typeof createRateRuleSchema>;
