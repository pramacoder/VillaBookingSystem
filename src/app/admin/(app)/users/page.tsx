import { db } from "@/server/db";
import { requirePageRole } from "@/server/auth/require-role";
import { listUsers } from "@/server/services/user-service";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { getMessages } from "@/lib/i18n/messages";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminUsersPage() {
  await requirePageRole(["ADMIN"]);
  const users = await listUsers(db);
  const locale = await getAdminLocale();
  const messages = getMessages(locale);

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl font-semibold text-gray-800">
          {messages.admin.sections.usersTitle}
        </h1>
        <p className="max-w-2xl font-sans text-sm text-gray-600">
          {messages.admin.sections.usersSubtitle}
        </p>
      </header>

      <Table>
        <caption className="sr-only">{messages.admin.usersPage.tableCaption}</caption>
        <TableHeader>
          <TableRow>
            <TableHead>{messages.admin.usersPage.colName}</TableHead>
            <TableHead>{messages.admin.usersPage.colEmail}</TableHead>
            <TableHead>{messages.admin.usersPage.colRole}</TableHead>
            <TableHead>{messages.admin.usersPage.colStatus}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell className="font-mono text-gray-600">{u.email}</TableCell>
              <TableCell>
                <StatusBadge variant="info" label={u.role} />
              </TableCell>
              <TableCell>
                {u.isActive ? (
                  <StatusBadge variant="success" label={messages.admin.usersPage.statusActive} />
                ) : (
                  <StatusBadge variant="neutral" label={messages.admin.usersPage.statusInactive} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
