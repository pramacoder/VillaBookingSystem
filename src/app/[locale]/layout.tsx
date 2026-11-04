import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import type { AppLocale } from "@/lib/i18n/messages";

interface PublicLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function PublicLayout({ children, params }: PublicLayoutProps) {
  const { locale } = await params;

  if (locale !== "en" && locale !== "id") {
    notFound();
  }

  const validLocale = locale as AppLocale;

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-800 antialiased selection:bg-blue-100 selection:text-blue-900">
      <PublicHeader locale={validLocale} />
      <main className="flex-1">{children}</main>
      <PublicFooter locale={validLocale} />
    </div>
  );
}