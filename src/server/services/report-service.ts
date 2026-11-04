import type { PaymentMethod, PaymentStatus, PrismaClient, ReservationStatus } from "@prisma/client";
import { addDays, diffNights, formatDateOnly, parseDateOnly, todayInPropertyTz } from "@/lib/dates";
import { ValidationError } from "@/lib/errors";
import { BLOCKING_RESERVATION_STATUSES } from "./availability-service";

// ==========================================
// 1. DASHBOARD METRICS (FR-12)
// ==========================================

export interface DashboardMetrics {
  todayDate: string;
  arrivalsToday: number;
  departuresToday: number;
  inHouseCount: number;
  pendingCount: number;
  outstandingBalanceIdr: number;
  occupancy30dPercent: number;
  activeUnitsCount: number;
}

export async function getDashboardMetrics(
  prisma: PrismaClient,
  referenceDate: Date = new Date(),
): Promise<DashboardMetrics> {
  const today = todayInPropertyTz(referenceDate);
  const todayDateStr = formatDateOnly(today);

  // 1. Arrivals today (checkIn === today and status in CONFIRMED, CHECKED_IN)
  const arrivalsTodayPromise = prisma.reservation.count({
    where: {
      checkIn: today,
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
    },
  });

  // 2. Departures today (checkOut === today and status in CHECKED_IN, CHECKED_OUT)
  const departuresTodayPromise = prisma.reservation.count({
    where: {
      checkOut: today,
      status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
    },
  });

  // 3. In-house guests (currently CHECKED_IN)
  const inHousePromise = prisma.reservation.count({
    where: {
      status: "CHECKED_IN",
    },
  });

  // 4. Pending requests
  const pendingPromise = prisma.reservation.count({
    where: {
      status: "PENDING",
    },
  });

  // 5. Active units
  const activeUnitsPromise = prisma.unit.count({
    where: {
      status: "ACTIVE",
    },
  });

  // 6. Outstanding balances: sum(max(0, totalIdr - netPaidIdr)) for CONFIRMED, CHECKED_IN, CHECKED_OUT
  const outstandingReservationsPromise = prisma.reservation.findMany({
    where: {
      status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
    },
    select: {
      totalIdr: true,
      netPaidIdr: true,
    },
  });

  // 7. 30-day occupancy: window [today, today + 30 days)
  const windowEnd = addDays(today, 30);
  const occupancyReportPromise = getOccupancyReport(prisma, {
    from: todayDateStr,
    to: formatDateOnly(windowEnd),
  });

  const [
    arrivalsToday,
    departuresToday,
    inHouseCount,
    pendingCount,
    activeUnitsCount,
    outstandingReservations,
    occupancyReport,
  ] = await Promise.all([
    arrivalsTodayPromise,
    departuresTodayPromise,
    inHousePromise,
    pendingPromise,
    activeUnitsPromise,
    outstandingReservationsPromise,
    occupancyReportPromise,
  ]);

  const outstandingBalanceIdr = outstandingReservations.reduce(
    (sum, r) => sum + Math.max(0, r.totalIdr - r.netPaidIdr),
    0,
  );

  return {
    todayDate: todayDateStr,
    arrivalsToday,
    departuresToday,
    inHouseCount,
    pendingCount,
    outstandingBalanceIdr,
    occupancy30dPercent: Math.round(occupancyReport.totals.overallOccupancyPercent),
    activeUnitsCount,
  };
}

// ==========================================
// 2. R1: RESERVATIONS REPORT (FR-18)
// ==========================================

export interface ReservationsReportQuery {
  from?: string;
  to?: string;
  unitId?: string;
  status?: ReservationStatus;
  paymentStatus?: PaymentStatus;
}

export interface ReservationReportItem {
  id: string;
  code: string;
  guestName: string;
  guestEmail: string | null;
  unitId: string;
  unitSlug: string;
  unitNameEn: string;
  unitNameId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  totalIdr: number;
  netPaidIdr: number;
  createdAt: string;
}

export interface ReservationsReportResult {
  filters: {
    from: string;
    to: string;
    unitId?: string;
    status?: ReservationStatus;
    paymentStatus?: PaymentStatus;
  };
  totals: {
    totalCount: number;
    bookedValueIdr: number;
    totalPaidIdr: number;
    totalNights: number;
    totalGuests: number;
  };
  reservations: ReservationReportItem[];
}

