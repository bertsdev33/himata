import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { ensureClientI18n } from "./client";
import { defaultLocale, locales, type Locale } from "./config";

ensureClientI18n();

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
});

interface LocaleProviderProps {
  initialLocale: Locale;
  onLocaleChange: (locale: Locale) => void;
  children: ReactNode;
}

export function LocaleProvider({
  initialLocale,
  onLocaleChange,
  children,
}: LocaleProviderProps) {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language !== initialLocale) {
      i18n.changeLanguage(initialLocale);
    }
  }, [i18n, initialLocale]);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      if (!locales.includes(newLocale) || newLocale === i18n.language) return;
      i18n.changeLanguage(newLocale);
      onLocaleChange(newLocale);
    },
    [i18n, onLocaleChange],
  );

  const value = useMemo(
    () => ({ locale: initialLocale, setLocale }),
    [initialLocale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocaleContext() {
  return useContext(LocaleContext);
}
