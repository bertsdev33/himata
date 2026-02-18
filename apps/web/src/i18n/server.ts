import i18next from "i18next";
import { defaultLocale, namespaces, type Locale } from "./config";
import { resources } from "./resources";

/**
 * Create a fresh i18next instance for each Astro page render.
 */
export async function createServerI18n(locale: Locale) {
  const instance = i18next.createInstance();

  await instance.init({
    resources,
    lng: locale,
    fallbackLng: defaultLocale,
    ns: [...namespaces],
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });

  return instance;
}
