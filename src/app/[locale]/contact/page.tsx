import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, Clock, MessageSquare, AlertCircle, ArrowRight } from "lucide-react";
import type { AppLocale } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/messages";

interface ContactPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === "id";
  return {
    title: isId
      ? "Kontak & Layanan — Sagara Villas Bali"
      : "Contact & Concierge — Sagara Villas Bali",
    description: isId
      ? "Hubungi tim konsier Sagara Villas Bali untuk pertanyaan seputar villa, ketersediaan, dan kedatangan."
      : "Contact the Sagara Villas Bali concierge team for private villa inquiries, dates, and arrivals.",
    alternates: {
      canonical: `/${locale}/contact`,
      languages: {
        en: "/en/contact",
        id: "/id/contact",
      },
    },
  };
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params;

  if (locale !== "en" && locale !== "id") {
    notFound();
  }

  const validLocale = locale as AppLocale;
  const dictionary = getMessages(validLocale).public;
  const cMessages = dictionary.contactPage;

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "+6281200000000";

  return (
    <div className="space-y-16 sm:space-y-24 py-12 sm:py-16">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center max-w-3xl space-y-4">
        <span className="font-sans text-xs font-semibold uppercase tracking-wider text-blue-600">
          {validLocale === "en" ? "Resident Concierge" : "Konsier Residen"}
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
          {cMessages.title}
        </h1>
        <p className="font-sans text-base sm:text-lg text-gray-600 leading-relaxed">
          {cMessages.subtitle}
        </p>
      </div>

      {/* Main Grid */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Direct Concierge Info */}
          <div className="rounded-[8px] border border-gray-200 bg-white p-8 sm:p-10 space-y-8 shadow-sm">
            <h2 className="font-display text-2xl font-bold text-gray-900 border-b border-gray-100 pb-4">
              {cMessages.contactInfoTitle}
            </h2>

            <div className="space-y-6 text-sm">
              <div className="flex items-start gap-3.5">
                <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-900 block">
                    {cMessages.inquiryHours}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {validLocale === "en"
                      ? "Property Timezone: Asia/Makassar (WITA)"
                      : "Zona Waktu Properti: Asia/Makassar (WITA)"}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-900 block">{cMessages.emailLabel}</span>
                  <span className="font-mono text-xs text-gray-600">{cMessages.demoEmail}</span>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <Phone className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-900 block">{cMessages.phoneLabel}</span>
                  <span className="font-mono text-xs text-gray-600">{cMessages.demoPhone}</span>
                </div>
              </div>
            </div>

            {/* WhatsApp Link button */}
            <div className="pt-2">
              <a
                href={`https://wa.me/${whatsappNumber.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
                  validLocale === "en"
                    ? "Hello Sagara Villas, I would like to inquire about booking a stay."
                    : "Halo Sagara Villas, saya ingin menanyakan perihal reservasi villa.",
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-[6px] bg-emerald-600 py-3 font-sans text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                <span>
                  {validLocale === "en"
                    ? "Chat on WhatsApp (Demo)"
                    : "Chat melalui WhatsApp (Demo)"}
                </span>
              </a>
            </div>

            {/* Demo disclaimer */}
            <div className="rounded-[6px] border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-700" />
              <span>{cMessages.demoNotice}</span>
            </div>
          </div>

          {/* Booking Inquiry Callout */}
          <div className="rounded-[8px] bg-gray-900 text-white p-8 sm:p-10 space-y-6">
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              {validLocale === "en" ? "Ready to Plan a Stay?" : "Ingin Mengajukan Reservasi?"}
            </h2>
            <p className="font-sans text-sm text-gray-300 leading-relaxed">
              {validLocale === "en"
                ? "The fastest way to verify availability for specific dates is to submit an online booking request. Our team checks the live calendar directly."
                : "Cara tercepat untuk memverifikasi ketersediaan pada tanggal pilihan Anda adalah dengan mengajukan permintaan reservasi online."}
            </p>

            <div className="pt-4">
              <Link
                href={`/${validLocale}/book`}
                className="inline-flex items-center gap-2 rounded-[6px] bg-blue-600 px-6 py-3 font-sans text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                <span>{dictionary.requestBooking}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
