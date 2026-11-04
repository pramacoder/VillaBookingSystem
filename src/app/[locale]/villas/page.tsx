import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { listPublicUnits } from "@/server/services/unit-service";
import { UnitCard } from "@/components/public/unit-card";
import type { AppLocale } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/messages";

interface VillasPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: VillasPageProps): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === "id";
  return {
    title: isId
      ? "Katalog Villa — Sagara Villas Bali"
      : "Our Villa Collection — Sagara Villas Bali",
    description: isId
      ? "Jelajahi koleksi unit villa mandiri di pesisir pantai Bali. Lengkap dengan kolam renang pribadi dan taman tropis."
      : "Explore our collection of private coastal villa sanctuaries in Bali, featuring private pools and lush courtyards.",
    alternates: {
      canonical: `/${locale}/villas`,
      languages: {
        en: "/en/villas",
        id: "/id/villas",
      },
    },
  };
}

export default async function VillasPage({ params }: VillasPageProps) {
  const { locale } = await params;

  if (locale !== "en" && locale !== "id") {
    notFound();
  }

  const validLocale = locale as AppLocale;
  const dictionary = getMessages(validLocale).public;
  const vMessages = dictionary.villasPage;

  // Active units only (FR-02)
  const units = await listPublicUnits(db, validLocale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 space-y-12">
      {/* Header section */}
      <div className="border-b border-gray-100 pb-8 text-center max-w-3xl mx-auto space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
          {vMessages.title}
        </h1>
        <p className="font-sans text-base sm:text-lg text-gray-600 leading-relaxed">
          {vMessages.subtitle}
        </p>
      </div>

      {/* Catalog Grid */}
      {units.length === 0 ? (
        <div className="rounded-[8px] border border-gray-200 bg-gray-50 p-12 text-center">
          <p className="font-sans text-sm text-gray-600">
            {validLocale === "en"
              ? "No villas currently available in catalog."
              : "Belum ada villa yang tersedia di katalog saat ini."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {units.map((unit) => (
            <UnitCard key={unit.id} unit={unit} locale={validLocale} />
          ))}
        </div>
      )}
    </div>
  );
}
