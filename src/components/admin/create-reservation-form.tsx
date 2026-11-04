"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, PlusCircle } from "lucide-react";
import type { AppLocale, AppMessages } from "@/lib/i18n/messages";
import { formatIdr } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

export interface UnitOptionForReservation {
  id: string;
  slug: string;
  nameEn: string;
  nameId: string;
  baseRateIdr: number;
  cleaningFeeIdr: number;
  maxGuests: number;
  minNights: number;
  maxNights: number | null;
}

interface CreateReservationFormProps {
  locale: AppLocale;
  messages: AppMessages;
  units: UnitOptionForReservation[];
  defaultUnitId: string;
  defaultCheckIn: string;
  defaultCheckOut: string;
}

function diffCalendarDays(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00.000Z`);
  const b = new Date(`${checkOut}T00:00:00.000Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    return 0;
  }
  const diff = Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff);
}

export function CreateReservationForm({
  locale,
  messages,
  units,
  defaultUnitId,
  defaultCheckIn,
  defaultCheckOut,
}: CreateReservationFormProps) {
  const router = useRouter();
  const { pushToast } = useToast();

  const [unitId, setUnitId] = React.useState(defaultUnitId);
  const [checkIn, setCheckIn] = React.useState(defaultCheckIn);
  const [checkOut, setCheckOut] = React.useState(defaultCheckOut);
  const [adults, setAdults] = React.useState(2);
  const [children, setChildren] = React.useState(0);
  const [status, setStatus] = React.useState<"CONFIRMED" | "PENDING">("CONFIRMED");
  const [source, setSource] = React.useState<"ADMIN" | "PHONE" | "WHATSAPP" | "WEBSITE" | "OTHER">(
    "ADMIN",
  );
  const [discountIdr, setDiscountIdr] = React.useState(0);
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [preferredLocale, setPreferredLocale] = React.useState<"en" | "id">(locale);
  const [specialRequests, setSpecialRequests] = React.useState("");
  const [internalNotes, setInternalNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const selectedUnit = units.find((u) => u.id === unitId) ?? units[0];
  const nights = diffCalendarDays(checkIn, checkOut);
  const nightlySubtotalIdr = selectedUnit ? nights * selectedUnit.baseRateIdr : 0;
  const cleaningFeeIdr = selectedUnit && nights > 0 ? selectedUnit.cleaningFeeIdr : 0;
  const totalIdr = Math.max(0, nightlySubtotalIdr + cleaningFeeIdr - discountIdr);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorBanner(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/reservations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          unitId,
          checkIn,
          checkOut,
          adults: Number(adults),
          children: Number(children),
          status,
          source,
          discountIdr: Number(discountIdr) || 0,
          locale: preferredLocale,
          specialRequests: specialRequests.trim() || null,
          internalNotes: internalNotes.trim() || null,
          guest: {
            fullName: fullName.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            country: country.trim() || null,
            preferredLocale,
          },
        }),
      });

      const payload = (await response.json()) as {
        data?: { id: string; code: string };
        error?: {
          code?: string;
          message?: string;
          details?: { fields?: Record<string, string> };
        };
      };

      if (!response.ok || !payload.data) {
        if (payload.error?.details?.fields) {
          setFieldErrors(payload.error.details.fields);
        }
        const msg = payload.error?.message ?? "Failed to create reservation.";
        setErrorBanner(msg);
        pushToast({
          kind: "error",
          title: payload.error?.code ?? "Error",
          description: msg,
        });
        setSubmitting(false);
        return;
      }

      pushToast({
        kind: "success",
        title: `${payload.data.code}`,
        description: `${messages.admin.reservationForm.submitCreate}: ${payload.data.code}`,
      });

      router.push(`/admin/reservations/${payload.data.id}`);
      router.refresh();
    } catch {
      setErrorBanner("Network error while creating reservation.");
      setSubmitting(false);
    }
  }

  const f = messages.admin.reservationForm;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/reservations"
          className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{f.backToList}</span>
        </Link>
      </div>

      {errorBanner ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[10px] border border-status-danger-fg/30 bg-status-danger-bg px-4 py-3 font-sans text-sm text-status-danger-fg"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>{errorBanner}</div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 columns: Stay & Guest fields */}
        <div className="space-y-6 lg:col-span-2">
          <section className="space-y-4 rounded-[10px] border border-gray-100 bg-white p-6">
            <h2 className="font-display text-xl font-semibold text-gray-800">
              {f.staySectionTitle}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="create-unit"
                label={f.unitLabel}
                required
                requiredSrLabel={messages.admin.common.required}
                error={fieldErrors.unitId}
                helperText={
                  selectedUnit
                    ? `Max ${selectedUnit.maxGuests} ${messages.public.guests.toLowerCase()} · Min ${selectedUnit.minNights}n`
                    : undefined
                }
              >
                <Select id="create-unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {locale === "id" ? u.nameId : u.nameEn} ({formatIdr(u.baseRateIdr, locale)}/n)
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                id="create-status"
                label={f.initialStatusLabel}
                required
                requiredSrLabel={messages.admin.common.required}
              >
                <Select
                  id="create-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "CONFIRMED" | "PENDING")}
                >
                  <option value="CONFIRMED">{messages.statuses.reservation.CONFIRMED}</option>
                  <option value="PENDING">{messages.statuses.reservation.PENDING}</option>
                </Select>
              </FormField>

              <FormField
                id="create-checkin"
                label={f.checkInLabel}
                required
                requiredSrLabel={messages.admin.common.required}
                error={fieldErrors.checkIn}
              >
                <Input
                  id="create-checkin"
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </FormField>

              <FormField
                id="create-checkout"
                label={f.checkOutLabel}
                required
                requiredSrLabel={messages.admin.common.required}
                error={fieldErrors.checkOut}
              >
                <Input
                  id="create-checkout"
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </FormField>

              <FormField
                id="create-adults"
                label={f.adultsLabel}
                required
                requiredSrLabel={messages.admin.common.required}
                error={fieldErrors.adults}
              >
                <Input
                  id="create-adults"
                  type="number"
                  min={1}
                  max={30}
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                />
              </FormField>

              <FormField id="create-children" label={f.childrenLabel} error={fieldErrors.children}>
                <Input
                  id="create-children"
                  type="number"
                  min={0}
                  max={30}
                  value={children}
                  onChange={(e) => setChildren(Number(e.target.value))}
                />
              </FormField>

              <FormField
                id="create-source"
                label={f.sourceLabel}
                required
                requiredSrLabel={messages.admin.common.required}
              >
                <Select
                  id="create-source"
                  value={source}
                  onChange={(e) =>
                    setSource(
                      e.target.value as "ADMIN" | "PHONE" | "WHATSAPP" | "WEBSITE" | "OTHER",
                    )
                  }
                >
                  <option value="ADMIN">ADMIN (Direct / Walk-in)</option>
                  <option value="WHATSAPP">WHATSAPP</option>
                  <option value="PHONE">PHONE</option>
                  <option value="WEBSITE">WEBSITE</option>
                  <option value="OTHER">OTHER</option>
                </Select>
              </FormField>

              <FormField
                id="create-discount"
                label={f.discountLabel}
                error={fieldErrors.discountIdr}
              >
                <Input
                  id="create-discount"
                  type="number"
                  min={0}
                  step={50000}
                  value={discountIdr}
                  onChange={(e) => setDiscountIdr(Number(e.target.value) || 0)}
                />
              </FormField>
            </div>
          </section>

          <section className="space-y-4 rounded-[10px] border border-gray-100 bg-white p-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-gray-800">
                {f.guestSectionTitle}
              </h2>
              <p className="mt-1 font-sans text-xs text-gray-600">{f.guestHelper}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="create-guest-name"
                label={f.fullNameLabel}
                required
                requiredSrLabel={messages.admin.common.required}
                error={fieldErrors["guest.fullName"]}
              >
                <Input
                  id="create-guest-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ayu Pratiwi"
                />
              </FormField>

              <FormField
                id="create-guest-email"
                label={f.emailLabel}
                error={fieldErrors["guest.email"]}
              >
                <Input
                  id="create-guest-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guest@example.com"
                />
              </FormField>

              <FormField
                id="create-guest-phone"
                label={f.phoneLabel}
                error={fieldErrors["guest.phone"]}
              >
                <Input
                  id="create-guest-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+62 812 0000 0000"
                />
              </FormField>

              <FormField
                id="create-guest-country"
                label={f.countryLabel}
                error={fieldErrors["guest.country"]}
              >
                <Input
                  id="create-guest-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Indonesia"
                />
              </FormField>

              <FormField id="create-guest-locale" label={f.localeLabel}>
                <Select
                  id="create-guest-locale"
                  value={preferredLocale}
                  onChange={(e) => setPreferredLocale(e.target.value as "en" | "id")}
                >
                  <option value="en">English (EN)</option>
                  <option value="id">Bahasa Indonesia (ID)</option>
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="create-special-requests" label={f.specialRequestsLabel}>
                <Textarea
                  id="create-special-requests"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  rows={3}
                />
              </FormField>

              <FormField id="create-internal-notes" label={f.internalNotesLabel}>
                <Textarea
                  id="create-internal-notes"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                />
              </FormField>
            </div>
          </section>
        </div>

        {/* Right column: Quote preview & Submit */}
        <div className="space-y-4">
          <aside className="rounded-[10px] border border-gray-100 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-gray-800">
              {f.quotePreviewTitle}
            </h2>

            <dl className="mt-4 space-y-2.5 font-sans text-sm">
              <div className="flex items-center justify-between text-gray-600">
                <dt>{f.nightlySubtotal.replace("{nights}", String(nights))}</dt>
                <dd className="tabular-nums text-gray-800">
                  {formatIdr(nightlySubtotalIdr, locale)}
                </dd>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <dt>{f.cleaningFee}</dt>
                <dd className="tabular-nums text-gray-800">{formatIdr(cleaningFeeIdr, locale)}</dd>
              </div>
              {discountIdr > 0 ? (
                <div className="flex items-center justify-between text-gray-600">
                  <dt>{f.discount}</dt>
                  <dd className="tabular-nums text-status-danger-fg">
                    -{formatIdr(discountIdr, locale)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-gray-100 pt-3 font-medium text-gray-800">
                <dt>{f.totalStay}</dt>
                <dd className="font-display text-2xl font-semibold tabular-nums text-gray-800">
                  {formatIdr(totalIdr, locale)}
                </dd>
              </div>
            </dl>

            <div className="mt-6">
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || nights < 1}
                className="w-full"
              >
                <PlusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{submitting ? f.submittingCreate : f.submitCreate}</span>
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </form>
  );
}
