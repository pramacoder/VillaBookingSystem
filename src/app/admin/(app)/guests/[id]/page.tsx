import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requirePageRole } from "@/server/auth/require-role";
import { getGuestDetail } from "@/server/services/guest-service";
import { NotFoundError } from "@/lib/errors";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { getMessages } from "@/lib/i18n/messages";
import { GuestDetailClient } from "@/components/admin/guest-detail-client";

interface GuestDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminGuestDetailPage({ params }: GuestDetailPageProps) {
  const actor = await requirePageRole(["ADMIN", "STAFF"]);
  const locale = await getAdminLocale();
  const messages = getMessages(locale);
  const { id } = await params;

  let detail;
  try {
    detail = await getGuestDetail(db, id);
  } catch (err) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }

  return (
    <GuestDetailClient locale={locale} messages={messages} guest={detail} actorRole={actor.role} />
  );
}
