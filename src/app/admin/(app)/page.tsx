import { requirePageRole } from "@/server/auth/require-role";
import { getAdminAuthDictionary } from "@/lib/i18n/admin-dictionaries";

interface AdminOverviewPageProps {
  searchParams: Promise<{ forbidden?: string }>;
}

export default async function AdminOverviewPage({ searchParams }: AdminOverviewPageProps) {
  const user = await requirePageRole(["ADMIN", "STAFF"]);
  const resolvedParams = await searchParams;
  const dict = getAdminAuthDictionary("en");

  return (
    <div className="space-y-6">
      {resolvedParams.forbidden === "1" ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[10px] border border-status-warning-fg/30 bg-status-warning-bg px-4 py-3 text-sm text-status-warning-fg"
        >
          <span aria-hidden="true" className="font-semibold">
            ▲
          </span>
          <span>{dict.dashboard.forbiddenNotice}</span>
        </div>
      ) : null}

      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold text-gray-800">
          {dict.dashboard.title}
        </h1>
        <p className="max-w-2xl text-sm text-gray-600">{dict.dashboard.subtitle}</p>
      </header>

      <section
        aria-labelledby="session-card-heading"
        className="rounded-[10px] border border-gray-400/40 bg-white p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="session-card-heading" className="text-lg font-semibold text-gray-800">
              {dict.dashboard.roleCardTitle}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{dict.dashboard.roleCardBody}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success-bg px-3 py-1 text-xs font-medium text-status-success-fg">
            <span aria-hidden="true">✓</span>
            <span>{dict.dashboard.sessionActiveBadge}</span>
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-gray-600 uppercase">Name</dt>
            <dd className="mt-1 text-sm font-medium text-gray-800">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-600 uppercase">Email</dt>
            <dd className="mt-1 font-mono text-sm text-gray-800">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-600 uppercase">Role</dt>
            <dd className="mt-1 text-sm font-semibold text-blue-600">{user.role}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
