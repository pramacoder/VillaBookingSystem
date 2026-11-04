import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Sun, Waves } from "lucide-react";
import type { AppLocale } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/messages";

interface AboutPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === "id";
  return {
    title: isId ? "Tentang Kami — Sagara Villas Bali" : "About Us — Sagara Villas Bali",
    description: isId
      ? "Kisah filosofi arsitektur dan keramahan tenang Sagara Villas di pesisir pantai Bali."
      : "The philosophy of mindful coastal hospitality, natural architecture, and tranquility at Sagara Villas Bali.",
    alternates: {
      canonical: `/${locale}/about`,
      languages: {
        en: "/en/about",
        id: "/id/about",
      },
    },
  };
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;

  if (locale !== "en" && locale !== "id") {
    notFound();
  }

  const validLocale = locale as AppLocale;
  const dictionary = getMessages(validLocale).public;
  const aMessages = dictionary.aboutPage;

  return (
    <div className="space-y-16 sm:space-y-24 py-12 sm:py-16">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center max-w-3xl space-y-4">
        <span className="font-sans text-xs font-semibold uppercase tracking-wider text-blue-600">
          {validLocale === "en" ? "Our Story & Vision" : "Kisah & Visi Kami"}
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
          {aMessages.title}
        </h1>
        <p className="font-sans text-base sm:text-lg text-gray-600 leading-relaxed">
          {aMessages.subtitle}
        </p>
      </div>

      {/* Philosophy Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {aMessages.storyTitle}
            </h2>
            <p className="font-sans text-base text-gray-700 leading-relaxed">{aMessages.storyP1}</p>
            <p className="font-sans text-base text-gray-700 leading-relaxed">{aMessages.storyP2}</p>
          </div>

          <div className="lg:col-span-6">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[8px] bg-gradient-to-tr from-teal-300/30 via-sky-50 to-blue-50 border border-gray-100 p-8 flex flex-col justify-end">
              <div className="bg-white/90 backdrop-blur-sm p-6 rounded-[6px] border border-gray-100 shadow-sm space-y-2">
                <p className="font-display text-xl font-bold text-gray-900">
                  {validLocale === "en"
                    ? "Calm Stays, Close to the Shore"
                    : "Menginap Tenang di Tepi Pantai"}
                </p>
                <p className="font-sans text-xs text-gray-600">
                  {validLocale === "en"
                    ? "Standalone units framed by frangipani trees and natural sea breezes."
                    : "Unit mandiri di kelilingi pohon kamboja dan semilir angin laut yang asri."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Two Columns: Architecture & Hospitality */}
      <section className="bg-gray-50 py-16 border-y border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
            <div className="rounded-[8px] border border-gray-200 bg-white p-8 space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Sun className="h-6 w-6" />
              </div>
              <h2 className="font-display text-2xl font-bold text-gray-900">
                {aMessages.architectureTitle}
              </h2>
              <p className="font-sans text-sm text-gray-600 leading-relaxed">
                {aMessages.architectureBody}
              </p>
            </div>

            <div className="rounded-[8px] border border-gray-200 bg-white p-8 space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-emerald-700">
                <Waves className="h-6 w-6" />
              </div>
              <h2 className="font-display text-2xl font-bold text-gray-900">
                {aMessages.hospitalityTitle}
              </h2>
              <p className="font-sans text-sm text-gray-600 leading-relaxed">
                {aMessages.hospitalityBody}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <Link
          href={`/${validLocale}/villas`}
          className="inline-flex items-center gap-2 rounded-[6px] bg-blue-600 px-8 py-3.5 font-sans text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <span>{dictionary.nav.villas}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
