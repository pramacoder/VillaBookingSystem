import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Compass, ShieldCheck, Sun, Waves, Sparkles } from "lucide-react";
import { db } from "@/server/db";
import { listPublicUnits } from "@/server/services/unit-service";
import { UnitCard } from "@/components/public/unit-card";
import type { AppLocale } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/messages";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === "id";
  return {
    title: isId
      ? "Sagara Villas — Menginap Tenang di Tepi Pantai"
      : "Sagara Villas — Calm Stays, Close to the Shore",
    description: isId
      ? "Suaka villa butik di pesisir pantai Bali. Ajukan reservasi untuk pengalaman menginap privat dan tenang."
      : "Boutique standalone coastal villa retreats in Bali. Inquire for tranquil, unhurried coastal stays.",
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: "/en",
        id: "/id",
      },
    },
  };
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;

  if (locale !== "en" && locale !== "id") {
    notFound();
  }

  const validLocale = locale as AppLocale;
  const dictionary = getMessages(validLocale).public;
  const homeMessages = dictionary.home;

  // Fetch active units from database
  const allUnits = await listPublicUnits(db, validLocale);
  const featuredUnits = allUnits.filter((u) => u.isFeatured);
  const displayUnits = featuredUnits.length > 0 ? featuredUnits : allUnits.slice(0, 3);

  return (
    <div className="space-y-24 sm:space-y-32 pb-24">
      {/* 1. HERO SECTION (FR-01) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-sky-50/50 via-teal-300/10 to-white pt-20 pb-28 sm:pt-28 sm:pb-36 border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-teal-300/60 bg-white/80 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-800 shadow-sm mb-6">
            <Waves className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
            <span>{homeMessages.introBadge}</span>
          </div>

          <h1 className="mx-auto max-w-4xl font-display text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl leading-[1.1]">
            {dictionary.heroTitle}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl font-sans text-base sm:text-lg text-gray-600 leading-relaxed">
            {dictionary.heroSubtitle}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`/${validLocale}/villas`}
              className="w-full sm:w-auto rounded-[6px] bg-blue-600 px-8 py-3.5 font-sans text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 flex items-center justify-center gap-2"
            >
              <span>{dictionary.heroCta}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            <Link
              href={`/${validLocale}/book`}
              className="w-full sm:w-auto rounded-[6px] border border-gray-300 bg-white px-7 py-3.5 font-sans text-sm font-semibold text-gray-800 hover:border-gray-800 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {dictionary.requestBooking}
            </Link>
          </div>
        </div>
      </section>

      {/* 2. INTRO PHILOSOPHY SECTION */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5 space-y-4">
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-blue-600">
              {validLocale === "en" ? "Restorative Hospitality" : "Keramahan yang Menenangkan"}
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
              {homeMessages.introTitle}
            </h2>
          </div>

          <div className="lg:col-span-7">
            <p className="font-sans text-base sm:text-lg text-gray-600 leading-relaxed">
              {homeMessages.introBody}
            </p>
          </div>
        </div>
      </section>

      {/* 3. FEATURED VILLAS GRID (FR-01, FR-02) */}
      <section
        aria-labelledby="featured-villas-heading"
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between border-b border-gray-100 pb-6 mb-10">
          <div>
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-blue-600">
              {validLocale === "en" ? "Coastal Sanctuaries" : "Suaka Pesisir"}
            </span>
            <h2
              id="featured-villas-heading"
              className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mt-1"
            >
              {homeMessages.featuredHeading}
            </h2>
            <p className="mt-2 font-sans text-sm text-gray-600 max-w-xl">
              {homeMessages.featuredSub}
            </p>
          </div>

          <div className="mt-4 sm:mt-0">
            <Link
              href={`/${validLocale}/villas`}
              className="inline-flex items-center gap-1.5 font-sans text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              <span>{validLocale === "en" ? "View all villas" : "Lihat semua villa"}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayUnits.map((unit) => (
            <UnitCard key={unit.id} unit={unit} locale={validLocale} />
          ))}
        </div>
      </section>

      {/* 4. SAGARA EXPERIENCE PILLARS */}
      <section className="bg-gray-50 py-20 border-y border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900">
              {homeMessages.pillarsTitle}
            </h2>
            <p className="mt-3 font-sans text-sm text-gray-600">
              {validLocale === "en"
                ? "Every detail of your stay is considered to ensure unhurried peace and privacy."
                : "Setiap detail kunjungan Anda dirancang untuk menghadirkan ketenangan dan kenyamanan sejati."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pillar 1 */}
            <div className="rounded-[8px] border border-gray-200 bg-white p-8 space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Sun className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-900">
                {homeMessages.pillar1Title}
              </h3>
              <p className="font-sans text-sm text-gray-600 leading-relaxed">
                {homeMessages.pillar1Desc}
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="rounded-[8px] border border-gray-200 bg-white p-8 space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-emerald-700">
                <Sparkles className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-900">
                {homeMessages.pillar2Title}
              </h3>
              <p className="font-sans text-sm text-gray-600 leading-relaxed">
                {homeMessages.pillar2Desc}
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="rounded-[8px] border border-gray-200 bg-white p-8 space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-900">
                {homeMessages.pillar3Title}
              </h3>
              <p className="font-sans text-sm text-gray-600 leading-relaxed">
                {homeMessages.pillar3Desc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. LOCATION PREVIEW */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[8px] border border-gray-200 bg-gradient-to-r from-teal-300/15 via-white to-blue-50 p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-700">
              <Compass className="h-4 w-4" />
              <span>{homeMessages.locationTitle}</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
              {validLocale === "en"
                ? "Moments from the Shore"
                : "Beberapa Langkah dari Garis Pantai"}
            </h2>
            <p className="font-sans text-sm text-gray-600 leading-relaxed">
              {homeMessages.locationBody}
            </p>
          </div>

          <Link
            href={`/${validLocale}/location`}
            className="rounded-[6px] border border-gray-300 bg-white px-6 py-3 font-sans text-sm font-semibold text-gray-800 hover:border-gray-800 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            {validLocale === "en" ? "Explore Area & Guide" : "Pelajari Lokasi & Sekitar"}
          </Link>
        </div>
      </section>

      {/* 6. FINAL CALL TO ACTION (FR-01) */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[8px] bg-gray-900 text-white p-10 sm:p-16 text-center space-y-6">
          <h2 className="font-display text-3xl sm:text-5xl font-bold max-w-2xl mx-auto leading-tight">
            {homeMessages.ctaTitle}
          </h2>
          <p className="font-sans text-sm sm:text-base text-gray-400 max-w-xl mx-auto leading-relaxed">
            {homeMessages.ctaBody}
          </p>
          <div className="pt-4">
            <Link
              href={`/${validLocale}/book`}
              className="inline-flex items-center gap-2 rounded-[6px] bg-blue-600 px-8 py-3.5 font-sans text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              <span>{homeMessages.ctaButton}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
