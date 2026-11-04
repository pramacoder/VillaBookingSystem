import Link from "next/link";
import { Search } from "lucide-react";
import { db } from "@/server/db";
import { requirePageRole } from "@/server/auth/require-role";
import { listGuests } from "@/server/services/guest-service";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { getMessages } from "@/lib/i18n/messages";
import { formatIdr } from "@/lib/money";
import { CreateGuestDialog } from "@/components/admin/create-guest-dialog";
import { FormField, Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/view-states";

interface AdminGuestsPageProps {
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

function buildGuestFilterUrl(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  const merged = { ...current, ...overrides };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v.length > 0) {
      sp.set(k, v);
    }
  }
  const qs = sp.toString();
  return qs ? `/admin/guests?${qs}` : "/admin/guests";
}

export default async function AdminGuestsPage({ searchParams }: AdminGuestsPageProps) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const locale = await getAdminLocale();
  const messages = getMessages(locale);
  const resolvedParams = (await searchParams) ?? {};

  const currentFilters = {
    q: pickParam(resolvedParams, "q"),
    sortBy: pickParam(resolvedParams, "sortBy") ?? "createdAt",
    sortDir: pickParam(resolvedParams, "sortDir") ?? "desc",
    page: pickParam(resolvedParams, "page") ?? "1",
  };

  const { items, meta } = await listGuests(db, currentFilters);
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  const fromIndex = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const toIndex = Math.min(meta.total, meta.page * meta.pageSize);
  const g = messages.admin.guestsPage;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl font-semibold text-gray-800">
            {messages.admin.sections.guestsTitle}
          </h1>
          <p className="max-w-2xl font-sans text-sm text-gray-600">
            {messages.admin.sections.guestsSubtitle}
          </p>
        </div>

        <CreateGuestDialog locale={locale} messages={messages} />
      </header>

      {/* Search Bar */}
      <form
        method="GET"
        action="/admin/guests"
        className="flex flex-col gap-3 rounded-[10px] border border-gray-100 bg-white p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <FormField id="guest-search-q" label={g.searchLabel}>
            <Input
              id="guest-search-q"
              name="q"
              type="search"
              defaultValue={currentFilters.q ?? ""}
              placeholder={g.searchPlaceholder}
            />
          </FormField>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-blue-600 px-4 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{messages.admin.common.applyFilters}</span>
          </button>
          <Link
            href="/admin/guests"
            className="inline-flex min-h-11 items-center justify-center rounded-[6px] border border-gray-100 bg-white px-3.5 py-2.5 font-sans text-sm font-medium text-gray-800 hover:bg-gray-100"
          >
            {messages.admin.common.resetFilters}
          </Link>
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState title={g.emptyTitle} description={g.emptyDescription} />
      ) : (
        <div className="space-y-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Link
                    href={buildGuestFilterUrl(currentFilters, {
                      sortBy: "fullName",
                      sortDir:
                        currentFilters.sortBy === "fullName" && currentFilters.sortDir === "asc"
                          ? "desc"
                          : "asc",
                      page: "1",
                    })}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    {g.colName}
                  </Link>
                </TableHead>
                <TableHead>{g.colContact}</TableHead>
                <TableHead>{g.colCountry}</TableHead>
                <TableHead numeric>{g.colStays}</TableHead>
                <TableHead numeric>{g.colTotalBooked}</TableHead>
                <TableHead numeric>{g.colTotalPaid}</TableHead>
                <TableHead>{g.colActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((guest) => (
                <TableRow key={guest.id}>
                  <TableCell className="font-medium text-gray-800">
                    <Link
                      href={`/admin/guests/${guest.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {guest.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">
                    <div>{guest.email ?? "—"}</div>
                    <div className="tabular-nums">{guest.phone ?? "—"}</div>
                  </TableCell>
                  <TableCell className="text-gray-600">{guest.country ?? "—"}</TableCell>
                  <TableCell numeric className="font-medium">
                    {guest.totalStays}
                  </TableCell>
                  <TableCell numeric className="font-medium">
                    {formatIdr(guest.totalBookedIdr, locale)}
                  </TableCell>
                  <TableCell numeric className="text-gray-600">
                    {formatIdr(guest.totalPaidIdr, locale)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/guests/${guest.id}`}
                      className="inline-flex min-h-9 items-center rounded-[6px] border border-gray-100 bg-white px-3 py-1.5 font-sans text-xs font-medium text-gray-800 hover:bg-gray-100"
                    >
                      {messages.admin.common.viewDetail}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-[10px] border border-t-0 border-gray-100 bg-white px-4 py-3 font-sans text-xs text-gray-600">
            <p className="tabular-nums">
              {messages.admin.common.paginationShowing
                .replace("{from}", String(fromIndex))
                .replace("{to}", String(toIndex))
                .replace("{total}", String(meta.total))}
            </p>
            <div className="flex items-center gap-2">
              {meta.page > 1 ? (
                <Link
                  href={buildGuestFilterUrl(currentFilters, {
                    page: String(meta.page - 1),
                  })}
                  className="inline-flex min-h-9 items-center rounded-[6px] border border-gray-100 bg-white px-3 py-1.5 font-sans text-xs font-medium text-gray-800 hover:bg-gray-100"
                >
                  {messages.admin.common.previousPage}
                </Link>
              ) : null}
              <span className="px-2 font-medium text-gray-800 tabular-nums">
                {meta.page} / {totalPages}
              </span>
              {meta.page < totalPages ? (
                <Link
                  href={buildGuestFilterUrl(currentFilters, {
                    page: String(meta.page + 1),
                  })}
                  className="inline-flex min-h-9 items-center rounded-[6px] border border-gray-100 bg-white px-3 py-1.5 font-sans text-xs font-medium text-gray-800 hover:bg-gray-100"
                >
                  {messages.admin.common.nextPage}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
