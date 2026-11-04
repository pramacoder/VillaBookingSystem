import Link from "next/link";
import { Bed, Bath, Users, Maximize2 } from "lucide-react";
import type { PublicUnitSummary } from "@/server/services/unit-service";
import type { AppLocale } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/messages";
import { formatIdr } from "@/lib/money";

interface UnitCardProps {
  unit: PublicUnitSummary;
  locale: AppLocale;
}

export function UnitCard({ unit, locale }: UnitCardProps) {
  const dictionary = getMessages(locale).public;
  const vMessages = dictionary.villasPage;

  return (
    <article className="group flex flex-col overflow-hidden rounded-[8px] border border-gray-100 bg-white transition-all hover:border-gray-300 hover:shadow-md">
      {/* Visual / Image (4:5 ratio) */}
      <Link
        href={`/${locale}/villas/${unit.slug}`}
        className="relative block aspect-[4/5] w-full overflow-hidden bg-gradient-to-b from-gray-100 to-gray-200"
        tabIndex={-1}
        aria-hidden="true"
      >
        {unit.coverImage?.path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={unit.coverImage.path}
            alt={unit.coverImage.alt}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center bg-gradient-to-tr from-teal-300/20 via-sky-50 to-blue-50">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80 shadow-sm text-gray-700">
              <span className="font-display text-2xl font-bold">SV</span>
            </div>
            <p className="mt-4 font-display text-lg font-semibold text-gray-800">{unit.name}</p>
            <p className="font-sans text-xs text-gray-500 mt-1 uppercase tracking-wider">
              {locale === "en" ? "Coastal Villa Sanctuary" : "Suaka Villa Pesisir"}
            </p>
          </div>
        )}

        {/* Featured tag if featured */}
        {unit.isFeatured && (
          <div className="absolute top-3 left-3 rounded-[4px] bg-white/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-800 shadow-sm">
            {locale === "en" ? "Featured" : "Pilihan"}
          </div>
        )}
      </Link>

      {/* Card Content */}
      <div className="flex flex-1 flex-col p-5 sm:p-6 justify-between">
        <div>
          <h3 className="font-display text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
            <Link href={`/${locale}/villas/${unit.slug}`}>{unit.name}</Link>
          </h3>
          <p className="mt-2 font-sans text-sm text-gray-600 line-clamp-2 leading-relaxed">
            {unit.summary}
          </p>

          {/* Quick Specifications */}
          <div className="mt-4 grid grid-cols-2 gap-2 border-y border-gray-100 py-3 text-xs text-gray-600">
            <div className="flex items-center gap-1.5">
              <Bed className="h-4 w-4 text-gray-400" aria-hidden="true" />
              <span>
                {unit.bedrooms}{" "}
                {locale === "en" ? (unit.bedrooms === 1 ? "Bedroom" : "Bedrooms") : "Kamar Tidur"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Bath className="h-4 w-4 text-gray-400" aria-hidden="true" />
              <span>
                {unit.bathrooms}{" "}
                {locale === "en"
                  ? unit.bathrooms === 1
                    ? "Bathroom"
                    : "Bathrooms"
                  : "Kamar Mandi"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-gray-400" aria-hidden="true" />
              <span>
                {locale === "en"
                  ? `Up to ${unit.maxGuests} guests`
                  : `Hingga ${unit.maxGuests} tamu`}
              </span>
            </div>

            {unit.areaSqm ? (
              <div className="flex items-center gap-1.5">
                <Maximize2 className="h-4 w-4 text-gray-400" aria-hidden="true" />
                <span>{unit.areaSqm} m²</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Pricing & CTA */}
        <div className="mt-5 flex items-center justify-between pt-2">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-sans text-xs text-gray-500">
                {locale === "en" ? "From" : "Mulai"}
              </span>
              <span className="font-display text-xl font-bold text-gray-900 tabular-nums">
                {formatIdr(unit.baseRateIdr, locale)}
              </span>
              <span className="font-sans text-xs text-gray-500">
                / {locale === "en" ? "night" : "malam"}
              </span>
            </div>
            <div className="mt-0.5">
              <span className="inline-block rounded-[4px] bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                {vMessages.demoRateBadge}
              </span>
            </div>
          </div>

          <Link
            href={`/${locale}/villas/${unit.slug}`}
            className="rounded-[6px] border border-gray-300 bg-white px-3.5 py-2 font-sans text-xs font-semibold text-gray-800 hover:border-gray-800 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {vMessages.viewVilla}
          </Link>
        </div>
      </div>
    </article>
  );
}
