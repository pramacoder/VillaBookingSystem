import Link from "next/link";
import { ArrowRight, Image as ImageIcon, Search, Sparkles } from "lucide-react";
import type { UnitStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requirePageRole } from "@/server/auth/require-role";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { getMessages } from "@/lib/i18n/messages";
import { listUnits } from "@/server/services/unit-service";
import { formatIdr } from "@/lib/money";
import { CreateUnitDialog } from "@/components/admin/create-unit-dialog";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { UnitStatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/view-states";

interface AdminUnitsPageProps {
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

export default async function AdminUnitsPage({ searchParams }: AdminUnitsPageProps) {
  const actor = await requirePageRole(["ADMIN", "STAFF"]);
  const locale = await getAdminLocale();
  const messages = getMessages(locale);
  const rawParams = searchParams ? await searchParams : {};

  const statusParam = pickParam(rawParams, "status") as UnitStatus | undefined;
  const qParam = pickParam(rawParams, "q");
  const sortByParam = pickParam(rawParams, "sortBy") as
    "sortOrder" | "nameEn" | "baseRateIdr" | "createdAt" | undefined;

  const units = await listUnits(db, {
    status: statusParam,
    q: qParam,
    sortBy: sortByParam ?? "sortOrder",
  });

  const canCreate = actor.role === "ADMIN";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <header className="space-y-1.5">
          <h1 className="font-display text-3xl font-semibold text-gray-800">
            {messages.admin.sections.unitsTitle}
          </h1>
          <p className="max-w-2xl font-sans text-sm text-gray-600">
            {messages.admin.sections.unitsSubtitle}
          </p>
        </header>

        <CreateUnitDialog locale={locale} messages={messages} canCreate={canCreate} />
      </div>

      {/* Filters Bar */}
      <div className="rounded-[8px] border border-gray-100 bg-white p-4 shadow-sm">
        <form method="GET" action="/admin/units" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <FormField id="unit-search" label={messages.admin.reservationsPage.searchLabel}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <Input
                  id="unit-search"
                  name="q"
                  defaultValue={qParam ?? ""}
                  placeholder={
                    locale === "id" ? "Cari nama unit atau slug…" : "Search unit name or slug…"
                  }
                  className="pl-9"
                />
              </div>
            </FormField>
          </div>

          <div className="w-48">
            <FormField id="unit-status" label={messages.admin.unitsPage.statusFilter}>
              <Select id="unit-status" name="status" defaultValue={statusParam ?? ""}>
                <option value="">{locale === "id" ? "Semua Status" : "All Statuses"}</option>
                <option value="ACTIVE">{messages.statuses.unit.ACTIVE}</option>
                <option value="DRAFT">{messages.statuses.unit.DRAFT}</option>
                <option value="ARCHIVED">{messages.statuses.unit.ARCHIVED}</option>
              </Select>
            </FormField>
          </div>

          <div className="w-48">
            <FormField id="unit-sort" label={locale === "id" ? "Urutkan" : "Sort By"}>
              <Select id="unit-sort" name="sortBy" defaultValue={sortByParam ?? "sortOrder"}>
                <option value="sortOrder">
                  {locale === "id" ? "Urutan Tampil" : "Display Order"}
                </option>
                <option value="nameEn">{locale === "id" ? "Nama Unit" : "Unit Name"}</option>
                <option value="baseRateIdr">
                  {locale === "id" ? "Tarif Terendah" : "Lowest Rate"}
                </option>
              </Select>
            </FormField>
          </div>

          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="md">
              <span>{locale === "id" ? "Terapkan" : "Filter"}</span>
            </Button>
            {(statusParam || qParam || sortByParam) && (
              <Link
                href="/admin/units"
                className="inline-flex h-11 items-center justify-center rounded-[6px] border border-gray-600/40 bg-white px-3 font-sans text-sm font-medium text-gray-800 hover:bg-gray-100"
              >
                {locale === "id" ? "Reset" : "Clear"}
              </Link>
            )}
          </div>
        </form>
      </div>

      {/* Units Table */}
      {units.length === 0 ? (
        <EmptyState
          title={messages.admin.unitsPage.emptyTitle}
          description={messages.admin.unitsPage.emptyDescription}
        />
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-gray-100 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.admin.unitsPage.colName}</TableHead>
                <TableHead>{messages.admin.unitsPage.colStatus}</TableHead>
                <TableHead>{messages.admin.unitsPage.colCapacity}</TableHead>
                <TableHead>{messages.admin.unitsPage.colRate}</TableHead>
                <TableHead>{messages.admin.unitsPage.colAmenities}</TableHead>
                <TableHead>{messages.admin.unitsPage.colImages}</TableHead>
                <TableHead className="text-right">{messages.admin.unitsPage.colActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((u) => {
                const displayName = locale === "id" ? u.nameId : u.nameEn;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-16 shrink-0 rounded-[6px] bg-gray-100 flex items-center justify-center border border-gray-200 overflow-hidden text-gray-400">
                          {u.coverImage ? (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-[10px] font-mono text-gray-600">
                              IMG
                            </div>
                          ) : (
                            <ImageIcon className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-sans text-sm font-semibold text-gray-800">
                              {displayName}
                            </span>
                            {u.isFeatured && (
                              <span className="inline-flex items-center rounded-[6px] bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
                                <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                <span>Featured</span>
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-xs text-gray-500">/{u.slug}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <UnitStatusBadge status={u.status} locale={locale} />
                    </TableCell>

                    <TableCell className="font-sans text-xs text-gray-600">
                      <div>
                        {u.maxGuests} {locale === "id" ? "tamu" : "guests"}
                      </div>
                      <div className="text-gray-400">
                        {u.bedrooms} {locale === "id" ? "kmr" : "bed"} · {u.bathrooms}{" "}
                        {locale === "id" ? "k.mandi" : "bath"}
                      </div>
                    </TableCell>

                    <TableCell className="font-sans text-xs font-medium text-gray-800">
                      <div>{formatIdr(u.baseRateIdr)}</div>
                      <div className="text-[11px] text-gray-400">
                        /{locale === "id" ? "malam" : "night"}
                      </div>
                    </TableCell>

                    <TableCell className="font-mono text-xs text-gray-600">
                      {u.amenitiesCount}
                    </TableCell>

                    <TableCell className="font-mono text-xs text-gray-600">
                      {u.imagesCount}
                    </TableCell>

                    <TableCell className="text-right">
                      <Link
                        href={`/admin/units/${u.id}`}
                        className="inline-flex items-center gap-1.5 rounded-[6px] border border-gray-600/40 bg-white px-2.5 py-1 font-sans text-xs font-medium text-gray-800 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        <span>{locale === "id" ? "Kelola" : "Manage"}</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