export async function getReservationsReport(
  prisma: PrismaClient,
  rawQuery: ReservationsReportQuery = {},
): Promise<ReservationsReportResult> {
  const today = todayInPropertyTz();
  // Default range: 1st of current month to end of current month
  const defaultFrom = formatDateOnly(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
  );
  const defaultTo = formatDateOnly(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)),
  );

  const fromStr = rawQuery.from || defaultFrom;
  const toStr = rawQuery.to || defaultTo;

  const fromDate = parseDateOnly(fromStr);
  const toDate = parseDateOnly(toStr);

  if (toDate < fromDate) {
    throw new ValidationError("'to' date must be on or after 'from' date.");
  }

  const where = {
    checkIn: {
      gte: fromDate,
      lte: toDate,
    },
    ...(rawQuery.unitId ? { unitId: rawQuery.unitId } : {}),
    ...(rawQuery.status ? { status: rawQuery.status } : {}),
    ...(rawQuery.paymentStatus ? { paymentStatus: rawQuery.paymentStatus } : {}),
  };

  const rows = await prisma.reservation.findMany({
    where,
    orderBy: [{ checkIn: "asc" }, { createdAt: "asc" }],
    include: {
      guest: { select: { fullName: true, email: true } },
      unit: { select: { slug: true, nameEn: true, nameId: true } },
    },
  });

  let bookedValueIdr = 0;
  let totalPaidIdr = 0;
  let totalNights = 0;
  let totalGuests = 0;

  const items: ReservationReportItem[] = rows.map((r) => {
    // Booked value excludes CANCELLED reservations
    if (r.status !== "CANCELLED") {
      bookedValueIdr += r.totalIdr;
    }
    totalPaidIdr += r.netPaidIdr;
    totalNights += r.nights;
    totalGuests += r.adults + r.children;

    return {
      id: r.id,
      code: r.code,
      guestName: r.guest.fullName,
      guestEmail: r.guest.email,
      unitId: r.unitId,
      unitSlug: r.unit.slug,
      unitNameEn: r.unit.nameEn,
      unitNameId: r.unit.nameId,
      checkIn: formatDateOnly(r.checkIn),
      checkOut: formatDateOnly(r.checkOut),
      nights: r.nights,
      adults: r.adults,
      children: r.children,
      status: r.status,
      paymentStatus: r.paymentStatus,
      totalIdr: r.totalIdr,
      netPaidIdr: r.netPaidIdr,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return {
    filters: {
      from: fromStr,
      to: toStr,
      unitId: rawQuery.unitId,
      status: rawQuery.status,
      paymentStatus: rawQuery.paymentStatus,
    },
    totals: {
      totalCount: items.length,
      bookedValueIdr,
      totalPaidIdr,
      totalNights,
      totalGuests,
    },
    reservations: items,
  };
}

// ==========================================
// 3. R2: PAYMENTS & BALANCES REPORT (FR-18)
// ==========================================

export interface PaymentsReportQuery {
  from?: string;
  to?: string;
}

export interface PaymentByMethodSummary {
  method: PaymentMethod;
  paymentsCount: number;
  refundsCount: number;
  paymentsIdr: number;
  refundsIdr: number;
  netIdr: number;
}

export interface OutstandingBalanceItem {
  reservationId: string;
  code: string;
  guestName: string;
  unitNameEn: string;
  unitNameId: string;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  totalIdr: number;
  netPaidIdr: number;
  outstandingIdr: number;
}

export interface PaymentsReportResult {
  filters: {
    from: string;
    to: string;
  };
  totals: {
    cashReceivedIdr: number;
    totalPaymentsCount: number;
    totalRefundsCount: number;
    grossPaymentsIdr: number;
    grossRefundsIdr: number;
    totalOutstandingBalanceIdr: number;
  };
  byMethod: PaymentByMethodSummary[];
  outstandingBalances: OutstandingBalanceItem[];
}

export async function getPaymentsReport(
  prisma: PrismaClient,
  rawQuery: PaymentsReportQuery = {},
): Promise<PaymentsReportResult> {
  const today = todayInPropertyTz();
  const defaultFrom = formatDateOnly(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
  );
  const defaultTo = formatDateOnly(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)),
  );

  const fromStr = rawQuery.from || defaultFrom;
  const toStr = rawQuery.to || defaultTo;

  const fromDate = parseDateOnly(fromStr);
  const toDateEnd = addDays(parseDateOnly(toStr), 1); // inclusive day end in UTC

  // Payments in range
  const payments = await prisma.payment.findMany({
    where: {
      voidedAt: null,
      paidAt: {
        gte: fromDate,
        lt: toDateEnd,
      },
    },
    orderBy: { paidAt: "asc" },
  });

  const methodMap: Record<
    PaymentMethod,
    { paymentsCount: number; refundsCount: number; paymentsIdr: number; refundsIdr: number }
  > = {
    BANK_TRANSFER: { paymentsCount: 0, refundsCount: 0, paymentsIdr: 0, refundsIdr: 0 },
    QRIS: { paymentsCount: 0, refundsCount: 0, paymentsIdr: 0, refundsIdr: 0 },
    CARD_EXTERNAL: { paymentsCount: 0, refundsCount: 0, paymentsIdr: 0, refundsIdr: 0 },
    CASH: { paymentsCount: 0, refundsCount: 0, paymentsIdr: 0, refundsIdr: 0 },
    OTHER: { paymentsCount: 0, refundsCount: 0, paymentsIdr: 0, refundsIdr: 0 },
  };

  let grossPaymentsIdr = 0;
  let grossRefundsIdr = 0;
  let totalPaymentsCount = 0;
  let totalRefundsCount = 0;

  for (const p of payments) {
    const entry = methodMap[p.method] ?? methodMap.OTHER;
    if (p.kind === "PAYMENT") {
      entry.paymentsCount += 1;
      entry.paymentsIdr += p.amountIdr;
      grossPaymentsIdr += p.amountIdr;
      totalPaymentsCount += 1;
    } else if (p.kind === "REFUND") {
      entry.refundsCount += 1;
      entry.refundsIdr += p.amountIdr;
      grossRefundsIdr += p.amountIdr;
      totalRefundsCount += 1;
    }
  }

  const byMethod: PaymentByMethodSummary[] = (Object.keys(methodMap) as PaymentMethod[]).map(
    (method) => {
      const d = methodMap[method];
      return {
        method,
        paymentsCount: d.paymentsCount,
        refundsCount: d.refundsCount,
        paymentsIdr: d.paymentsIdr,
        refundsIdr: d.refundsIdr,
        netIdr: d.paymentsIdr - d.refundsIdr,
      };
    },
  );

  const cashReceivedIdr = grossPaymentsIdr - grossRefundsIdr;

  // Outstanding balances list: active reservations with unpaid balance
  const activeReservations = await prisma.reservation.findMany({
    where: {
      status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
      paymentStatus: { not: "PAID" },
    },
    orderBy: [{ checkIn: "asc" }, { id: "asc" }],
    include: {
      guest: { select: { fullName: true } },
      unit: { select: { nameEn: true, nameId: true } },
    },
  });

  let totalOutstandingBalanceIdr = 0;
  const outstandingBalances: OutstandingBalanceItem[] = [];

  for (const r of activeReservations) {
    const outstandingIdr = Math.max(0, r.totalIdr - r.netPaidIdr);
    if (outstandingIdr > 0) {
      totalOutstandingBalanceIdr += outstandingIdr;
      outstandingBalances.push({
        reservationId: r.id,
        code: r.code,
        guestName: r.guest.fullName,
        unitNameEn: r.unit.nameEn,
        unitNameId: r.unit.nameId,
        checkIn: formatDateOnly(r.checkIn),
        checkOut: formatDateOnly(r.checkOut),
        status: r.status,
        paymentStatus: r.paymentStatus,
        totalIdr: r.totalIdr,
        netPaidIdr: r.netPaidIdr,
        outstandingIdr,
      });
    }
  }

  return {
    filters: {
      from: fromStr,
      to: toStr,
    },
    totals: {
      cashReceivedIdr,
      totalPaymentsCount,
      totalRefundsCount,
      grossPaymentsIdr,
      grossRefundsIdr,
      totalOutstandingBalanceIdr,
    },
    byMethod,
    outstandingBalances,
  };
}

