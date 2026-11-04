import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { db } from "@/server/db";
import { requirePageRole } from "@/server/auth/require-role";
import { listReservations } from "@/server/services/reservation-service";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { getMessages } from "@/lib/i18n/messages";
import { formatIdr } from "@/lib/money";
import { FormField, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  PaymentStatusBadge,
  ReservationStatusBadge,
  StatusBadge,
} from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/view-states";

interface AdminReservationsPageProps {
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

function buildFilterUrl(
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
  return qs ? `/admin/reservations?${qs}` : "/admin/reservations";
}

export default async function AdminReservationsPage({ searchParams }: AdminReservationsPageProps) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const locale = await getAdminLocale();
  const messages = getMessages(locale);
  const resolvedParams = (await searchParams) ?? {};

  const currentFilters = {
    q: pickParam(resolvedParams, "q"),
    status: pickParam(resolvedParams, "status"),
    paymentStatus: pickParam(resolvedParams, "paymentStatus"),
    unitId: pickParam(resolvedParams, "unitId"),
    source: pickParam(resolvedParams, "source"),
    from: pickParam(resolvedParams, "from"),
    to: pickParam(resolvedParams, "to"),
    sortBy: pickParam(resolvedParams, "sortBy") ?? "checkIn",
    sortDir: pickParam(resolvedParams, "sortDir") ?? "desc",
    page: pickParam(resolvedParams, "page") ?? "1",
  };

