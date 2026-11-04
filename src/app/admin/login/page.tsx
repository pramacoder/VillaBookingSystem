import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { LoginForm } from "@/components/admin/login-form";
import { getAdminAuthDictionary, type SupportedLocale } from "@/lib/i18n/admin-dictionaries";

interface AdminLoginPageProps {
  searchParams: Promise<{ lang?: string }>;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/admin");
  }

  const resolvedParams = await searchParams;
  const locale: SupportedLocale = resolvedParams.lang === "id" ? "id" : "en";
  const dict = getAdminAuthDictionary(locale);

  return (
    <main className="flex min-h-screen flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-300 px-3 py-1 text-xs font-medium text-gray-800">
            <span aria-hidden="true">●</span>
            <span>{dict.adminBadge}</span>
          </div>
          <nav
            aria-label="Language switcher"
            className="flex items-center gap-2 text-xs font-medium text-gray-600"
          >
            <Link
              href="/admin/login?lang=en"
              className={`rounded px-2 py-1 ${
                locale === "en" ? "bg-blue-600 text-white" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              EN
            </Link>
            <Link
              href="/admin/login?lang=id"
              className={`rounded px-2 py-1 ${
                locale === "id" ? "bg-blue-600 text-white" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              ID
            </Link>
          </nav>
        </div>

        <section
          aria-labelledby="login-heading"
          className="rounded-[10px] border border-gray-400/40 bg-white p-8 shadow-sm"
        >
          <p className="text-xs font-medium tracking-[0.08em] text-blue-600 uppercase">
            {dict.login.eyebrow}
          </p>
          <h1 id="login-heading" className="mt-2 font-display text-3xl font-semibold text-gray-800">
            {dict.login.title}
          </h1>
          <p className="mt-2 text-sm text-gray-600">{dict.login.subtitle}</p>

          <div className="mt-6">
            <LoginForm dictionary={dict.login} />
          </div>

          <p className="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-600">
            {dict.login.demoNotice}
          </p>
        </section>
      </div>
    </main>
  );
}
