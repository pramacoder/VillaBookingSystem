"use server";

import { cookies } from "next/headers";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n/messages";

const ADMIN_LOCALE_COOKIE_NAME = "sagara_admin_locale";

export async function getAdminLocale(): Promise<SupportedLocale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_LOCALE_COOKIE_NAME)?.value;
  return normalizeLocale(raw);
}

export async function setAdminLocaleAction(locale: SupportedLocale): Promise<void> {
  const normalized = normalizeLocale(locale);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_LOCALE_COOKIE_NAME, normalized, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 365 * 24 * 60 * 60,
  });
}
