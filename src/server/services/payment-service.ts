import type { Payment, PaymentStatus, PrismaClient, UserRole } from "@prisma/client";
import { formatDateOnly, todayInPropertyTz } from "@/lib/dates";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { computeNetPaidIdr, computeOverpaidIdr, derivePaymentStatus } from "@/lib/payments";
import { recordPaymentSchema, voidPaymentSchema } from "@/lib/validation/payment";
import { writeAuditLog } from "@/server/services/audit-service";

export interface PaymentMutationResult {
  payment: Payment;
  reservationId: string;
  netPaidIdr: number;
  paymentStatus: PaymentStatus;
  overpaidIdr: number;
  version: number;
}

/**
 * Records a payment or refund inside a single transaction (DATABASE.md §5.2, BR-09, TC-Y01..TC-Y08, TC-C04):
 * 1. Lock the `Reservation` row (`FOR UPDATE`).
 * 2. Insert `Payment`.
 * 3. Recompute `netPaidIdr`, `paymentStatus`, and `overpaidIdr` from all non-voided payments.
 * 4. Update `Reservation` (`netPaidIdr`, `paymentStatus`, `version + 1`) and write `AuditLog`.
 */
export async function recordPayment(
  prisma: PrismaClient,
  params: {
    reservationId: string;
    rawInput: unknown;
    actorId: string;
    now?: Date;
  },
): Promise<PaymentMutationResult> {
  const now = params.now ?? new Date();
  const input = recordPaymentSchema.parse(params.rawInput);
  const paidAt =
    input.paidAt instanceof Date ? input.paidAt : input.paidAt ? new Date(input.paidAt) : now;

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Reservation" WHERE id = ${params.reservationId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new NotFoundError("Reservation not found.");
    }

    const reservation = await tx.reservation.findUniqueOrThrow({
      where: { id: params.reservationId },
      select: {
        id: true,
        code: true,
        totalIdr: true,
        version: true,
      },
    });

    const createdPayment = await tx.payment.create({
      data: {
        reservationId: reservation.id,
        kind: input.kind,
        amountIdr: input.amountIdr,
        method: input.method,
        paidAt,
        reference: input.reference ?? null,
        note: input.note ?? null,
        recordedById: params.actorId,
      },
    });

    const allPayments = await tx.payment.findMany({
      where: { reservationId: reservation.id },
      select: {
        kind: true,
        amountIdr: true,
        voidedAt: true,
      },
    });

    const netPaidIdr = computeNetPaidIdr(allPayments);
    const paymentStatus = derivePaymentStatus(reservation.totalIdr, netPaidIdr);
    const overpaidIdr = computeOverpaidIdr(reservation.totalIdr, netPaidIdr);

    const updatedReservation = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        netPaidIdr,
        paymentStatus,
        version: { increment: 1 },
      },
      select: { version: true },
    });

    await writeAuditLog(tx, {
      actorId: params.actorId,
      action: input.kind === "REFUND" ? "payment.refund" : "payment.record",
      entityType: "Payment",
      entityId: createdPayment.id,
      metadata: {
        reservationId: reservation.id,
        reservationCode: reservation.code,
        kind: createdPayment.kind,
        amountIdr: createdPayment.amountIdr,
        method: createdPayment.method,
        netPaidIdr,
        paymentStatus,
        overpaidIdr,
      },
    });

    return {
      payment: createdPayment,
      reservationId: reservation.id,
      netPaidIdr,
      paymentStatus,
      overpaidIdr,
      version: updatedReservation.version,
    };
  });
}

/**
 * Voids a payment with a required reason inside a single transaction (DATABASE.md §5.2, BR-10, TC-Y02, TC-Y08):
 * - Payments are never deleted.
 * - ADMIN may void any payment; STAFF may void only same-day payments (recorded on the same Asia/Makassar day).
 * - Locks the parent `Reservation`, sets `voidedAt`/`voidReason`/`voidedById`, recomputes `netPaidIdr` and `paymentStatus`,
 *   bumps `Reservation.version`, and writes `AuditLog`.
 */
export async function voidPayment(
  prisma: PrismaClient,
  params: {
    paymentId: string;
    rawInput: unknown;
    actorId: string;
    actorRole: UserRole;
    now?: Date;
  },
): Promise<PaymentMutationResult> {
  const now = params.now ?? new Date();
  const input = voidPaymentSchema.parse(params.rawInput);

  return prisma.$transaction(async (tx) => {
    const initialPayment = await tx.payment.findUnique({
      where: { id: params.paymentId },
      select: { id: true, reservationId: true },
    });

    if (!initialPayment) {
      throw new NotFoundError("Payment not found.");
    }

    // Lock parent reservation row first (DATABASE.md §5.2)
    await tx.$queryRaw`
      SELECT id FROM "Reservation" WHERE id = ${initialPayment.reservationId} FOR UPDATE
    `;

    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: params.paymentId },
    });

    if (payment.voidedAt !== null) {
      throw new AppError("BUSINESS_RULE", 422, "Payment has already been voided.");
    }

    if (params.actorRole === "STAFF") {
      const recordedDay = formatDateOnly(todayInPropertyTz(payment.createdAt));
      const currentDay = formatDateOnly(todayInPropertyTz(now));
      if (recordedDay !== currentDay) {
        throw new ForbiddenError("STAFF may only void payments recorded on the same day.");
      }
    }

    const reservation = await tx.reservation.findUniqueOrThrow({
      where: { id: payment.reservationId },
      select: {
        id: true,
        code: true,
        totalIdr: true,
      },
    });

    const voidedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        voidedAt: now,
        voidReason: input.reason,
        voidedById: params.actorId,
      },
    });

    const allPayments = await tx.payment.findMany({
      where: { reservationId: reservation.id },
      select: {
        kind: true,
        amountIdr: true,
        voidedAt: true,
      },
    });

    const netPaidIdr = computeNetPaidIdr(allPayments);
    const paymentStatus = derivePaymentStatus(reservation.totalIdr, netPaidIdr);
    const overpaidIdr = computeOverpaidIdr(reservation.totalIdr, netPaidIdr);

    const updatedReservation = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        netPaidIdr,
        paymentStatus,
        version: { increment: 1 },
      },
      select: { version: true },
    });

    await writeAuditLog(tx, {
      actorId: params.actorId,
      action: "payment.void",
      entityType: "Payment",
      entityId: voidedPayment.id,
      metadata: {
        reservationId: reservation.id,
        reservationCode: reservation.code,
        reason: input.reason,
        amountIdr: voidedPayment.amountIdr,
        kind: voidedPayment.kind,
        netPaidIdr,
        paymentStatus,
        overpaidIdr,
      },
    });

    return {
      payment: voidedPayment,
      reservationId: reservation.id,
      netPaidIdr,
      paymentStatus,
      overpaidIdr,
      version: updatedReservation.version,
    };
  });
}
