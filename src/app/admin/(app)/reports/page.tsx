import { requirePageRole } from "@/server/auth/require-role";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { getMessages } from "@/lib/i18n/messages";

export default async function AdminReportsPage() {
  await requirePageRole(["ADMIN", "STAFF"]);
  const locale = await getAdminLocale();
  const messages = getMessages(locale);

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl font-semibold text-gray-800">
          {messages.admin.sections.reportsTitle}
        </h1>
        <p className="max-w-2xl font-sans text-sm text-gray-600">
          {messages.admin.sections.reportsSubtitle}
        </p>
      </header>
    </div>
  );
}
