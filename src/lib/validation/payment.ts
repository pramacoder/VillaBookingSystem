import { z } from "zod";

export const recordPaymentSchema = z
  .object({
    kind: z.enum(["PAYMENT", "REFUND"]).default("PAYMENT"),
    amountIdr: z
      .number()
      .int("Payment amount must be a whole IDR integer.")
      .positive("Payment amount must be greater than zero.")
      .max(2_000_000_000, "Payment amount exceeds maximum single entry limit."),
    method: z.enum(["BANK_TRANSFER", "CASH", "QRIS", "CARD_EXTERNAL", "OTHER"]),
    paidAt: z.union([z.string().datetime({ offset: true }), z.date()]).optional(),
    reference: z.string().trim().max(120).optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export const voidPaymentSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Void reason is required.")
      .max(500, "Void reason cannot exceed 500 characters."),
  })
  .strict();

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;
