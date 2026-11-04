import { db } from "@/server/db";
import { requirePageRole } from "@/server/auth/require-role";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { getMessages } from "@/lib/i18n/messages";
import { formatDateOnly, todayInPropertyTz } from "@/lib/dates";
import {
  getArrivalsDeparturesReport,
  getOccupancyReport,
  getPaymentsReport,
  getReservationsReport,
} from "@/server/services/report-service";
import { ReportsClient, type ReportTab } from "@/components/admin/reports-client";
import type { PaymentStatus, ReservationStatus } from "@prisma/client";

interface AdminReportsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function pickParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const val = params[key];
  const str = Array.isArray(val) ? val[0] : val;
  const trimmed = str?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const locale = await getAdminLocale();
  const messages = getMessages(locale);
  const rawParams = searchParams ? await searchParams : {};

  const today = todayInPropertyTz();
  const todayStr = formatDateOnly(today);

  // Default range: 1st of month to end of month
  const defaultFrom = formatDateOnly(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
  );
  const defaultTo = formatDateOnly(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)),
  );

  const rawTab = pickParam(rawParams, "tab");
  const currentTab: ReportTab =
    rawTab === "payments" || rawTab === "occupancy" || rawTab === "arrivals"
      ? rawTab
      : "reservations";

  const fromParam = pickParam(rawParams, "from") || defaultFrom;
  const toParam = pickParam(rawParams, "to") || defaultTo;
  const unitIdParam = pickParam(rawParams, "unitId");
  const statusParam = pickParam(rawParams, "status") as ReservationStatus | undefined;
  const paymentStatusParam = pickParam(rawParams, "paymentStatus") as PaymentStatus | undefined;

  // Active units for filter dropdown
  const units = await db.unit.findMany({
    where: { status: { in: ["ACTIVE", "DRAFT"] } },
    select: { id: true, slug: true, nameEn: true, nameId: true },
    orderBy: { sortOrder: "asc" },
  });

  // Fetch report data for active tab
  let reservationsReport;
  let paymentsReport;
  let occupancyReport;
  let arrivalsReport;

  if (currentTab === "reservations") {
    reservationsReport = await getReservationsReport(db, {
      from: fromParam,
      to: toParam,
      unitId: unitIdParam,
      status: statusParam,
      paymentStatus: paymentStatusParam,
    });
  } else if (currentTab === "payments") {
    paymentsReport = await getPaymentsReport(db, {
      from: fromParam,
      to: toParam,
    });
  } else if (currentTab === "occupancy") {
    occupancyReport = await getOccupancyReport(db, {
      from: fromParam,
      to: toParam,
    });
  } else if (currentTab === "arrivals") {
    arrivalsReport = await getArrivalsDeparturesReport(db, {
      from: fromParam,
      to: toParam,
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5 print:hidden">
        <h1 className="font-display text-3xl font-semibold text-gray-800">
          {messages.admin.sections.reportsTitle}
        </h1>
        <p className="max-w-2xl font-sans text-sm text-gray-600">
          {messages.admin.sections.reportsSubtitle}
        </p>
      </header>

      <ReportsClient
        currentTab={currentTab}
        locale={locale}
        messages={messages}
        todayString={todayStr}
        units={units}
        reservationsReport={reservationsReport}
        paymentsReport={paymentsReport}
        occupancyReport={occupancyReport}
        arrivalsReport={arrivalsReport}
        fromParam={fromParam}
        toParam={toParam}
        unitIdParam={unitIdParam}
        statusParam={statusParam}
        paymentStatusParam={paymentStatusParam}
      />
    </div>
  );
}