  const [listResult, units] = await Promise.all([
    listReservations(db, currentFilters),
    db.unit.findMany({
      select: { id: true, nameEn: true, nameId: true, status: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const { items, meta } = listResult;
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  const fromIndex = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const toIndex = Math.min(meta.total, meta.page * meta.pageSize);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl font-semibold text-gray-800">
            {messages.admin.sections.reservationsTitle}
          </h1>
          <p className="max-w-2xl font-sans text-sm text-gray-600">
            {messages.admin.sections.reservationsSubtitle}
          </p>
        </div>

        <Link
          href="/admin/reservations/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-blue-600 px-4 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{messages.admin.reservationsPage.createButton}</span>
        </Link>
      </header>

      {/* URL-reflected Filter Form (TC-U10) */}
      <form
        method="GET"
        action="/admin/reservations"
        className="rounded-[10px] border border-gray-100 bg-white p-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField id="filter-q" label={messages.admin.reservationsPage.searchLabel}>
            <Input
              id="filter-q"
              name="q"
              type="search"
              defaultValue={currentFilters.q ?? ""}
              placeholder={messages.admin.reservationsPage.searchPlaceholder}
            />
          </FormField>

          <FormField id="filter-status" label={messages.admin.reservationsPage.statusFilter}>
            <Select id="filter-status" name="status" defaultValue={currentFilters.status ?? ""}>
              <option value="">{messages.admin.common.all}</option>
              <option value="PENDING">{messages.statuses.reservation.PENDING}</option>
              <option value="CONFIRMED">{messages.statuses.reservation.CONFIRMED}</option>
              <option value="CHECKED_IN">{messages.statuses.reservation.CHECKED_IN}</option>
              <option value="CHECKED_OUT">{messages.statuses.reservation.CHECKED_OUT}</option>
              <option value="CANCELLED">{messages.statuses.reservation.CANCELLED}</option>
            </Select>
          </FormField>

          <FormField id="filter-payment" label={messages.admin.reservationsPage.paymentFilter}>
            <Select
              id="filter-payment"
              name="paymentStatus"
              defaultValue={currentFilters.paymentStatus ?? ""}
            >
              <option value="">{messages.admin.common.all}</option>
              <option value="UNPAID">{messages.statuses.payment.UNPAID}</option>
              <option value="PARTIAL">{messages.statuses.payment.PARTIAL}</option>
              <option value="PAID">{messages.statuses.payment.PAID}</option>
            </Select>
          </FormField>

          <FormField id="filter-unit" label={messages.admin.reservationsPage.unitFilter}>
            <Select id="filter-unit" name="unitId" defaultValue={currentFilters.unitId ?? ""}>
              <option value="">{messages.admin.common.all}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {locale === "id" ? u.nameId : u.nameEn}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField id="filter-from" label={messages.admin.reservationsPage.fromFilter}>
            <Input
              id="filter-from"
              name="from"
              type="date"
              defaultValue={currentFilters.from ?? ""}
            />
          </FormField>

          <FormField id="filter-to" label={messages.admin.reservationsPage.toFilter}>
            <Input id="filter-to" name="to" type="date" defaultValue={currentFilters.to ?? ""} />
          </FormField>

          <FormField id="filter-source" label={messages.admin.reservationsPage.sourceFilter}>
            <Select id="filter-source" name="source" defaultValue={currentFilters.source ?? ""}>
              <option value="">{messages.admin.common.all}</option>
              <option value="WEBSITE">WEBSITE</option>
              <option value="ADMIN">ADMIN</option>
              <option value="WHATSAPP">WHATSAPP</option>
              <option value="PHONE">PHONE</option>
              <option value="OTHER">OTHER</option>
            </Select>
          </FormField>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[6px] bg-blue-600 px-4 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{messages.admin.common.applyFilters}</span>
            </button>
            <Link
              href="/admin/reservations"
              className="inline-flex min-h-11 items-center justify-center rounded-[6px] border border-gray-100 bg-white px-3.5 py-2.5 font-sans text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
            >
              {messages.admin.common.resetFilters}
            </Link>
          </div>
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={messages.admin.reservationsPage.emptyTitle}
          description={messages.admin.reservationsPage.emptyDescription}
          actionLabel={messages.admin.reservationsPage.createButton}
          actionHref="/admin/reservations/new"
        />
      ) : (
        <div className="space-y-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Link
                    href={buildFilterUrl(currentFilters, {
                      sortBy: "code",
                      sortDir:
                        currentFilters.sortBy === "code" && currentFilters.sortDir === "asc"
                          ? "desc"
                          : "asc",
                      page: "1",
                    })}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    {messages.admin.reservationsPage.colCode}
                  </Link>
                </TableHead>
                <TableHead>{messages.admin.reservationsPage.colGuest}</TableHead>
                <TableHead>{messages.admin.reservationsPage.colUnit}</TableHead>
                <TableHead>
                  <Link
                    href={buildFilterUrl(currentFilters, {
                      sortBy: "checkIn",
                      sortDir:
                        currentFilters.sortBy === "checkIn" && currentFilters.sortDir === "asc"
                          ? "desc"
                          : "asc",
                      page: "1",
                    })}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    {messages.admin.reservationsPage.colDates}
                  </Link>
                </TableHead>
                <TableHead>{messages.admin.reservationsPage.colStatus}</TableHead>
                <TableHead>{messages.admin.reservationsPage.colPayment}</TableHead>
                <TableHead numeric>
                  <Link
                    href={buildFilterUrl(currentFilters, {
                      sortBy: "totalIdr",
                      sortDir:
                        currentFilters.sortBy === "totalIdr" && currentFilters.sortDir === "desc"
                          ? "asc"
                          : "desc",
                      page: "1",
                    })}
                    className="inline-flex items-center justify-end gap-1 hover:text-gray-800"
                  >
                    {messages.admin.reservationsPage.colTotal}
                  </Link>
                </TableHead>
                <TableHead numeric>{messages.admin.reservationsPage.colBalance}</TableHead>
                <TableHead>{messages.admin.reservationsPage.colActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-gray-800 tabular-nums">
                    <Link
                      href={`/admin/reservations/${item.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {item.code}
                    </Link>
                    <div className="text-xs font-normal text-gray-600">{item.source}</div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/guests/${item.guest.id}`}
                      className="font-medium text-gray-800 hover:text-blue-600 hover:underline"
                    >
                      {item.guest.fullName}
                    </Link>
                    <div className="text-xs text-gray-600">
                      {item.guest.email ?? item.guest.phone ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {locale === "id" ? item.unit.nameId : item.unit.nameEn}
                  </TableCell>
                  <TableCell className="text-gray-600 tabular-nums">
                    <div>
                      {item.checkIn} → {item.checkOut}
                    </div>
                    <div className="text-xs text-gray-600">
                      {item.nights} {messages.admin.reservationsPage.colNights.toLowerCase()} ·{" "}
                      {item.adults + item.children} {messages.public.guests.toLowerCase()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ReservationStatusBadge status={item.status} locale={locale} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PaymentStatusBadge status={item.paymentStatus} locale={locale} />
                      {item.refundPending ? (
                        <StatusBadge
                          variant="warning"
                          label={messages.admin.reservationsPage.refundPendingBadge}
                        />
                      ) : null}
                      {item.overpaidIdr > 0 ? (
                        <StatusBadge
                          variant="warning"
                          label={messages.admin.reservationsPage.overpaidBadge}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell numeric className="font-medium">
                    {formatIdr(item.totalIdr, locale)}
                  </TableCell>
                  <TableCell numeric className="text-gray-600">
                    {formatIdr(item.balanceDueIdr, locale)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/reservations/${item.id}`}
                      className="inline-flex min-h-9 items-center rounded-[6px] border border-gray-100 bg-white px-3 py-1.5 font-sans text-xs font-medium text-gray-800 transition-colors hover:bg-gray-100"
                    >
                      {messages.admin.common.viewDetail}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Server-side Pagination Footer (TC-U11) */}
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
                  href={buildFilterUrl(currentFilters, { page: String(meta.page - 1) })}
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
                  href={buildFilterUrl(currentFilters, { page: String(meta.page + 1) })}
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
