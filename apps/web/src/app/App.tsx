import { useReducer } from "react";
import { AppContext, appReducer, initialState } from "./state";
import { SettingsContext } from "./settings-context";
import { useSettings } from "@/hooks/useSettings";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import { UploadPage } from "@/components/upload/UploadPage";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

interface AppProps {
  locale?: Locale;
}

export default function App({ locale: astroLocale }: AppProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const settingsValue = useSettings();
  const locale: Locale = astroLocale ?? settingsValue.settings.locale ?? defaultLocale;

  const handleLocaleChange = (newLocale: Locale) => {
    settingsValue.update({ locale: newLocale });

    const segments = window.location.pathname.split("/").filter(Boolean);
    const first = segments[0] as Locale | undefined;
    const pathSegments = first && locales.includes(first) ? segments.slice(1) : segments;
    const suffix = pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "/";
    const nextPath = newLocale === defaultLocale ? suffix : `/${newLocale}${suffix === "/" ? "" : suffix}`;
    const nextUrl = `${nextPath}${window.location.search}${window.location.hash}`;

    window.location.href = nextUrl;
  };

  return (
    <LocaleProvider initialLocale={locale} onLocaleChange={handleLocaleChange}>
      <AppContext.Provider value={{ state, dispatch }}>
        <SettingsContext.Provider value={settingsValue}>
          {state.phase === "upload" ? <UploadPage /> : <DashboardLayout />}
        </SettingsContext.Provider>
      </AppContext.Provider>
    </LocaleProvider>
  );
}
