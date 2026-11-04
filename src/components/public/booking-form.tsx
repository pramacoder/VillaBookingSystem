"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, AlertCircle, ArrowRight, Clock, Sparkles } from "lucide-react";
import type { PublicUnitSummary } from "@/server/services/unit-service";
import type { AppLocale } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/messages";
import { formatDateOnly, todayInPropertyTz } from "@/lib/dates";

interface BookingFormProps {
  units: PublicUnitSummary[];
  locale: AppLocale;
  initialUnit?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialAdults?: number;
  initialChildren?: number;
}

export function BookingForm({
  units,
  locale,
  initialUnit,
  initialCheckIn,
  initialCheckOut,
  initialAdults = 2,
  initialChildren = 0,
}: BookingFormProps) {
  const dictionary = getMessages(locale).public;
  const bMessages = dictionary.bookPage;
  const isId = locale === "id";

  const today = React.useMemo(() => todayInPropertyTz(), []);
  const todayStr = React.useMemo(() => formatDateOnly(today), [today]);

  // Form states
  const [unitSlug, setUnitSlug] = React.useState(initialUnit || units[0]?.slug || "");
  const [checkIn, setCheckIn] = React.useState(initialCheckIn || "");
  const [checkOut, setCheckOut] = React.useState(initialCheckOut || "");
  const [adults, setAdults] = React.useState(initialAdults);
  const [children, setChildren] = React.useState(initialChildren);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [privacyAccepted, setPrivacyAccepted] = React.useState(false);
  const [honeypot, setHoneypot] = React.useState(""); // Anti-spam honeypot (website)

  // Submission states
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [confirmedResult, setConfirmedResult] = React.useState<{
    code: string;
    status: string;
  } | null>(null);

  // Selected unit details
  const selectedUnit = units.find((u) => u.slug === unitSlug);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    if (!unitSlug) {
      setErrorMessage(isId ? "Silakan pilih unit villa." : "Please select a villa unit.");
      return;
    }

    if (!checkIn || !checkOut || checkIn >= checkOut) {
      setErrorMessage(
        isId
          ? "Tanggal check-out harus setelah tanggal check-in."
          : "Check-out date must be after check-in date.",
      );
      return;
    }

    if (!privacyAccepted) {
      setErrorMessage(
        isId
          ? "Anda harus menyetujui pernyataan privasi untuk melanjutkan."
          : "You must accept the privacy statement to proceed.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/public/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          unitSlug,
          checkIn,
          checkOut,
          adults,
          children,
          name,
          email,
          phone: phone ? phone : null,
          message: message ? message : null,
          privacyAccepted,
          locale,
          website: honeypot, // Honeypot field
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.code === "DATE_CONFLICT") {
          setErrorMessage(
            isId
              ? "Tanggal yang dipilih sudah tidak tersedia. Silakan tentukan tanggal lain."
              : "The selected dates are no longer available for this unit. Please select different dates.",
          );
        } else if (data.error?.code === "RATE_LIMITED") {
          setErrorMessage(
            isId
              ? "Terlalu banyak permintaan diajukan. Silakan tunggu beberapa saat sebelum mencoba kembali."
              : "Too many requests. Please wait a few moments before trying again.",
          );
        } else if (data.error?.details?.fields) {
          setFieldErrors(data.error.details.fields);
          setErrorMessage(
            data.error.message ||
              (isId ? "Terdapat kesalahan pengisian data." : "Validation error."),
          );
        } else {
          setErrorMessage(
            data.error?.message ||
              (isId ? "Gagal mengirimkan permintaan." : "Failed to submit request."),
          );
        }
        return;
      }

      setConfirmedResult({
        code: data.data.code,
        status: data.data.status,
      });
    } catch {
      setErrorMessage(
        isId
          ? "Terjadi kesalahan jaringan. Silakan periksa koneksi Anda dan coba lagi."
          : "A network error occurred. Please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Success view (FR-05)
  if (confirmedResult) {
    return (
      <div className="mx-auto max-w-2xl rounded-[8px] border border-gray-200 bg-white p-8 sm:p-12 shadow-sm text-center space-y-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-10 w-10" />
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-3xl font-bold text-gray-900">
            {bMessages.successTitle}
          </h2>
          <p className="font-sans text-sm text-gray-600">{bMessages.successSubtitle}</p>
        </div>

        {/* Reference Code Card */}
        <div className="rounded-[6px] border border-gray-200 bg-gray-50 p-6 space-y-2">
          <p className="font-sans text-xs font-semibold uppercase tracking-wider text-gray-500">
            {bMessages.referenceCodeLabel}
          </p>
          <p className="font-mono text-3xl font-bold tracking-wider text-blue-700">
            {confirmedResult.code}
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-800">
              <Clock className="h-3.5 w-3.5" />
              <span>{bMessages.statusBadge}</span>
            </span>
          </div>
        </div>

        {/* Clear non-confirmation reminder */}
        <div className="rounded-[6px] border border-amber-200 bg-amber-50/70 p-4 text-left text-xs text-amber-900 space-y-1">
          <p className="font-semibold">{bMessages.importantNotice}</p>
          <p>{dictionary.requestSuccess.replace("{code}", confirmedResult.code)}</p>
        </div>

        {/* What happens next instructions */}
        <div className="text-left border-t border-gray-100 pt-6 space-y-3 font-sans text-xs text-gray-600">
          <h3 className="font-semibold uppercase tracking-wider text-gray-900">
            {bMessages.nextStepsTitle}
          </h3>
          <p>{bMessages.nextStepsP1}</p>
          <p>{bMessages.nextStepsP2.replace("{email}", email || "your email")}</p>
          <p>{bMessages.nextStepsP3}</p>
        </div>

        {/* Action navigation buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center">
          <Link
            href={`/${locale}`}
            className="rounded-[6px] border border-gray-300 bg-white px-5 py-2.5 font-sans text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {bMessages.backHome}
          </Link>
          <Link
            href={`/${locale}/villas`}
            className="rounded-[6px] bg-blue-600 px-5 py-2.5 font-sans text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            {bMessages.viewOtherVillas}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-8" noValidate>
      {/* Important Disclaimer Banner */}
      <div className="rounded-[6px] border border-blue-100 bg-blue-50/60 p-4 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="font-sans text-xs text-blue-900 leading-relaxed">
          <p className="font-semibold">{bMessages.importantNotice}</p>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-[6px] border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-start gap-2.5"
        >
          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step 1: Stay & Unit Details */}
      <section className="rounded-[8px] border border-gray-200 bg-white p-6 sm:p-8 space-y-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          {bMessages.stayDetailsTitle}
        </h2>

        {/* Unit Selector */}
        <div>
          <label
            htmlFor="inquiry-unit"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2"
          >
            {bMessages.villaUnit}
          </label>
          <select
            id="inquiry-unit"
            value={unitSlug}
            onChange={(e) => setUnitSlug(e.target.value)}
            className="w-full rounded-[6px] border border-gray-300 px-4 py-2.5 text-sm font-sans text-gray-900 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {units.map((u) => (
              <option key={u.id} value={u.slug}>
                {u.name} (Max {u.maxGuests} guests)
              </option>
            ))}
          </select>
        </div>

        {/* Dates Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="inquiry-checkIn"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2"
            >
              {dictionary.checkIn}
            </label>
            <input
              id="inquiry-checkIn"
              type="date"
              min={todayStr}
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              required
              className="w-full rounded-[6px] border border-gray-300 px-4 py-2.5 text-sm font-sans text-gray-900 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="inquiry-checkOut"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2"
            >
              {dictionary.checkOut}
            </label>
            <input
              id="inquiry-checkOut"
              type="date"
              min={checkIn || todayStr}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              required
              className="w-full rounded-[6px] border border-gray-300 px-4 py-2.5 text-sm font-sans text-gray-900 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Guest Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="inquiry-adults"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2"
            >
              {bMessages.adults}
            </label>
            <select
              id="inquiry-adults"
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
              className="w-full rounded-[6px] border border-gray-300 px-4 py-2.5 text-sm font-sans text-gray-900 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {Array.from({ length: selectedUnit?.maxGuests || 6 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}{" "}
                  {n === 1
                    ? locale === "en"
                      ? "Adult"
                      : "Dewasa"
                    : locale === "en"
                      ? "Adults"
                      : "Dewasa"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="inquiry-children"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2"
            >
              {bMessages.children}
            </label>
            <select
              id="inquiry-children"
              value={children}
              onChange={(e) => setChildren(Number(e.target.value))}
              className="w-full rounded-[6px] border border-gray-300 px-4 py-2.5 text-sm font-sans text-gray-900 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} {locale === "en" ? "Children" : "Anak"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Step 2: Guest Contact Information */}
      <section className="rounded-[8px] border border-gray-200 bg-white p-6 sm:p-8 space-y-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          {bMessages.guestInfoTitle}
        </h2>

        <div>
          <label
            htmlFor="inquiry-name"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2"
          >
            {bMessages.fullName} *
          </label>
          <input
            id="inquiry-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={bMessages.fullNamePlaceholder}
            required
            className="w-full rounded-[6px] border border-gray-300 px-4 py-2.5 text-sm font-sans text-gray-900 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          {fieldErrors.name && <p className="mt-1 text-xs text-rose-600">{fieldErrors.name}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="inquiry-email"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2"
            >
              {bMessages.email} *
            </label>
            <input
              id="inquiry-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={bMessages.emailPlaceholder}
              required
              className="w-full rounded-[6px] border border-gray-300 px-4 py-2.5 text-sm font-sans text-gray-900 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {fieldErrors.email && <p className="mt-1 text-xs text-rose-600">{fieldErrors.email}</p>}
          </div>

          <div>
            <label
              htmlFor="inquiry-phone"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2"
            >
              {bMessages.phone}
            </label>
            <input
              id="inquiry-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={bMessages.phonePlaceholder}
              className="w-full rounded-[6px] border border-gray-300 px-4 py-2.5 text-sm font-sans text-gray-900 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="inquiry-message"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2"
          >
            {bMessages.specialRequests}
          </label>
          <textarea
            id="inquiry-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={bMessages.specialRequestsPlaceholder}
            className="w-full rounded-[6px] border border-gray-300 px-4 py-2.5 text-sm font-sans text-gray-900 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {/* Anti-spam honeypot field (hidden from human users, filled by bots) */}
        <div style={{ display: "none" }} aria-hidden="true">
          <label htmlFor="inquiry-website">Do not fill this field</label>
          <input
            id="inquiry-website"
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {/* Privacy Consent Checkbox (CONTENT_GUIDE §11) */}
        <div className="pt-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              required
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-sans text-xs text-gray-600 leading-relaxed">
              {dictionary.privacyConsent}
            </span>
          </label>
        </div>
      </section>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-[6px] bg-blue-600 py-3.5 font-sans text-base font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 flex items-center justify-center gap-2"
        >
          {submitting ? bMessages.submitting : bMessages.submitButton}
          {!submitting && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </form>
  );
}
