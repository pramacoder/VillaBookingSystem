import type { PaymentKind, PaymentStatus } from "@prisma/client";

export interface PaymentEntryLike {
  kind: PaymentKind;
  amountIdr: number;
  voidedAt?: Date | null;
}

/**
 * Derives reservation payment status from totalIdr and netPaidIdr (BR-09, DATABASE.md §5.3).
 */
export function derivePaymentStatus(totalIdr: number, netPaidIdr: number): PaymentStatus {
  if (totalIdr === 0) return "PAID"; // complimentary stay
  if (netPaidIdr <= 0) return "UNPAID";
  return netPaidIdr >= totalIdr ? "PAID" : "PARTIAL";
}

/**
 * Computes netPaidIdr = Σ(PAYMENT, not voided) − Σ(REFUND, not voided) (BR-09, DATABASE.md §5.3).
 */
export function computeNetPaidIdr(payments: readonly PaymentEntryLike[]): number {
  let net = 0;
  for (const payment of payments) {
    if (payment.voidedAt) continue;
    if (payment.kind === "PAYMENT") {
      net += payment.amountIdr;
    } else if (payment.kind === "REFUND") {
      net -= payment.amountIdr;
    }
  }
  return net;
}

/**
 * Computes the overpaid amount in IDR (0 if not overpaid) (DATABASE.md §5.3–5.4).
 */
export function computeOverpaidIdr(totalIdr: number, netPaidIdr: number): number {
  return netPaidIdr > totalIdr ? netPaidIdr - totalIdr : 0;
}
