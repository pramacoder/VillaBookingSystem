import { requirePageRole } from "@/server/auth/require-role";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { getMessages } from "@/lib/i18n/messages";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requirePageRole(["ADMIN", "STAFF"]);
  const locale = await getAdminLocale();
  const messages = getMessages(locale);

  return (
    <AdminShell user={user} locale={locale} messages={messages}>
      {children}
    </AdminShell>
  );
}