// ==========================================
// 4. R3: OCCUPANCY REPORT (FR-18)
// ==========================================

export interface OccupancyReportQuery {
  from?: string;
  to?: string;
}

export interface UnitOccupancyItem {
  unitId: string;
  slug: string;
  nameEn: string;
  nameId: string;
  baseRateIdr: number;
  totalDays: number;
  blockedNights: number;
  availableNights: number;
  occupiedNights: number;
  occupancyPercent: number;
}

export interface OccupancyReportResult {
  filters: {
    from: string;
    to: string;
  };
  totals: {
    totalUnits: number;
    totalCalendarDays: number;
    totalBlockedNights: number;
    totalAvailableNights: number;
    totalOccupiedNights: number;
    overallOccupancyPercent: number;
  };
  units: UnitOccupancyItem[];
}

export async function getOccupancyReport(
  prisma: PrismaClient,
  rawQuery: OccupancyReportQuery = {},
): Promise<OccupancyReportResult> {
  const today = todayInPropertyTz();
  const defaultFrom = formatDateOnly(today);
  const defaultTo = formatDateOnly(addDays(today, 30));

  const fromStr = rawQuery.from || defaultFrom;
  const toStr = rawQuery.to || defaultTo;

  const winStart = parseDateOnly(fromStr);
  const winEnd = parseDateOnly(toStr);
  const totalDays = diffNights(winStart, winEnd);

  if (totalDays < 1) {
    throw new ValidationError("'to' date must be after 'from' date.");
  }

  // Fetch active units with overlapping blocks and non-cancelled reservations
  const units = await prisma.unit.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
    include: {
      blocks: {
        where: {
          startDate: { lt: winEnd },
          endDate: { gt: winStart },
        },
        select: { startDate: true, endDate: true },
      },
      reservations: {
        where: {
          status: { in: [...BLOCKING_RESERVATION_STATUSES] },
          checkIn: { lt: winEnd },
          checkOut: { gt: winStart },
        },
        select: { checkIn: true, checkOut: true },
      },
    },
  });

  const winStartTime = winStart.getTime();
  const winEndTime = winEnd.getTime();
  const MS_DAY = 86_400_000;

  let totalBlockedNights = 0;
  let totalAvailableNights = 0;
  let totalOccupiedNights = 0;

  const unitItems: UnitOccupancyItem[] = units.map((u) => {
    // 1. Calculate blocked nights inside [winStart, winEnd)
    let unitBlocked = 0;
    for (const b of u.blocks) {
      const bStart = Math.max(b.startDate.getTime(), winStartTime);
      const bEnd = Math.min(b.endDate.getTime(), winEndTime);
      if (bEnd > bStart) {
        unitBlocked += Math.round((bEnd - bStart) / MS_DAY);
      }
    }
    // Cannot exceed window total days
    unitBlocked = Math.min(unitBlocked, totalDays);

    const availableNights = Math.max(0, totalDays - unitBlocked);

    // 2. Calculate occupied nights inside [winStart, winEnd)
    let unitOccupied = 0;
    for (const r of u.reservations) {
      const rStart = Math.max(r.checkIn.getTime(), winStartTime);
      const rEnd = Math.min(r.checkOut.getTime(), winEndTime);
      if (rEnd > rStart) {
        unitOccupied += Math.round((rEnd - rStart) / MS_DAY);
      }
    }
    unitOccupied = Math.min(unitOccupied, availableNights);

    const occupancyPercent =
      availableNights > 0 ? Math.round((unitOccupied / availableNights) * 1000) / 10 : 0;

    totalBlockedNights += unitBlocked;
    totalAvailableNights += availableNights;
    totalOccupiedNights += unitOccupied;

    return {
      unitId: u.id,
      slug: u.slug,
      nameEn: u.nameEn,
      nameId: u.nameId,
      baseRateIdr: u.baseRateIdr,
      totalDays,
      blockedNights: unitBlocked,
      availableNights,
      occupiedNights: unitOccupied,
      occupancyPercent,
    };
  });

  const overallOccupancyPercent =
    totalAvailableNights > 0
      ? Math.round((totalOccupiedNights / totalAvailableNights) * 1000) / 10
      : 0;

  return {
    filters: {
      from: fromStr,
      to: toStr,
    },
    totals: {
      totalUnits: units.length,
      totalCalendarDays: totalDays * units.length,
      totalBlockedNights,
      totalAvailableNights,
      totalOccupiedNights,
      overallOccupancyPercent,
    },
    units: unitItems,
  };
}

