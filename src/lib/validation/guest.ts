import { z } from "zod";

export const createGuestSchema = z
  .object({
    fullName: z.string().trim().min(1, "Guest full name is required.").max(120),
    email: z
      .string()
      .trim()
      .email("Invalid email address.")
      .max(254)
      .transform((val) => val.toLowerCase())
      .optional()
      .nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
    country: z.string().trim().max(80).optional().nullable(),
    preferredLocale: z.enum(["en", "id"]).default("en"),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export const updateGuestSchema = z
  .object({
    fullName: z.string().trim().min(1, "Guest full name is required.").max(120).optional(),
    email: z
      .union([
        z
          .string()
          .trim()
          .email("Invalid email address.")
          .max(254)
          .transform((val) => val.toLowerCase()),
        z.literal("").transform(() => null),
        z.null(),
      ])
      .optional(),
    phone: z
      .union([z.string().trim().max(40), z.literal("").transform(() => null), z.null()])
      .optional(),
    country: z
      .union([z.string().trim().max(80), z.literal("").transform(() => null), z.null()])
      .optional(),
    preferredLocale: z.enum(["en", "id"]).optional(),
    notes: z
      .union([z.string().trim().max(2000), z.literal("").transform(() => null), z.null()])
      .optional(),
  })
  .strict();

export const listGuestsQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    sortBy: z.enum(["fullName", "createdAt"]).default("createdAt"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
export type ListGuestsQuery = z.infer<typeof listGuestsQuerySchema>;
