import { db } from "@/server/db";
import { requirePageRole } from "@/server/auth/require-role";
import { formatDateOnly, todayInPropertyTz } from "@/lib/dates";
import { formatIdr } from "@/lib/money";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { getMessages } from "@/lib/i18n/messages";
import { PaymentStatusBadge, ReservationStatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, PermissionState } from "@/components/ui/view-states";

interface AdminOverviewPageProps {
  searchParams: Promise<{ forbidden?: string }>;
}

export default async function AdminOverviewPage({ searchParams }: AdminOverviewPageProps) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const resolvedParams = await searchParams;
  const locale = await getAdminLocale();
  const messages = getMessages(locale);
  const today = todayInPropertyTz();

  const [
    arrivalsToday,
    departuresToday,
    inHouseCount,
    pendingCount,
    activeUnitsCount,
    blockingReservations,
    recentReservations,
  ] = await Promise.all([
    db.reservation.count({
      where: {
        checkIn: today,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
    }),
    db.reservation.count({
      where: {
        checkOut: today,
        status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
      },
    }),
    db.reservation.count({
      where: {
        status: "CHECKED_IN",
      },
    }),
    db.reservation.count({
      where: {
        status: "PENDING",
      },
    }),
    db.unit.count({
      where: {
        status: "ACTIVE",
      },
    }),
    db.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
      },
      select: {
        totalIdr: true,
        netPaidIdr: true,
      },
    }),
    db.reservation.findMany({
      take: 8,
      orderBy: { checkIn: "desc" },
      include: {
        unit: {
          select: { nameEn: true, nameId: true },
        },
        guest: {
          select: { fullName: true },
        },
      },
    }),
  ]);

  const outstandingBalanceIdr = blockingReservations.reduce(
    (sum, r) => sum + Math.max(0, r.totalIdr - r.netPaidIdr),
    0,
  );

  const summaryCards = [
    {
      label: messages.admin.dashboard.arrivalsToday,
      value: String(arrivalsToday),
    },
    {
      label: messages.admin.dashboard.departuresToday,
      value: String(departuresToday),
    },
    {
      label: messages.admin.dashboard.inHouseGuests,
      value: String(inHouseCount),
    },
    {
      label: messages.admin.dashboard.pendingRequests,
      value: String(pendingCount),
    },
    {
      label: messages.admin.dashboard.outstandingBalance,
      value: formatIdr(outstandingBalanceIdr, locale),
    },
    {
      label: messages.admin.dashboard.occupancy30d,
      value: String(activeUnitsCount),
    },
  ];

  return (
    <div className="space-y-6">
      {resolvedParams.forbidden === "1" ? (
        <PermissionState
          title="Administrator privilege required"
          description={messages.admin.dashboard.forbiddenNotice}
        />
      ) : null}

      <header className="space-y-1.5">
        <h1 className="font-display text-3xl font-semibold text-gray-800">
          {messages.admin.dashboard.title}
        </h1>
        <p className="max-w-2xl font-sans text-sm text-gray-600">
          {messages.admin.dashboard.subtitle}
        </p>
      </header>

      {/* Summary Cards: Large numerals in Cormorant Garamond, labels in DM Sans Small (DESIGN.md §4 & §7.2) */}
      <section
        aria-label="Operational metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-[8px] border border-gray-100 bg-white p-5">
            <p className="font-sans text-xs font-medium text-gray-600 uppercase">{card.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold text-gray-800 tabular-nums">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <section aria-labelledby="recent-reservations-heading" className="space-y-3">
        <div>
          <h2
            id="recent-reservations-heading"
            className="font-display text-2xl font-semibold text-gray-800"
          >
            {messages.admin.dashboard.recentReservationsTitle}
          </h2>
          <p className="font-sans text-xs text-gray-600">
            {messages.admin.dashboard.recentReservationsSubtitle}
          </p>
        </div>

        {recentReservations.length === 0 ? (
          <EmptyState
            title={messages.admin.dashboard.emptyReservationsTitle}
            description={messages.admin.dashboard.emptyReservationsBody}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.admin.dashboard.colCode}</TableHead>
                <TableHead>{messages.admin.dashboard.colGuest}</TableHead>
                <TableHead>{messages.admin.dashboard.colUnit}</TableHead>
                <TableHead>{messages.admin.dashboard.colDates}</TableHead>
                <TableHead>{messages.admin.dashboard.colStatus}</TableHead>
                <TableHead>{messages.admin.dashboard.colPayment}</TableHead>
                <TableHead numeric>{messages.admin.dashboard.colTotal}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentReservations.map((res) => {
                const isCancelled = res.status === "CANCELLED";
                const isFutureStay = res.checkIn.getTime() > today.getTime();
                const unitName = locale === "id" ? res.unit.nameId : res.unit.nameEn;

                return (
                  <TableRow key={res.id}>
                    <TableCell className="font-mono text-xs font-medium">{res.code}</TableCell>
                    <TableCell className="font-medium">{res.guest.fullName}</TableCell>
                    <TableCell>{unitName}</TableCell>
                    <TableCell
                      className={`tabular-nums ${isCancelled ? "text-gray-600 line-through" : ""}`}
                    >
                      {formatDateOnly(res.checkIn)} → {formatDateOnly(res.checkOut)}
                    </TableCell>
                    <TableCell>
                      <ReservationStatusBadge status={res.status} locale={locale} />
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge
                        status={res.paymentStatus}
                        locale={locale}
                        isFutureStay={isFutureStay}
                      />
                    </TableCell>
                    <TableCell numeric className="font-medium">
                      {formatIdr(res.totalIdr, locale)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
