import Link from "next/link";
import type { AppLocale } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/messages";

interface PublicFooterProps {
  locale: AppLocale;
}

export function PublicFooter({ locale }: PublicFooterProps) {
  const dictionary = getMessages(locale);
  const brand = dictionary.brand;
  const messages = dictionary.public;
  const navMessages = messages.nav;
  const footerMessages = messages.footer;

  return (
    <footer className="border-t border-gray-800 bg-gray-900 text-gray-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4 lg:gap-12">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-white">{brand.name}</h2>
            <p className="font-sans text-sm text-gray-400 max-w-md leading-relaxed">
              {brand.tagline}
            </p>
            <div className="rounded-[6px] border border-gray-800 bg-gray-800/60 p-4">
              <p className="font-sans text-xs text-amber-200/90 leading-relaxed font-medium">
                {brand.demoDisclosure}
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-gray-200">
              {footerMessages.navigation}
            </h3>
            <ul className="mt-4 space-y-3 font-sans text-sm">
              <li>
                <Link
                  href={`/${locale}/villas`}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {navMessages.villas}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/about`}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {navMessages.about}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/location`}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {navMessages.location}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/contact`}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {navMessages.contact}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/book`}
                  className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
                >
                  {navMessages.bookNow}
                </Link>
              </li>
            </ul>
          </div>

          {/* Operator / Staff & Legal */}
          <div>
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-gray-200">
              {footerMessages.legal}
            </h3>
            <p className="mt-4 font-sans text-xs text-gray-400 leading-relaxed">
              {locale === "en"
                ? "This website is an interactive demonstration built for technical evaluation. All units, rates, availability schedules, and reviews are simulated."
                : "Situs web ini merupakan demonstrasi interaktif untuk evaluasi teknis. Seluruh unit villa, tarif, jadwal ketersediaan, dan ulasan bersifat simulasi."}
            </p>
            <div className="mt-6 pt-4 border-t border-gray-800">
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-1.5 font-sans text-xs font-medium text-gray-400 hover:text-white transition-colors"
              >
                <span>🔒</span>
                <span>{footerMessages.adminLink}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-gray-800 pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-gray-400 gap-4">
          <p>© 2026 Sagara Villas. {footerMessages.rights}</p>
          <p className="text-gray-400">
            {locale === "en"
              ? "Property timezone: Asia/Makassar (WITA)"
              : "Zona waktu properti: Asia/Makassar (WITA)"}
          </p>
        </div>
      </div>
    </footer>
  );
}
