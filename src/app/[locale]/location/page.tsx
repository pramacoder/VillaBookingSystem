import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Compass, MapPin, Plane, Car, Footprints, ArrowRight, AlertCircle } from "lucide-react";
import type { AppLocale } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/messages";

interface LocationPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LocationPageProps): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === "id";
  return {
    title: isId
      ? "Lokasi & Lingkungan Pesisir — Sagara Villas Bali"
      : "Location & Coastal Setting — Sagara Villas Bali",
    description: isId
      ? "Panduan lokasi dan akses menuju Sagara Villas di pesisir pantai Bali yang tenang."
      : "Location guide and coastal surroundings for Sagara Villas Bali. Quiet beaches, dining, and arrivals.",
    alternates: {
      canonical: `/${locale}/location`,
      languages: {
        en: "/en/location",
        id: "/id/location",
      },
    },
  };
}

export default async function LocationPage({ params }: LocationPageProps) {
  const { locale } = await params;

  if (locale !== "en" && locale !== "id") {
    notFound();
  }

  const validLocale = locale as AppLocale;
  const dictionary = getMessages(validLocale).public;
  const lMessages = dictionary.locationPage;

  return (
    <div className="space-y-16 sm:space-y-24 py-12 sm:py-16">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center max-w-3xl space-y-4">
        <span className="font-sans text-xs font-semibold uppercase tracking-wider text-blue-600">
          {validLocale === "en" ? "Coastal Setting" : "Lingkungan Pesisir"}
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
          {lMessages.title}
        </h1>
        <p className="font-sans text-base sm:text-lg text-gray-600 leading-relaxed">
          {lMessages.subtitle}
        </p>
      </div>

      {/* Main Location Content */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left: Narrative & Guides */}
          <div className="lg:col-span-7 space-y-8">
            <div className="rounded-[8px] border border-gray-200 bg-white p-8 space-y-4 shadow-sm">
              <h2 className="font-display text-2xl font-bold text-gray-900">
                {lMessages.settingTitle}
              </h2>
              <p className="font-sans text-base text-gray-700 leading-relaxed">
                {lMessages.settingBody}
              </p>
            </div>

            {/* Getting Here Card */}
            <div className="rounded-[8px] border border-gray-200 bg-white p-8 space-y-4 shadow-sm">
              <div className="flex items-center gap-2.5 text-blue-600 font-semibold text-sm">
                <Plane className="h-5 w-5" />
                <span>{lMessages.gettingHereTitle}</span>
              </div>
              <p className="font-sans text-sm text-gray-700 leading-relaxed">
                {lMessages.airportNote}
              </p>
            </div>

            {/* Surroundings */}
            <div className="rounded-[8px] border border-gray-200 bg-white p-8 space-y-4 shadow-sm">
              <h2 className="font-display text-2xl font-bold text-gray-900">
                {lMessages.surroundingsTitle}
              </h2>
              <ul className="space-y-3 font-sans text-sm text-gray-700">
                <li className="flex items-center gap-3">
                  <Footprints className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>{lMessages.surrounding1}</span>
                </li>
                <li className="flex items-center gap-3">
                  <Car className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span>{lMessages.surrounding2}</span>
                </li>
                <li className="flex items-center gap-3">
                  <Compass className="h-4 w-4 text-sky-600 flex-shrink-0" />
                  <span>{lMessages.surrounding3}</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right: Illustrative Map Placeholder Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-[8px] border border-gray-200 bg-gradient-to-br from-teal-300/20 via-sky-50 to-blue-50 p-8 min-h-[380px] flex flex-col justify-between shadow-sm">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-white px-3 py-1 font-sans text-xs font-semibold text-gray-800 shadow-sm">
                  <MapPin className="h-3.5 w-3.5 text-rose-600" />
                  <span>Sagara Villas, Bali</span>
                </div>
                <h3 className="font-display text-2xl font-bold text-gray-900 pt-3">
                  {validLocale === "en" ? "Illustrative Coastal Map" : "Peta Ilustrasi Pesisir"}
                </h3>
                <p className="font-sans text-xs text-gray-600 leading-relaxed">
                  {validLocale === "en"
                    ? "Private coastal access road framed by palms. Exact villa coordinate pins and gate directions are issued upon confirmed stay."
                    : "Akses jalan pesisir privat di antara pepohonan kelapa. Titik koordinat dan petunjuk gerbang villa diberikan saat reservasi dikonfirmasi."}
                </p>
              </div>

              {/* Demo Notice Banner */}
              <div className="rounded-[6px] border border-amber-200 bg-amber-50/90 p-4 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-700" />
                <span>{lMessages.demoNotice}</span>
              </div>
            </div>

            <div className="p-6 rounded-[8px] bg-gray-900 text-white space-y-4">
              <h3 className="font-display text-xl font-bold">
                {validLocale === "en" ? "Plan Your Arrival" : "Rencanakan Kedatangan Anda"}
              </h3>
              <p className="font-sans text-xs text-gray-300 leading-relaxed">
                {validLocale === "en"
                  ? "Looking to check dates and submit a booking inquiry? Our team handles private requests personally."
                  : "Ingin memeriksa tanggal dan mengajukan pertanyaan pemesanan? Tim kami melayani permintaan secara langsung."}
              </p>
              <Link
                href={`/${validLocale}/book`}
                className="inline-flex items-center gap-2 font-sans text-xs font-semibold text-blue-300 hover:text-white"
              >
                <span>{dictionary.requestBooking}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
