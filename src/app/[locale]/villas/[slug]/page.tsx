import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { getPublicUnitBySlug } from "@/server/services/unit-service";
import { UnitDetailClient } from "@/components/public/unit-detail-client";
import type { AppLocale } from "@/lib/i18n/messages";

interface UnitDetailPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: UnitDetailPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const isId = locale === "id";
  const validLocale = (locale === "id" ? "id" : "en") as AppLocale;

  try {
    const unit = await getPublicUnitBySlug(db, slug, validLocale);
    return {
      title: `${unit.name} — Sagara Villas Bali`,
      description: unit.summary,
      alternates: {
        canonical: `/${validLocale}/villas/${unit.slug}`,
        languages: {
          en: `/en/villas/${unit.slug}`,
          id: `/id/villas/${unit.slug}`,
        },
      },
    };
  } catch {
    return {
      title: isId ? "Villa Tidak Ditemukan — Sagara Villas" : "Villa Not Found — Sagara Villas",
    };
  }
}

export default async function UnitDetailPage({ params }: UnitDetailPageProps) {
  const { locale, slug } = await params;

  if (locale !== "en" && locale !== "id") {
    notFound();
  }

  const validLocale = locale as AppLocale;

  let unit;
  try {
    unit = await getPublicUnitBySlug(db, slug, validLocale);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <UnitDetailClient unit={unit} locale={validLocale} />
    </div>
  );
}
