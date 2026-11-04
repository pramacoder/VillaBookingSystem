import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requirePageRole } from "@/server/auth/require-role";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { getMessages } from "@/lib/i18n/messages";
import { getPropertyTodayString } from "@/lib/dates";
import { getUnitDetail, listAllAmenities } from "@/server/services/unit-service";
import { UnitDetailClient } from "@/components/admin/unit-detail-client";

interface AdminUnitDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUnitDetailPage({ params }: AdminUnitDetailPageProps) {
  const actor = await requirePageRole(["ADMIN", "STAFF"]);
  const { id } = await params;
  const locale = await getAdminLocale();
  const messages = getMessages(locale);
  const todayString = getPropertyTodayString();

  let unit;
  try {
    unit = await getUnitDetail(db, id);
  } catch {
    notFound();
  }

  const allAmenities = await listAllAmenities(db);

  return (
    <UnitDetailClient
      unit={unit}
      allAmenities={allAmenities}
      locale={locale}
      messages={messages}
      userRole={actor.role}
      todayString={todayString}
    />
  );
}
