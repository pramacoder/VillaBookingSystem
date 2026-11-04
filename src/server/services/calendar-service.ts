import type { PaymentStatus, PrismaClient, ReservationStatus } from "@prisma/client";
import { diffNights, formatDateOnly, parseDateOnly } from "@/lib/dates";
import { ValidationError } from "@/lib/errors";
import { calendarQuerySchema } from "@/lib/validation/unit";
import { BLOCKING_RESERVATION_STATUSES } from "@/server/services/availability-service";

export interface CalendarReservationItem {
  id: string;
  code: string;
  guestName: string;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}

export interface CalendarBlockItem {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  note: string | null;
}

export interface CalendarUnitItem {
  id: string;
  slug: string;
  nameEn: string;
  nameId: string;
  baseRateIdr: number;
  maxGuests: number;
  status: string;
  reservations: CalendarReservationItem[];
  blocks: CalendarBlockItem[];
}

export interface CalendarResult {
  from: string;
  to: string;
  daysCount: number;
  units: CalendarUnitItem[];
}

/**
 * Single-query calendar resource timeline per API.md §5.3 & NFR-02:
 * Window limited to maximum 62 days.
 * Returns active villa units with their reservations and maintenance blocks.
 */
export async function getAdminCalendar(
  prisma: PrismaClient,
  rawQuery: unknown,
): Promise<CalendarResult> {
  const query = calendarQuerySchema.parse(rawQuery);
  const fromDate = parseDateOnly(query.from);
  const toDate = parseDateOnly(query.to);
  const daysCount = diffNights(fromDate, toDate);

  if (daysCount < 1) {
    throw new ValidationError("'to' date must be after 'from' date.", {
      to: "to_must_be_after_from",
    });
  }

  if (daysCount > 62) {
    throw new ValidationError("Calendar query window cannot exceed 62 days (API.md §5.3).", {
      range: "window_exceeds_62_days",
    });
  }

  const unitIdFilter = query.unitIds
    ? query.unitIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : undefined;

  const units = await prisma.unit.findMany({
    where: {
      status: { in: ["ACTIVE", "DRAFT"] },
      ...(unitIdFilter && unitIdFilter.length > 0 ? { id: { in: unitIdFilter } } : {}),
    },
    orderBy: { sortOrder: "asc" },
    include: {
      reservations: {
        where: {
          status: { in: [...BLOCKING_RESERVATION_STATUSES, "PENDING"] },
          checkIn: { lt: toDate },
          checkOut: { gt: fromDate },
        },
        select: {
          id: true,
          code: true,
          status: true,
          paymentStatus: true,
          checkIn: true,
          checkOut: true,
          adults: true,
          children: true,
          guest: {
            select: { fullName: true },
          },
        },
        orderBy: { checkIn: "asc" },
      },
      blocks: {
        where: {
          startDate: { lt: toDate },
          endDate: { gt: fromDate },
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          reason: true,
          note: true,
        },
        orderBy: { startDate: "asc" },
      },
    },
  });

  const formattedUnits: CalendarUnitItem[] = units.map((u) => ({
    id: u.id,
    slug: u.slug,
    nameEn: u.nameEn,
    nameId: u.nameId,
    baseRateIdr: u.baseRateIdr,
    maxGuests: u.maxGuests,
    status: u.status,
    reservations: u.reservations.map((r) => ({
      id: r.id,
      code: r.code,
      guestName: r.guest.fullName,
      status: r.status,
      paymentStatus: r.paymentStatus,
      checkIn: formatDateOnly(r.checkIn),
      checkOut: formatDateOnly(r.checkOut),
      adults: r.adults,
      children: r.children,
    })),
    blocks: u.blocks.map((b) => ({
      id: b.id,
      startDate: formatDateOnly(b.startDate),
      endDate: formatDateOnly(b.endDate),
      reason: b.reason,
      note: b.note,
    })),
  }));

  return {
    from: formatDateOnly(fromDate),
    to: formatDateOnly(toDate),
    daysCount,
    units: formattedUnits,
  };
}
