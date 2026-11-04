import Link from "next/link";
import { requirePageRole } from "@/server/auth/require-role";
import { logoutAction } from "@/app/admin/actions";
import { getAdminAuthDictionary } from "@/lib/i18n/admin-dictionaries";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requirePageRole(["ADMIN", "STAFF"]);
  const dict = getAdminAuthDictionary("en");

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      <header className="border-b border-gray-400/40 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="font-display text-2xl font-semibold text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {dict.brandName}
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-300 px-3 py-1 text-xs font-medium text-gray-800">
              <span aria-hidden="true">◆</span>
              <span>{user.role}</span>
            </span>

            <nav aria-label="Admin navigation" className="flex items-center gap-4">
              <Link
                href="/admin"
                className="rounded px-2.5 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {dict.nav.dashboard}
              </Link>
              {user.role === "ADMIN" ? (
                <Link
                  href="/admin/users"
                  className="rounded px-2.5 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  {dict.nav.users}
                </Link>
              ) : null}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-600">
              {dict.nav.signedInAs}{" "}
              <strong className="font-medium text-gray-800">{user.email}</strong>
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-[10px] border border-gray-400/60 bg-white px-4 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {dict.nav.signOut}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-8">{children}</main>
    </div>
  );
}
