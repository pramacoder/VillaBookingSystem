import { db } from "@/server/db";
import { requirePageRole } from "@/server/auth/require-role";
import { addDays, formatDateOnly, todayInPropertyTz } from "@/lib/dates";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { getMessages } from "@/lib/i18n/messages";
import { CreateReservationForm } from "@/components/admin/create-reservation-form";

interface NewReservationPageProps {
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

export default async function AdminNewReservationPage({ searchParams }: NewReservationPageProps) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const locale = await getAdminLocale();
  const messages = getMessages(locale);
  const resolvedParams = (await searchParams) ?? {};

  const units = await db.unit.findMany({
    where: { status: "ACTIVE" },
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

  const today = todayInPropertyTz();
  const defaultUnitId = pickParam(resolvedParams, "unitId") ?? units[0]?.id ?? "";
  const defaultCheckIn = pickParam(resolvedParams, "checkIn") ?? formatDateOnly(addDays(today, 1));
  const defaultCheckOut =
    pickParam(resolvedParams, "checkOut") ?? formatDateOnly(addDays(today, 3));

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl font-semibold text-gray-800">
          {messages.admin.reservationForm.pageTitle}
        </h1>
        <p className="max-w-2xl font-sans text-sm text-gray-600">
          {messages.admin.reservationForm.pageSubtitle}
        </p>
      </header>

      <CreateReservationForm
        locale={locale}
        messages={messages}
        units={units}
        defaultUnitId={defaultUnitId}
        defaultCheckIn={defaultCheckIn}
        defaultCheckOut={defaultCheckOut}
      />
    </div>
  );
}
