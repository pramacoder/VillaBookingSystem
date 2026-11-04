"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, ShieldAlert } from "lucide-react";
import type { UserRole } from "@prisma/client";
import type { GuestDetailResult } from "@/server/services/guest-service";
import type { AppLocale, AppMessages } from "@/lib/i18n/messages";
import { formatIdr } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/dialog";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PaymentStatusBadge, ReservationStatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

interface GuestDetailClientProps {
  locale: AppLocale;
  messages: AppMessages;
  guest: GuestDetailResult;
  actorRole: UserRole;
}

export function GuestDetailClient({ locale, messages, guest, actorRole }: GuestDetailClientProps) {
  const router = useRouter();
  const { pushToast } = useToast();

  const [fullName, setFullName] = React.useState(guest.fullName);
  const [email, setEmail] = React.useState(guest.email ?? "");
  const [phone, setPhone] = React.useState(guest.phone ?? "");
  const [country, setCountry] = React.useState(guest.country ?? "");
  const [preferredLocale, setPreferredLocale] = React.useState<"en" | "id">(
    guest.preferredLocale === "id" ? "id" : "en",
  );
  const [notes, setNotes] = React.useState(guest.notes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [anonymizeOpen, setAnonymizeOpen] = React.useState(false);
  const [anonymizing, setAnonymizing] = React.useState(false);

  const gd = messages.admin.guestDetail;
  const f = messages.admin.reservationForm;

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/guests/${guest.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          country: country.trim() || null,
          preferredLocale,
          notes: notes.trim() || null,
        }),
      });

      const payload = (await response.json()) as {
        data?: { fullName: string };
        error?: { code?: string; message?: string };
      };

      if (!response.ok || !payload.data) {
        pushToast({
          kind: "error",
          title: payload.error?.code ?? "Error",
          description: payload.error?.message ?? "Failed to update guest.",
        });
        setSaving(false);
        return;
      }

      pushToast({
        kind: "success",
        title: payload.data.fullName,
        description: messages.admin.common.save,
      });
      setSaving(false);
      router.refresh();
    } catch {
      pushToast({
        kind: "error",
        title: "Error",
        description: "Network error while updating guest.",
      });
      setSaving(false);
    }
  }

  async function handleAnonymize() {
    setAnonymizing(true);
    try {
      const response = await fetch(`/api/admin/guests/${guest.id}/anonymize`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
      });

      const payload = (await response.json()) as {
        data?: { fullName: string };
        error?: { code?: string; message?: string };
      };

      if (!response.ok || !payload.data) {
        pushToast({
          kind: "error",
          title: payload.error?.code ?? "Error",
          description: payload.error?.message ?? "Failed to anonymize guest.",
        });
        setAnonymizing(false);
        return;
      }

      setAnonymizeOpen(false);
      setFullName(payload.data.fullName);
      setEmail("");
      setPhone("");
      setCountry("");
      setNotes("");
      setAnonymizing(false);

      pushToast({
        kind: "success",
        title: payload.data.fullName,
        description: gd.anonymizeConfirm,
      });
      router.refresh();
    } catch {
      pushToast({
        kind: "error",
        title: "Error",
        description: "Network error while anonymizing guest.",
      });
      setAnonymizing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/admin/guests"
            className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{gd.backToList}</span>
          </Link>
          <h1 className="font-display text-3xl font-semibold text-gray-800">{guest.fullName}</h1>
        </div>

        {actorRole === "ADMIN" ? (
          <Button type="button" variant="destructive" onClick={() => setAnonymizeOpen(true)}>
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{gd.anonymizeButton}</span>
          </Button>
        ) : null}
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[10px] border border-gray-100 bg-white p-4">
          <p className="font-sans text-xs font-medium text-gray-600">{gd.statsTotalStays}</p>
          <p className="mt-1 font-display text-3xl font-semibold text-gray-800 tabular-nums">
            {guest.stats.totalStays}
          </p>
        </div>
        <div className="rounded-[10px] border border-gray-100 bg-white p-4">
          <p className="font-sans text-xs font-medium text-gray-600">{gd.statsCompletedStays}</p>
          <p className="mt-1 font-display text-3xl font-semibold text-gray-800 tabular-nums">
            {guest.stats.completedStays}
          </p>
        </div>
        <div className="rounded-[10px] border border-gray-100 bg-white p-4">
          <p className="font-sans text-xs font-medium text-gray-600">{gd.statsTotalBooked}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-gray-800 tabular-nums">
            {formatIdr(guest.stats.totalBookedIdr, locale)}
          </p>
        </div>
        <div className="rounded-[10px] border border-gray-100 bg-white p-4">
          <p className="font-sans text-xs font-medium text-gray-600">{gd.statsTotalPaid}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-gray-800 tabular-nums">
            {formatIdr(guest.stats.totalPaidIdr, locale)}
          </p>
        </div>
      </div>

      {/* Contact Edit Form */}
      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-[10px] border border-gray-100 bg-white p-6"
      >
        <h2 className="font-display text-xl font-semibold text-gray-800">{gd.profileTitle}</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField
            id="guest-edit-name"
            label={f.fullNameLabel}
            required
            requiredSrLabel={messages.admin.common.required}
          >
            <Input
              id="guest-edit-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </FormField>

          <FormField id="guest-edit-email" label={f.emailLabel}>
            <Input
              id="guest-edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <FormField id="guest-edit-phone" label={f.phoneLabel}>
            <Input id="guest-edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormField>

          <FormField id="guest-edit-country" label={f.countryLabel}>
            <Input
              id="guest-edit-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </FormField>

          <FormField id="guest-edit-locale" label={f.localeLabel}>
            <Select
              id="guest-edit-locale"
              value={preferredLocale}
              onChange={(e) => setPreferredLocale(e.target.value as "en" | "id")}
            >
              <option value="en">English (EN)</option>
              <option value="id">Bahasa Indonesia (ID)</option>
            </Select>
          </FormField>
        </div>

        <FormField id="guest-edit-notes" label={f.internalNotesLabel}>
          <Textarea
            id="guest-edit-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>

        <div className="flex justify-end pt-2">
          <Button type="submit" variant="primary" disabled={saving}>
            <Save className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{saving ? messages.admin.common.saving : messages.admin.common.save}</span>
          </Button>
        </div>
      </form>

      {/* Stay History Table */}
      <section className="space-y-4 rounded-[10px] border border-gray-100 bg-white p-6">
        <h2 className="font-display text-xl font-semibold text-gray-800">{gd.stayHistoryTitle}</h2>

        {guest.reservations.length === 0 ? (
          <p className="font-sans text-sm text-gray-600">
            {messages.admin.dashboard.emptyReservationsTitle}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.admin.reservationsPage.colCode}</TableHead>
                <TableHead>{messages.admin.reservationsPage.colUnit}</TableHead>
                <TableHead>{messages.admin.reservationsPage.colDates}</TableHead>
                <TableHead>{messages.admin.reservationsPage.colStatus}</TableHead>
                <TableHead>{messages.admin.reservationsPage.colPayment}</TableHead>
                <TableHead numeric>{messages.admin.reservationsPage.colTotal}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guest.reservations.map((stay) => (
                <TableRow key={stay.id}>
                  <TableCell className="font-medium tabular-nums">
                    <Link
                      href={`/admin/reservations/${stay.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {stay.code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {locale === "id" ? stay.unit.nameId : stay.unit.nameEn}
                  </TableCell>
                  <TableCell className="text-gray-600 tabular-nums">
                    {stay.checkIn} → {stay.checkOut} ({stay.nights}n)
                  </TableCell>
                  <TableCell>
                    <ReservationStatusBadge status={stay.status} locale={locale} />
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={stay.paymentStatus} locale={locale} />
                  </TableCell>
                  <TableCell numeric className="font-medium">
                    {formatIdr(stay.totalIdr, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Anonymize Dialog (ADMIN only, TC-G04, TC-U13) */}
      <ConfirmActionDialog
        open={anonymizeOpen}
        onClose={() => setAnonymizeOpen(false)}
        title={gd.anonymizeDialogTitle}
        description={gd.anonymizeDialogDescription}
        requireReason
        isDestructive
        reasonLabel={messages.admin.common.reasonLabel}
        reasonPlaceholder={messages.admin.common.reasonPlaceholder}
        cancelLabel={messages.admin.common.cancel}
        confirmActionLabel={gd.anonymizeConfirm}
        isSubmitting={anonymizing}
        onConfirm={() => handleAnonymize()}
      />
    </div>
  );
}
