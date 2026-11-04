import { db } from "@/server/db";
import { requirePageRole } from "@/server/auth/require-role";
import { listUsers } from "@/server/services/user-service";
import { getAdminAuthDictionary } from "@/lib/i18n/admin-dictionaries";

export default async function AdminUsersPage() {
  await requirePageRole(["ADMIN"]);
  const users = await listUsers(db);
  const dict = getAdminAuthDictionary("en");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold text-gray-800">
          {dict.usersPage.title}
        </h1>
        <p className="max-w-2xl text-sm text-gray-600">{dict.usersPage.subtitle}</p>
      </header>

      <div className="overflow-x-auto rounded-[10px] border border-gray-400/40 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{dict.usersPage.tableCaption}</caption>
          <thead className="border-b border-gray-400/40 bg-gray-100 text-xs font-semibold tracking-wider text-gray-600 uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">
                {dict.usersPage.colName}
              </th>
              <th scope="col" className="px-4 py-3">
                {dict.usersPage.colEmail}
              </th>
              <th scope="col" className="px-4 py-3">
                {dict.usersPage.colRole}
              </th>
              <th scope="col" className="px-4 py-3">
                {dict.usersPage.colStatus}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-100/50">
                <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                <td className="px-4 py-3 font-mono text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-300 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                    <span aria-hidden="true">◆</span>
                    <span>{u.role}</span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-status-success-bg px-2.5 py-0.5 text-xs font-medium text-status-success-fg">
                      <span aria-hidden="true">✓</span>
                      <span>{dict.usersPage.statusActive}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-status-neutral-bg px-2.5 py-0.5 text-xs font-medium text-status-neutral-fg">
                      <span aria-hidden="true">○</span>
                      <span>{dict.usersPage.statusInactive}</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
