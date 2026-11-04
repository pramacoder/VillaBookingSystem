import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requirePageRole } from "@/server/auth/require-role";
import { getReservationDetail } from "@/server/services/reservation-service";
import { NotFoundError } from "@/lib/errors";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { getMessages } from "@/lib/i18n/messages";
import {
  ReservationDetailClient,
  type SerializedReservationDetail,
} from "@/components/admin/reservation-detail-client";

interface ReservationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminReservationDetailPage({ params }: ReservationDetailPageProps) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const locale = await getAdminLocale();
  const messages = getMessages(locale);
  const { id } = await params;

  let detail;
  try {
    detail = await getReservationDetail(db, id);
  } catch (err) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }

  const units = await db.unit.findMany({
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameId: true,
      baseRateIdr: true,
      cleaningFeeIdr: true,
      maxGuests: true,
      minNights: true,
      maxNights: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  const serialized: SerializedReservationDetail = {
    id: detail.id,
    code: detail.code,
    status: detail.status,
    paymentStatus: detail.paymentStatus,
    source: detail.source,
    checkIn: detail.checkIn,
    checkOut: detail.checkOut,
    nights: detail.nights,
    adults: detail.adults,
    children: detail.children,
    nightlySubtotalIdr: detail.nightlySubtotalIdr,
    cleaningFeeIdr: detail.cleaningFeeIdr,
    discountIdr: detail.discountIdr,
    totalIdr: detail.totalIdr,
    netPaidIdr: detail.netPaidIdr,
    balanceDueIdr: detail.balanceDueIdr,
    overpaidIdr: detail.overpaidIdr,
    refundPending: detail.refundPending,
    locale: detail.locale,
    specialRequests: detail.specialRequests,
    internalNotes: detail.internalNotes,
    cancelReason: detail.cancelReason,
    version: detail.version,
    createdAt: detail.createdAt,
    allowedNextStatuses: detail.allowedNextStatuses,
    unit: detail.unit,
    guest: detail.guest,
    payments: detail.payments.map((pay) => ({
      id: pay.id,
      kind: pay.kind,
      amountIdr: pay.amountIdr,
      method: pay.method,
      paidAt: pay.paidAt.toISOString(),
      reference: pay.reference,
      note: pay.note,
      voidedAt: pay.voidedAt ? pay.voidedAt.toISOString() : null,
      voidReason: pay.voidReason,
      recordedBy: pay.recordedBy,
    })),
    auditLogs: detail.auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
      actor: log.actor,
    })),
  };

  return (
    <ReservationDetailClient
      locale={locale}
      messages={messages}
      reservation={serialized}
      units={units}
    />
  );
}
