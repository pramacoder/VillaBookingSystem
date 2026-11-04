import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { listPublicUnits } from "@/server/services/unit-service";
import { BookingForm } from "@/components/public/booking-form";
import type { AppLocale } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/messages";

interface BookPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    unit?: string;
    checkIn?: string;
    checkOut?: string;
    adults?: string;
    children?: string;
  }>;
}

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === "id";
  return {
    title: isId
      ? "Ajukan Permintaan Reservasi — Sagara Villas Bali"
      : "Request a Booking — Sagara Villas Bali",
    description: isId
      ? "Kirimkan permintaan reservasi villa di Sagara Villas Bali. Tim kami akan memverifikasi ketersediaan dan membalas secara langsung."
      : "Submit a booking inquiry for your stay at Sagara Villas Bali. Our resident team verifies availability and confirms personally.",
    alternates: {
      canonical: `/${locale}/book`,
      languages: {
        en: "/en/book",
        id: "/id/book",
      },
    },
  };
}

export default async function BookPage({ params, searchParams }: BookPageProps) {
  const { locale } = await params;

  if (locale !== "en" && locale !== "id") {
    notFound();
  }

  const validLocale = locale as AppLocale;
  const dictionary = getMessages(validLocale).public;
  const bMessages = dictionary.bookPage;

  const sp = await searchParams;
  const units = await listPublicUnits(db, validLocale);

  const parsedAdults = sp.adults ? parseInt(sp.adults, 10) : 2;
  const parsedChildren = sp.children ? parseInt(sp.children, 10) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 space-y-12">
      {/* Header */}
      <div className="border-b border-gray-100 pb-8 text-center max-w-2xl mx-auto space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
          {bMessages.title}
        </h1>
        <p className="font-sans text-base sm:text-lg text-gray-600 leading-relaxed">
          {bMessages.subtitle}
        </p>
      </div>

      {/* Form Container */}
      <BookingForm
        units={units}
        locale={validLocale}
        initialUnit={sp.unit}
        initialCheckIn={sp.checkIn}
        initialCheckOut={sp.checkOut}
        initialAdults={isNaN(parsedAdults) ? 2 : parsedAdults}
        initialChildren={isNaN(parsedChildren) ? 0 : parsedChildren}
      />
    </div>
  );
}
