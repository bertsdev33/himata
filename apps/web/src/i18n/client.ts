import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultLocale, namespaces } from "./config";
import { resources } from "./resources";

/**
 * Ensure i18next is initialized exactly once on the client.
 */
export function ensureClientI18n() {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng: defaultLocale,
      fallbackLng: defaultLocale,
      ns: [...namespaces],
      defaultNS: "common",
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
  }

  return i18n;
}
