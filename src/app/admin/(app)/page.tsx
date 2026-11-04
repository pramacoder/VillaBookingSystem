import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  LogIn,
  LogOut,
  Plus,
  TrendingUp,
} from "lucide-react";
import { db } from "@/server/db";
import { requirePageRole } from "@/server/auth/require-role";
import { formatDateOnly, todayInPropertyTz } from "@/lib/dates";
import { formatIdr } from "@/lib/money";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { getMessages } from "@/lib/i18n/messages";
import { getDashboardMetrics } from "@/server/services/report-service";
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

  const [metrics, recentReservations] = await Promise.all([
    getDashboardMetrics(db),
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

  const summaryCards = [
    {
      label: messages.admin.dashboard.arrivalsToday,
      value: String(metrics.arrivalsToday),
      icon: LogIn,
      href: "/admin/reports?tab=arrivals",
      color: "text-blue-600",
    },
    {
      label: messages.admin.dashboard.departuresToday,
      value: String(metrics.departuresToday),
      icon: LogOut,
      href: "/admin/reports?tab=arrivals",
      color: "text-emerald-600",
    },
    {
      label: messages.admin.dashboard.inHouseGuests,
      value: String(metrics.inHouseCount),
      icon: CheckCircle2,
      href: "/admin/reservations?status=CHECKED_IN",
      color: "text-indigo-600",
    },
    {
      label: messages.admin.dashboard.pendingRequests,
      value: String(metrics.pendingCount),
      icon: Clock,
      href: "/admin/reservations?status=PENDING",
      color: "text-amber-600",
    },
    {
      label: messages.admin.dashboard.outstandingBalance,
      value: formatIdr(metrics.outstandingBalanceIdr, locale),
      icon: CreditCard,
      href: "/admin/reports?tab=payments",
      color: "text-rose-600",
    },
    {
      label: messages.admin.dashboard.occupancy30d,
      value: `${metrics.occupancy30dPercent}%`,
      icon: TrendingUp,
      href: "/admin/reports?tab=occupancy",
      color: "text-teal-700",
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <header className="space-y-1.5">
          <h1 className="font-display text-3xl font-semibold text-gray-800">
            {messages.admin.dashboard.title}
          </h1>
          <p className="max-w-2xl font-sans text-sm text-gray-600">
            {messages.admin.dashboard.subtitle}
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/reservations/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-[6px] bg-blue-600 px-4 py-2.5 font-sans text-sm font-medium text-white hover:bg-blue-600/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Plus className="h-4 w-4" />
            <span>{messages.admin.reservationsPage.createButton}</span>
          </Link>
          <Link
            href="/admin/calendar"
            className="inline-flex min-h-11 items-center gap-2 rounded-[6px] border border-gray-600/40 bg-white px-4 py-2.5 font-sans text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Calendar className="h-4 w-4" />
            <span>{messages.admin.nav.calendar}</span>
          </Link>
          <Link
            href="/admin/reports"
            className="inline-flex min-h-11 items-center gap-2 rounded-[6px] border border-gray-600/40 bg-white px-4 py-2.5 font-sans text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <FileText className="h-4 w-4" />
            <span>{messages.admin.nav.reports}</span>
          </Link>
        </div>
      </div>

      {/* Summary Cards: Large numerals in Cormorant Garamond, labels in DM Sans Small (DESIGN.md §4 & §7.2) */}
      <section
        aria-label="Operational metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="group block rounded-[8px] border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-blue-600/30 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="font-sans text-xs font-medium uppercase tracking-wider text-gray-500">
                  {card.label}
                </p>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <p className="font-display text-3xl font-semibold text-gray-800 tabular-nums">
                  {card.value}
                </p>
                <span className="font-sans text-xs text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 flex items-center gap-0.5">
                  View <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      {/* Recent Activity Table */}
      <section aria-labelledby="recent-reservations-heading" className="space-y-3">
        <div className="flex items-center justify-between">
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
          <Link
            href="/admin/reservations"
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            {locale === "id" ? "Lihat semua reservasi →" : "View all reservations →"}
          </Link>
        </div>

        {recentReservations.length === 0 ? (
          <EmptyState
            title={messages.admin.dashboard.emptyReservationsTitle}
            description={messages.admin.dashboard.emptyReservationsBody}
          />
        ) : (
          <div className="overflow-hidden rounded-[8px] border border-gray-100 bg-white shadow-sm">
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
                      <TableCell className="font-mono text-xs font-medium">
                        <Link
                          href={`/admin/reservations/${res.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {res.code}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{res.guest.fullName}</TableCell>
                      <TableCell>{unitName}</TableCell>
                      <TableCell
                        className={`tabular-nums ${isCancelled ? "text-gray-400 line-through" : ""}`}
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
          </div>
        )}
      </section>
    </div>
  );
}
