"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bed,
  Bath,
  Users,
  Maximize2,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import type { PublicUnitDetail } from "@/server/services/unit-service";
import type { AppLocale } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/messages";
import { formatIdr } from "@/lib/money";
import { addDays, formatDateOnly, todayInPropertyTz } from "@/lib/dates";

interface UnitDetailClientProps {
  unit: PublicUnitDetail;
  locale: AppLocale;
}

interface QuoteState {
  loading: boolean;
  error: string | null;
  nights: number;
  nightlySubtotalIdr: number;
  cleaningFeeIdr: number;
  totalIdr: number;
  available: boolean;
}

export function UnitDetailClient({ unit, locale }: UnitDetailClientProps) {
  const router = useRouter();
  const dictionary = getMessages(locale).public;
  const dMessages = dictionary.detailPage;
  const isId = locale === "id";

  // Gallery state
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);

  // Today in Bali
  const today = React.useMemo(() => todayInPropertyTz(), []);
  const todayStr = React.useMemo(() => formatDateOnly(today), [today]);
  const defaultCheckIn = React.useMemo(() => formatDateOnly(addDays(today, 1)), [today]);
  const defaultCheckOut = React.useMemo(
    () => formatDateOnly(addDays(today, 1 + unit.minNights)),
    [today, unit.minNights],
  );

  // Form / stay state
  const [checkIn, setCheckIn] = React.useState(defaultCheckIn);
  const [checkOut, setCheckOut] = React.useState(defaultCheckOut);
  const [adults, setAdults] = React.useState(Math.min(2, unit.maxGuests));
  const [children, setChildren] = React.useState(0);

  // Quote calculation state
  const [quote, setQuote] = React.useState<QuoteState>({
    loading: false,
    error: null,
    nights: unit.minNights,
    nightlySubtotalIdr: unit.baseRateIdr * unit.minNights,
    cleaningFeeIdr: unit.cleaningFeeIdr,
    totalIdr: unit.baseRateIdr * unit.minNights + unit.cleaningFeeIdr,
    available: true,
  });

  const isDateInvalid = !checkIn || !checkOut || checkIn >= checkOut;
  const dateError = isDateInvalid
    ? isId
      ? "Tanggal check-out harus setelah check-in."
      : "Check-out must be after check-in."
    : null;

  // Fetch quote when dates change
  React.useEffect(() => {
    if (!checkIn || !checkOut || checkIn >= checkOut) {
      return;
    }

    let active = true;

    fetch("/api/public/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitSlug: unit.slug,
        checkIn,
        checkOut,
        adults,
        children,
      }),
    })
      .then(async (res) => {
        if (!active) return;
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Failed to calculate quote");
        }
        setQuote({
          loading: false,
          error: null,
          nights: data.data.nights,
          nightlySubtotalIdr: data.data.nightlySubtotalIdr,
          cleaningFeeIdr: data.data.cleaningFeeIdr,
          totalIdr: data.data.totalIdr,
          available: data.data.available,
        });
      })
      .catch((err) => {
        if (!active) return;
        setQuote((prev) => ({
          ...prev,
          loading: false,
          error: err.message,
          available: false,
        }));
      });

    return () => {
      active = false;
    };
  }, [checkIn, checkOut, adults, children, unit.slug]);

  function handleRequestStay() {
    const params = new URLSearchParams({
      unit: unit.slug,
      checkIn,
      checkOut,
      adults: String(adults),
      children: String(children),
    });
    router.push(`/${locale}/book?${params.toString()}`);
  }

  // Active displayed image
  const displayImage = unit.images[selectedImageIndex] || unit.coverImage;

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="font-sans text-xs text-gray-500">
        <ol className="flex items-center space-x-2">
          <li>
            <Link href={`/${locale}`} className="hover:text-gray-900 transition-colors">
              {dictionary.nav.home}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3 w-3 text-gray-400" />
          </li>
          <li>
            <Link href={`/${locale}/villas`} className="hover:text-gray-900 transition-colors">
              {dictionary.nav.villas}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3 w-3 text-gray-400" />
          </li>
          <li className="font-semibold text-gray-800" aria-current="page">
            {unit.name}
          </li>
        </ol>
      </nav>

      {/* Main Hero & Gallery Grid */}
      <section aria-label="Villa Gallery" className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Thumbnails (desktop left 2 cols, mobile bottom) */}
        {unit.images.length > 1 && (
          <div className="order-2 lg:order-1 lg:col-span-2 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto max-h-[500px] py-1">
            {unit.images.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setSelectedImageIndex(idx)}
                className={`relative aspect-[4/5] flex-shrink-0 w-20 lg:w-full overflow-hidden rounded-[6px] border-2 transition-all ${
                  selectedImageIndex === idx
                    ? "border-blue-600 ring-2 ring-blue-600/20"
                    : "border-transparent opacity-75 hover:opacity-100"
                }`}
                aria-label={`View image ${idx + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.path} alt={img.alt} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Main Image (3:2 ratio) */}
        <div
          className={`order-1 lg:order-2 ${
            unit.images.length > 1 ? "lg:col-span-10" : "lg:col-span-12"
          }`}
        >
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[8px] bg-gradient-to-tr from-teal-300/30 via-sky-50 to-blue-50 border border-gray-100 shadow-sm">
            {displayImage?.path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayImage.path}
                alt={displayImage.alt}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
                <span className="font-display text-4xl font-bold text-gray-800">{unit.name}</span>
                <p className="font-sans text-sm text-gray-600 mt-2">
                  {locale === "en" ? "Serene Coastal Living" : "Kenyamanan Pesisir Bali"}
                </p>
              </div>
            )}

            <div className="absolute top-4 right-4">
              <span className="rounded-[4px] bg-white/95 backdrop-blur-md px-3 py-1 font-sans text-xs font-semibold uppercase tracking-wider text-amber-900 border border-amber-200 shadow-sm">
                {dictionary.demoRate}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content & Sticky Booking Request Panel */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
        {/* Left Column: Details, Overview, Amenities, Rules */}
        <div className="lg:col-span-7 space-y-10">
          {/* Title & Key Highlights Card */}
          <div className="rounded-[8px] border border-gray-100 bg-white p-6 sm:p-8 shadow-sm">
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-gray-900">
              {unit.name}
            </h1>
            <p className="mt-3 font-sans text-base text-gray-600 leading-relaxed">{unit.summary}</p>

            {/* Spec Bar */}
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-100 pt-6 sm:grid-cols-4 text-xs text-gray-700">
              <div className="flex items-center gap-2">
                <Bed className="h-4 w-4 text-gray-500" />
                <span>
                  <strong>{unit.bedrooms}</strong>{" "}
                  {locale === "en" ? (unit.bedrooms === 1 ? "Bedroom" : "Bedrooms") : "Kamar Tidur"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Bath className="h-4 w-4 text-gray-500" />
                <span>
                  <strong>{unit.bathrooms}</strong>{" "}
                  {locale === "en"
                    ? unit.bathrooms === 1
                      ? "Bathroom"
                      : "Bathrooms"
                    : "Kamar Mandi"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span>
                  <strong>{unit.maxGuests}</strong> {locale === "en" ? "Guests max" : "Tamu maks."}
                </span>
              </div>

              {unit.areaSqm ? (
                <div className="flex items-center gap-2">
                  <Maximize2 className="h-4 w-4 text-gray-500" />
                  <span>
                    <strong>{unit.areaSqm}</strong> m²
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Detailed Overview */}
          <section aria-labelledby="overview-heading" className="space-y-4">
            <h2 id="overview-heading" className="font-display text-2xl font-bold text-gray-900">
              {dMessages.overview}
            </h2>
            <div className="prose prose-gray max-w-none font-sans text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {unit.description}
            </div>
          </section>

          {/* Amenities Grid (3 cols desktop, 2 tablet, 1 mobile per DESIGN §6) */}
          <section aria-labelledby="amenities-heading" className="space-y-4">
            <h2 id="amenities-heading" className="font-display text-2xl font-bold text-gray-900">
              {dMessages.amenities}
            </h2>
            <p className="font-sans text-xs text-gray-500">{dMessages.amenitiesDesc}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {unit.amenities.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2.5 rounded-[6px] border border-gray-100 bg-gray-50/60 p-3 text-xs font-medium text-gray-800"
                >
                  <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span>{a.name}</span>
                </div>
              ))}
            </div>
          </section>

          {/* House Rules */}
          <section aria-labelledby="rules-heading" className="space-y-4">
            <h2 id="rules-heading" className="font-display text-2xl font-bold text-gray-900">
              {dMessages.houseRules}
            </h2>

            <div className="rounded-[8px] border border-gray-100 bg-white p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-gray-100 pb-4">
                <div className="flex items-start gap-2.5">
                  <Clock className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-900 block">
                      {dMessages.checkIn}: {unit.houseRules.checkInTime}
                    </span>
                    <span className="text-gray-500">
                      {locale === "en"
                        ? "Personal greeting upon arrival"
                        : "Penyambutan langsung saat tiba"}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Clock className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-900 block">
                      {dMessages.checkOut}: {unit.houseRules.checkOutTime}
                    </span>
                    <span className="text-gray-500">
                      {locale === "en"
                        ? "Late checkout subject to calendar"
                        : "Checkout sore tergantung ketersediaan"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-gray-600">
                <div>
                  <strong className="block text-gray-900">{dMessages.quietHours}</strong>
                  <span>{unit.houseRules.quietHours}</span>
                </div>
                <div>
                  <strong className="block text-gray-900">{dMessages.smoking}</strong>
                  <span>{unit.houseRules.smoking}</span>
                </div>
                <div>
                  <strong className="block text-gray-900">{dMessages.pets}</strong>
                  <span>{unit.houseRules.pets}</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Sticky Booking Request Panel (DESIGN §6) */}
        <aside className="lg:col-span-5">
          <div className="sticky top-28 rounded-[8px] border border-gray-200 bg-white p-6 sm:p-7 shadow-lg space-y-6">
            {/* Header: Price & Demo disclosure */}
            <div className="border-b border-gray-100 pb-5">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="font-sans text-xs text-gray-500">
                    {locale === "en" ? "From" : "Mulai"}
                  </span>
                  <p className="font-display text-3xl font-bold text-gray-900 tabular-nums">
                    {formatIdr(unit.baseRateIdr, locale)}
                  </p>
                </div>
                <span className="font-sans text-xs text-gray-500">
                  / {locale === "en" ? "night" : "malam"}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="rounded-[4px] bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  {dictionary.demoRate}
                </span>
                <span className="text-[11px] text-gray-500">
                  · {dMessages.minNightsNotice.replace("{count}", String(unit.minNights))}
                </span>
              </div>
            </div>

            {/* Date Selection Controls */}
            <div className="space-y-4">
              <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-gray-700">
                {dMessages.selectDates}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="detail-checkIn"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    {dictionary.checkIn}
                  </label>
                  <input
                    id="detail-checkIn"
                    type="date"
                    min={todayStr}
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full rounded-[6px] border border-gray-300 px-3 py-2 text-xs font-sans text-gray-900 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="detail-checkOut"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    {dictionary.checkOut}
                  </label>
                  <input
                    id="detail-checkOut"
                    type="date"
                    min={checkIn || todayStr}
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full rounded-[6px] border border-gray-300 px-3 py-2 text-xs font-sans text-gray-900 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Guests Count Selector */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label
                    htmlFor="detail-adults"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    {dictionary.adults}
                  </label>
                  <select
                    id="detail-adults"
                    value={adults}
                    onChange={(e) => setAdults(Number(e.target.value))}
                    className="w-full rounded-[6px] border border-gray-300 px-3 py-2 text-xs font-sans text-gray-900 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {Array.from({ length: unit.maxGuests }, (_, i) => i + 1).map((n) => (
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
                    htmlFor="detail-children"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    {dictionary.children}
                  </label>
                  <select
                    id="detail-children"
                    value={children}
                    onChange={(e) => setChildren(Number(e.target.value))}
                    className="w-full rounded-[6px] border border-gray-300 px-3 py-2 text-xs font-sans text-gray-900 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {[0, 1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n} {locale === "en" ? "Children" : "Anak"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Dynamic Quote Breakdown */}
            <div className="rounded-[6px] bg-gray-50 p-4 border border-gray-100 text-xs space-y-2.5">
              <div className="flex items-center justify-between text-gray-600">
                <span>{dMessages.nightlySubtotal.replace("{count}", String(quote.nights))}</span>
                <span className="font-semibold text-gray-900 tabular-nums">
                  {formatIdr(quote.nightlySubtotalIdr, locale)}
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span>{dMessages.cleaningFee}</span>
                <span className="font-semibold text-gray-900 tabular-nums">
                  {formatIdr(quote.cleaningFeeIdr, locale)}
                </span>
              </div>

              <div className="border-t border-gray-200 pt-2 flex items-center justify-between text-sm font-bold text-gray-900">
                <span>{dMessages.estimatedTotal}</span>
                <span className="text-base text-blue-700 tabular-nums">
                  {formatIdr(quote.totalIdr, locale)}
                </span>
              </div>

              {(dateError || quote.error) && (
                <div className="flex items-start gap-1.5 text-xs text-rose-600 pt-1">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{dateError || quote.error}</span>
                </div>
              )}

              {!quote.available && !dateError && !quote.error && (
                <div className="flex items-start gap-1.5 text-xs text-amber-700 pt-1">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{dMessages.datesUnavailable}</span>
                </div>
              )}
            </div>

            {/* Action CTA Button */}
            <button
              type="button"
              disabled={quote.loading || !quote.available || !!dateError || !!quote.error}
              onClick={handleRequestStay}
              className="w-full rounded-[6px] bg-blue-600 py-3 font-sans text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              {dMessages.requestButton}
            </button>

            {/* Transparency Note */}
            <div className="flex items-start gap-2 text-[11px] text-gray-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                {locale === "en"
                  ? "Requests create a pending stay. You will not be charged today; our team verifies calendar availability personally."
                  : "Pengajuan membuat permintaan reservasi. Anda tidak akan dikenakan biaya hari ini; tim kami memverifikasi ketersediaan secara langsung."}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
