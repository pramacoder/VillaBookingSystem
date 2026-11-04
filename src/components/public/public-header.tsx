"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Globe, Menu, X } from "lucide-react";
import type { AppLocale } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/messages";

interface PublicHeaderProps {
  locale: AppLocale;
}

export function PublicHeader({ locale }: PublicHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const messages = getMessages(locale).public;
  const navMessages = messages.nav;

  // Compute other locale path preserving sub-path and search params
  const targetLocale: AppLocale = locale === "en" ? "id" : "en";
  let targetPath = pathname.replace(new RegExp(`^/${locale}(/|$)`), `/${targetLocale}$1`);
  if (!targetPath.startsWith(`/${targetLocale}`)) {
    targetPath = `/${targetLocale}`;
  }
  const searchString = searchParams.toString();
  const langSwitchUrl = searchString ? `${targetPath}?${searchString}` : targetPath;

  // Close mobile menu on escape key
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu open
  React.useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { href: `/${locale}`, label: navMessages.home },
    { href: `/${locale}/villas`, label: navMessages.villas },
    { href: `/${locale}/about`, label: navMessages.about },
    { href: `/${locale}/location`, label: navMessages.location },
    { href: `/${locale}/contact`, label: navMessages.contact },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white/95 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <Link
          href={`/${locale}`}
          className="group flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-[4px]"
        >
          <span className="font-display text-2xl font-semibold tracking-tight text-gray-900 group-hover:text-blue-600 transition-colors">
            Sagara Villas
          </span>
          <span className="font-sans text-[11px] uppercase tracking-wider text-gray-500">
            Bali Coastal Retreat
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav aria-label="Main Navigation" className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => {
            const isActive =
              link.href === `/${locale}`
                ? pathname === `/${locale}`
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`font-sans text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-[4px] px-1 py-0.5 ${
                  isActive ? "text-blue-600 font-semibold" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions (Language Switch + Book Button) */}
        <div className="hidden md:flex items-center space-x-5">
          {/* Language Switcher */}
          <Link
            href={langSwitchUrl}
            className="flex items-center gap-1.5 rounded-[6px] border border-gray-200 px-2.5 py-1.5 font-sans text-xs font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label={`Switch language to ${targetLocale === "en" ? "English" : "Bahasa Indonesia"}`}
          >
            <Globe className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
            <span className={locale === "en" ? "font-bold text-blue-600" : "text-gray-500"}>
              EN
            </span>
            <span className="text-gray-300">/</span>
            <span className={locale === "id" ? "font-bold text-blue-600" : "text-gray-500"}>
              ID
            </span>
          </Link>

          {/* Primary CTA */}
          <Link
            href={`/${locale}/book`}
            className="rounded-[6px] bg-blue-600 px-4 py-2.5 font-sans text-sm font-medium text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            {navMessages.bookNow}
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center space-x-3 md:hidden">
          <Link
            href={langSwitchUrl}
            className="flex items-center gap-1 rounded-[6px] border border-gray-200 px-2 py-1 font-sans text-xs font-semibold text-gray-700"
            aria-label={`Switch language to ${targetLocale === "en" ? "English" : "Bahasa Indonesia"}`}
          >
            <span>{locale.toUpperCase()}</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-[6px] p-2 text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? navMessages.close : navMessages.menu}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          className="fixed inset-x-0 top-20 bottom-0 z-50 bg-white/95 backdrop-blur-md px-6 py-6 md:hidden overflow-y-auto border-t border-gray-100 flex flex-col justify-between"
        >
          <nav className="flex flex-col space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="font-display text-2xl font-semibold text-gray-800 hover:text-blue-600 py-1"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="pt-8 border-t border-gray-200 space-y-4">
            <Link
              href={`/${locale}/book`}
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full text-center rounded-[6px] bg-blue-600 py-3 font-sans text-base font-medium text-white shadow-sm hover:bg-blue-700"
            >
              {navMessages.bookNow}
            </Link>

            <div className="flex items-center justify-center pt-2">
              <Link
                href={langSwitchUrl}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 text-sm font-medium text-gray-600"
              >
                <Globe className="h-4 w-4" />
                <span>{locale === "en" ? "Ganti ke Bahasa Indonesia" : "Switch to English"}</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
