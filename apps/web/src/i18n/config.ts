export const defaultLocale = "en" as const;
export const locales = ["en", "es", "fr"] as const;
export type Locale = (typeof locales)[number];

export const localeLabels: Record<Locale, string> = {
  en: "English",
  es: "Espanol",
  fr: "Francais",
};

/** BCP-47 tags for Intl.NumberFormat / Intl.DateTimeFormat. */
export const intlLocaleMap: Record<Locale, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
};

export const namespaces = [
  "common",
  "dashboard",
  "upload",
  "forecast",
  "cashflow",
  "settings",
  "data-quality",
  "insights",
  "errors",
] as const;

export type Namespace = (typeof namespaces)[number];
