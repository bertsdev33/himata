export const defaultLocale = "en" as const;
export const locales = ["en", "es", "fr", "zh"] as const;
export type Locale = (typeof locales)[number];

export const localeLabels: Record<Locale, string> = {
  en: "English",
  es: "Espanol",
  fr: "Francais",
  zh: "中文",
};

/** BCP-47 tags for Intl.NumberFormat / Intl.DateTimeFormat. */
export const intlLocaleMap: Record<Locale, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  zh: "zh-CN",
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
