"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { setAdminLocaleAction } from "@/lib/i18n/admin-locale";
import type { SupportedLocale } from "@/lib/i18n/messages";

export function LanguageToggle({
  locale,
  label = "Language",
}: {
  locale: SupportedLocale;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  function handleSelectLocale(nextLocale: SupportedLocale) {
    if (nextLocale === locale) return;
    startTransition(async () => {
      await setAdminLocaleAction(nextLocale);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex h-11 items-center gap-1 rounded-[6px] border border-gray-100 bg-gray-100 p-1 font-sans text-xs font-medium"
    >
      <Globe className="ml-1.5 h-3.5 w-3.5 text-gray-600" aria-hidden="true" />
      <button
        type="button"
        disabled={isPending}
        aria-pressed={locale === "en"}
        onClick={() => handleSelectLocale("en")}
        className={`min-h-8 rounded-[4px] px-2.5 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
          locale === "en" ? "bg-blue-600 text-white" : "text-gray-800 hover:bg-white"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        disabled={isPending}
        aria-pressed={locale === "id"}
        onClick={() => handleSelectLocale("id")}
        className={`min-h-8 rounded-[4px] px-2.5 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
          locale === "id" ? "bg-blue-600 text-white" : "text-gray-800 hover:bg-white"
        }`}
      >
        ID
      </button>
    </div>
  );
}