// ==========================================
// 5. R4: ARRIVALS & DEPARTURES REPORT (FR-18)
// ==========================================

export interface ArrivalsDeparturesQuery {
  date?: string;
  from?: string;
  to?: string;
}

export interface ArrivalItem {
  id: string;
  code: string;
  guestName: string;
  guestPhone: string | null;
  guestEmail: string | null;
  unitNameEn: string;
  unitNameId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  specialRequests: string | null;
}

export interface DepartureItem {
  id: string;
  code: string;
  guestName: string;
  guestEmail: string | null;
  unitNameEn: string;
  unitNameId: string;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  totalIdr: number;
  netPaidIdr: number;
  balanceIdr: number;
}

export interface ArrivalsDeparturesResult {
  filters: {
    from: string;
    to: string;
  };
  totals: {
    totalArrivals: number;
    checkedInArrivals: number;
    pendingArrivals: number;
    totalDepartures: number;
    checkedOutDepartures: number;
    pendingDepartures: number;
  };
  arrivals: ArrivalItem[];
  departures: DepartureItem[];
}

export async function getArrivalsDeparturesReport(
  prisma: PrismaClient,
  rawQuery: ArrivalsDeparturesQuery = {},
): Promise<ArrivalsDeparturesResult> {
  const todayStr = formatDateOnly(todayInPropertyTz());

  // If a single date is given, from = date and to = date
  const fromStr = rawQuery.date || rawQuery.from || todayStr;
  const toStr = rawQuery.date || rawQuery.to || fromStr;

  const fromDate = parseDateOnly(fromStr);
  const toDate = parseDateOnly(toStr);

  if (toDate < fromDate) {
    throw new ValidationError("'to' date must be on or after 'from' date.");
  }

  // 1. Arrivals
  const arrivalsRaw = await prisma.reservation.findMany({
    where: {
      checkIn: { gte: fromDate, lte: toDate },
      status: { not: "CANCELLED" },
    },
    orderBy: [{ checkIn: "asc" }, { id: "asc" }],
    include: {
      guest: { select: { fullName: true, phone: true, email: true } },
      unit: { select: { nameEn: true, nameId: true } },
    },
  });

  // 2. Departures
  const departuresRaw = await prisma.reservation.findMany({
    where: {
      checkOut: { gte: fromDate, lte: toDate },
      status: { not: "CANCELLED" },
    },
    orderBy: [{ checkOut: "asc" }, { id: "asc" }],
    include: {
      guest: { select: { fullName: true, email: true } },
      unit: { select: { nameEn: true, nameId: true } },
    },
  });

  let checkedInArrivals = 0;
  let pendingArrivals = 0;
  const arrivals: ArrivalItem[] = arrivalsRaw.map((r) => {
    if (r.status === "CHECKED_IN") checkedInArrivals++;
    else pendingArrivals++;

    return {
      id: r.id,
      code: r.code,
      guestName: r.guest.fullName,
      guestPhone: r.guest.phone,
      guestEmail: r.guest.email,
      unitNameEn: r.unit.nameEn,
      unitNameId: r.unit.nameId,
      checkIn: formatDateOnly(r.checkIn),
      checkOut: formatDateOnly(r.checkOut),
      adults: r.adults,
      children: r.children,
      status: r.status,
      paymentStatus: r.paymentStatus,
      specialRequests: r.specialRequests,
    };
  });

  let checkedOutDepartures = 0;
  let pendingDepartures = 0;
  const departures: DepartureItem[] = departuresRaw.map((r) => {
    if (r.status === "CHECKED_OUT") checkedOutDepartures++;
    else pendingDepartures++;

    const balanceIdr = Math.max(0, r.totalIdr - r.netPaidIdr);

    return {
      id: r.id,
      code: r.code,
      guestName: r.guest.fullName,
      guestEmail: r.guest.email,
      unitNameEn: r.unit.nameEn,
      unitNameId: r.unit.nameId,
      checkIn: formatDateOnly(r.checkIn),
      checkOut: formatDateOnly(r.checkOut),
      status: r.status,
      paymentStatus: r.paymentStatus,
      totalIdr: r.totalIdr,
      netPaidIdr: r.netPaidIdr,
      balanceIdr,
    };
  });

  return {
    filters: {
      from: fromStr,
      to: toStr,
    },
    totals: {
      totalArrivals: arrivals.length,
      checkedInArrivals,
      pendingArrivals,
      totalDepartures: departures.length,
      checkedOutDepartures,
      pendingDepartures,
    },
    arrivals,
    departures,
  };
}
