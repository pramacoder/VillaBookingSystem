import enMessages from "../../../messages/en.json";
import idMessages from "../../../messages/id.json";

export type SupportedLocale = "en" | "id";
export type AppMessages = typeof enMessages;

const dictionaries: Record<SupportedLocale, AppMessages> = {
  en: enMessages,
  id: idMessages,
};

export function normalizeLocale(value: string | null | undefined): SupportedLocale {
  return value === "id" ? "id" : "en";
}

export function getMessages(locale: SupportedLocale = "en"): AppMessages {
  return dictionaries[locale] ?? dictionaries.en;
}
