# Internationalization Plan — Rental Analytics (Final)

> Consolidated plan after multi-agent review and codebase-aware feedback.
> Covers: library choices, architecture, migration of existing code, and commit strategy.

---

## 0. Target Languages

| Code | Language             | Rationale                                          |
|------|----------------------|----------------------------------------------------|
| `en` | English              | Default / primary                                  |
| `es` | Spanish              | ~42 M native speakers in the US                    |
| `fr` | French               | Significant in Canada, Louisiana, Haiti diaspora   |
| `zh` | Chinese (Simplified) | ~3.5 M speakers in the US; fastest-growing segment |

RTL support (Arabic, Hebrew) is explicitly deferred. Nothing in this plan blocks adding it later.
If you ever want to swap `zh` for `vi` (Vietnamese) or `tl` (Tagalog), the architecture stays
identical.

---

## 1. Understanding the Actual App Architecture

The app is **primarily a single-page React application** with Astro serving as a thin shell
(one `index.astro` page that mounts a full React component tree). This is NOT a multi-page
Astro site with small React islands.

This means:

- **Locale must live in React context**, not be passed via Astro props through 20+ components
- The `views/` pattern is still useful for any future Astro pages, but the primary locale
  delivery mechanism is a `LocaleProvider` React context
- Existing infrastructure like `SettingsData` (localStorage) already handles user preferences
  and should be the persistence layer for locale
- An existing `format.ts` with 6 formatters hardcoded to `"en-US"` must be migrated, not
  duplicated

---

## 2. URL Strategy

Use Astro's built-in i18n routing with `prefixDefaultLocale: false`:

| Locale | URL Pattern      |
|--------|------------------|
| `en`   | `/`              |
| `es`   | `/es/`           |
| `fr`   | `/fr/`           |
| `zh`   | `/zh/`           |

Since the app is essentially one page, the routing is simple. English stays clean (no prefix).

**`apps/web/astro.config.mjs`**

```js
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://your-domain.com",  // REQUIRED for hreflang absolute URLs
  integrations: [react(), tailwind()],
  i18n: {
    defaultLocale: "en",
    locales: ["en", "es", "fr", "zh"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
```

Note: `site` must be configured here — hreflang tags need absolute URLs.

---

## 3. Libraries

Install in `apps/web`:

```bash
cd apps/web
bun add i18next react-i18next
```

That's it. Two packages.

| Library          | Purpose                                              |
|------------------|------------------------------------------------------|
| `i18next`        | Translation engine — shared across Astro AND React   |
| `react-i18next`  | React adapter (`useTranslation()` hook)              |
| `Intl` (built-in)| Currency, date, percent formatting — no library needed|

**Why i18next everywhere (not a custom function for Astro)?**
Using i18next for both Astro pages and React islands gives you one translation engine, one
interpolation syntax, one fallback chain, and one pluralization story.

**Optional later:**

```bash
bun add -d i18next-resources-to-backend  # lazy-load JSON when translations grow large
```

---

## 4. File Layout

```
apps/web/src/
├── i18n/
│   ├── config.ts              # Locale constants, types, labels
│   ├── resources.ts           # Static JSON imports → i18next resources object
│   ├── server.ts              # createInstance() for Astro pages (one per render)
│   ├── client.ts              # Singleton init for React islands
│   ├── LocaleProvider.tsx     # React context for locale (THE primary delivery mechanism)
│   └── locales/
│       ├── en/
│       │   ├── common.json
│       │   ├── dashboard.json
│       │   ├── upload.json
│       │   ├── forecast.json
│       │   ├── cashflow.json
│       │   ├── settings.json
│       │   ├── data-quality.json
│       │   ├── insights.json
│       │   └── errors.json
│       ├── es/ (same files)
│       ├── fr/ (same files)
│       └── zh/ (same files)
├── lib/
│   └── format.ts              # MIGRATED: all functions now accept locale parameter
├── views/
│   └── HomeView.astro         # Shared view (for any future Astro pages)
├── pages/
│   ├── index.astro            # English (default)
│   ├── es/index.astro         # Spanish wrapper
│   ├── fr/index.astro         # French wrapper
│   └── zh/index.astro         # Chinese wrapper
├── layouts/
│   └── Layout.astro           # <html lang=...>, hreflang, language switcher
└── components/
    ├── LanguageSwitcher.astro  # For the Astro shell (no hydration)
    └── react/
        ├── App.tsx             # Wraps children in <LocaleProvider>
        └── ...                 # All components access locale via useLocaleContext()
```

---

## 5. Locale Config (Single Source of Truth)

**`src/i18n/config.ts`**

```ts
export const defaultLocale = "en" as const;
export const locales = ["en", "es", "fr", "zh"] as const;
export type Locale = (typeof locales)[number];

export const localeLabels: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  zh: "中文",
};

/** BCP-47 tags for Intl.NumberFormat / Intl.DateTimeFormat */
export const intlLocaleMap: Record<Locale, string> = {
  en: "en-US",
  es: "es-US",
  fr: "fr-US",
  zh: "zh-Hans",
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
```

### Namespace mapping (covers the full app)

| Namespace       | Contents                                                  |
|-----------------|-----------------------------------------------------------|
| `common`        | Nav, actions, buttons, empty states, generic labels       |
| `dashboard`     | KPI cards, listing comparison, monthly breakdown table    |
| `upload`        | Upload flow copy, file validation messages                |
| `forecast`      | Forecast tab, ML forecast section, projection labels      |
| `cashflow`      | Cashflow tab, income/expense categories                   |
| `settings`      | Settings tab, preference labels, toggles                  |
| `data-quality`  | Data quality tab, warnings panel, validation messages     |
| `insights`      | Rule-based insight descriptions, severity labels          |
| `errors`        | Shared error messages, fallbacks, network errors          |

The reviewing agent correctly noted that 5 namespaces would make `dashboard.json` a dumping
ground. Nine namespaces aligned to actual UI tabs/areas keeps each file focused and
maintainable.

---

## 6. Translation Resources

**`src/i18n/resources.ts`**

```ts
// Static imports — bundled at build time, zero runtime cost.
//
// Yes, this is verbose at 36 imports (9 namespaces × 4 locales).
// This is a known stepping stone. When this becomes unwieldy, swap to
// i18next-resources-to-backend with dynamic import(). The rest of the
// architecture stays unchanged.

import en_common from "./locales/en/common.json";
import en_dashboard from "./locales/en/dashboard.json";
import en_upload from "./locales/en/upload.json";
import en_forecast from "./locales/en/forecast.json";
import en_cashflow from "./locales/en/cashflow.json";
import en_settings from "./locales/en/settings.json";
import en_dataQuality from "./locales/en/data-quality.json";
import en_insights from "./locales/en/insights.json";
import en_errors from "./locales/en/errors.json";

import es_common from "./locales/es/common.json";
import es_dashboard from "./locales/es/dashboard.json";
import es_upload from "./locales/es/upload.json";
import es_forecast from "./locales/es/forecast.json";
import es_cashflow from "./locales/es/cashflow.json";
import es_settings from "./locales/es/settings.json";
import es_dataQuality from "./locales/es/data-quality.json";
import es_insights from "./locales/es/insights.json";
import es_errors from "./locales/es/errors.json";

import fr_common from "./locales/fr/common.json";
import fr_dashboard from "./locales/fr/dashboard.json";
import fr_upload from "./locales/fr/upload.json";
import fr_forecast from "./locales/fr/forecast.json";
import fr_cashflow from "./locales/fr/cashflow.json";
import fr_settings from "./locales/fr/settings.json";
import fr_dataQuality from "./locales/fr/data-quality.json";
import fr_insights from "./locales/fr/insights.json";
import fr_errors from "./locales/fr/errors.json";

import zh_common from "./locales/zh/common.json";
import zh_dashboard from "./locales/zh/dashboard.json";
import zh_upload from "./locales/zh/upload.json";
import zh_forecast from "./locales/zh/forecast.json";
import zh_cashflow from "./locales/zh/cashflow.json";
import zh_settings from "./locales/zh/settings.json";
import zh_dataQuality from "./locales/zh/data-quality.json";
import zh_insights from "./locales/zh/insights.json";
import zh_errors from "./locales/zh/errors.json";

export const resources = {
  en: {
    common: en_common,
    dashboard: en_dashboard,
    upload: en_upload,
    forecast: en_forecast,
    cashflow: en_cashflow,
    settings: en_settings,
    "data-quality": en_dataQuality,
    insights: en_insights,
    errors: en_errors,
  },
  es: {
    common: es_common,
    dashboard: es_dashboard,
    upload: es_upload,
    forecast: es_forecast,
    cashflow: es_cashflow,
    settings: es_settings,
    "data-quality": es_dataQuality,
    insights: es_insights,
    errors: es_errors,
  },
  fr: {
    common: fr_common,
    dashboard: fr_dashboard,
    upload: fr_upload,
    forecast: fr_forecast,
    cashflow: fr_cashflow,
    settings: fr_settings,
    "data-quality": fr_dataQuality,
    insights: fr_insights,
    errors: fr_errors,
  },
  zh: {
    common: zh_common,
    dashboard: zh_dashboard,
    upload: zh_upload,
    forecast: zh_forecast,
    cashflow: zh_cashflow,
    settings: zh_settings,
    "data-quality": zh_dataQuality,
    insights: zh_insights,
    errors: zh_errors,
  },
} as const;
```

---

## 7. i18next Initialization

### 7A. Server-side (Astro shell): new instance per render

**`src/i18n/server.ts`**

```ts
import i18next from "i18next";
import { defaultLocale, namespaces, type Locale } from "./config";
import { resources } from "./resources";

/**
 * Create a fresh i18next instance for an Astro page render.
 *
 * Why createInstance() instead of a global singleton?
 * - Avoids shared mutable state if you ever add on-demand SSR
 * - Each render gets the correct language guaranteed
 * - i18next docs recommend createInstance() for server-side usage
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
```

### 7B. Client-side (React app): guarded singleton

**`src/i18n/client.ts`**

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultLocale, namespaces } from "./config";
import { resources } from "./resources";

/**
 * Ensure i18next is initialized exactly once on the client.
 * Called at the top of LocaleProvider before any rendering.
 *
 * The default language here is just a fallback — the real locale comes
 * from LocaleProvider, which reads it from SettingsData / URL / context.
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
```

---

## 8. LocaleProvider — React Context (Primary Locale Delivery)

This is the most important architectural piece. Since the app is a single-page React app,
locale must be available to every component without prop-drilling.

**`src/i18n/LocaleProvider.tsx`**

```tsx
import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { ensureClientI18n } from "./client";
import { defaultLocale, locales, type Locale } from "./config";

// Initialize i18next before any rendering
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
  onLocaleChange: (locale: Locale) => void; // parent handles persistence + URL nav
  children: ReactNode;
}

export function LocaleProvider({
  initialLocale,
  onLocaleChange,
  children,
}: LocaleProviderProps) {
  const { i18n } = useTranslation();

  const setLocale = useCallback(
    (newLocale: Locale) => {
      if (locales.includes(newLocale) && newLocale !== i18n.language) {
        i18n.changeLanguage(newLocale);
        onLocaleChange(newLocale);
      }
    },
    [i18n, onLocaleChange]
  );

  // Sync i18next language on mount if it doesn't match
  if (i18n.language !== initialLocale) {
    i18n.changeLanguage(initialLocale);
  }

  const value = useMemo(
    () => ({ locale: initialLocale, setLocale }),
    [initialLocale, setLocale]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocaleContext() {
  return useContext(LocaleContext);
}
```

### How it connects to the app

**In `apps/web/src/app/App.tsx`:**

The app already has `useSettings()` (from `@/hooks/useSettings`) providing `SettingsData`
via `SettingsContext`, and `useReducer` providing `AppContext`. The `LocaleProvider` wraps
both — it sits at the outermost layer so every component (including settings and app state
consumers) can access locale.

The locale prop comes from Astro (`<App client:load locale={locale} />`), which reads it
from `Astro.currentLocale`. This is the source of truth — do NOT re-parse the URL in React.

```tsx
import { useReducer } from "react";
import { AppContext, appReducer, initialState } from "./state";
import { SettingsContext } from "./settings-context";
import { useSettings } from "@/hooks/useSettings";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { defaultLocale, type Locale } from "@/i18n/config";
import { UploadPage } from "@/components/upload/UploadPage";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

interface AppProps {
  locale?: Locale;  // passed from Astro via <App client:load locale={locale} />
}

export default function App({ locale: astroLocale }: AppProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const settingsValue = useSettings();

  // Priority: Astro prop (from URL) > stored preference > default
  const locale: Locale =
    astroLocale ?? settingsValue.settings.locale ?? defaultLocale;

  const handleLocaleChange = (newLocale: Locale) => {
    // Persist to SettingsData (existing localStorage infrastructure)
    settingsValue.update({ locale: newLocale });

    // Navigate to the locale URL (full page navigation — Astro handles routing)
    const newPath =
      newLocale === defaultLocale ? "/" : `/${newLocale}/`;
    window.location.href = newPath;
  };

  return (
    <LocaleProvider
      initialLocale={locale}
      onLocaleChange={handleLocaleChange}
    >
      <AppContext.Provider value={{ state, dispatch }}>
        <SettingsContext.Provider value={settingsValue}>
          {state.phase === "upload" ? <UploadPage /> : <DashboardLayout />}
        </SettingsContext.Provider>
      </AppContext.Provider>
    </LocaleProvider>
  );
}
```

Note: `settingsValue.update()` is the existing `useSettings` hook's partial-update method
(see `apps/web/src/hooks/useSettings.ts`). Adding `locale?: Locale` to `SettingsData`
(Section 11) makes this work with zero changes to the hook itself.

### Using locale in any component (no prop-drilling)

```tsx
import { useTranslation } from "react-i18next";
import { useLocaleContext } from "../../i18n/LocaleProvider";
import { formatCurrency } from "../../lib/format";

export function KpiCard({ amount }: { amount: number }) {
  const { locale } = useLocaleContext();
  const { t } = useTranslation("dashboard", { lng: locale });

  return (
    <div>
      <span>{t("kpi.revenue")}</span>
      <span>{formatCurrency(amount, locale)}</span>
    </div>
  );
}
```

---

## 9. Migrating Existing `format.ts` (Not Replacing It)

The app already has `apps/web/src/lib/format.ts` with 6 formatting functions hardcoded to
`"en-US"`. **Do not create a parallel `i18n/formatters.ts`.** Instead, migrate the existing
file in place.

### Migration strategy

Add a `locale` parameter (with `"en"` default) to every function. This is backward-compatible:
existing call sites continue to work unchanged, and new/migrated call sites pass locale
explicitly.

### Before (current)

```ts
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatMonth(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return new Date(year, month - 1).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}
```

### After (migrated)

```ts
import { intlLocaleMap, defaultLocale, type Locale } from "../i18n/config";

/** Resolve BCP-47 tag from our Locale type. */
function resolveIntlLocale(locale: Locale = defaultLocale): string {
  return intlLocaleMap[locale] ?? "en-US";
}

export function formatCurrency(
  amount: number,
  locale?: Locale,
  currency = "USD"
): string {
  return new Intl.NumberFormat(resolveIntlLocale(locale), {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatPercent(value: number, locale?: Locale): string {
  return new Intl.NumberFormat(resolveIntlLocale(locale), {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format a YearMonth string ("2026-02") into a localized month label.
 *
 * IMPORTANT: This preserves the existing string-based signature that every
 * chart and table in the app uses. Do NOT change it to accept a Date object.
 */
export function formatMonth(ym: string, locale?: Locale): string {
  const [year, month] = ym.split("-").map(Number);
  return new Date(year, month - 1).toLocaleDateString(
    resolveIntlLocale(locale),
    { year: "numeric", month: "short" }
  );
}

export function formatDate(date: Date, locale?: Locale): string {
  return new Intl.DateTimeFormat(resolveIntlLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

// ... migrate remaining functions with the same pattern
```

### Key points

- `formatMonth` keeps its `string` (YearMonth) signature — no breaking change
- Every function gets `locale?: Locale` as an optional trailing parameter — backward-compatible
- No new file. One formatting system, not two.

---

## 10. Recharts Tooltip & Formatter Locale

Several chart components use `new Intl.NumberFormat("en-US", ...)` directly inside Recharts
formatter callbacks. These need locale access.

### The pattern

Recharts `Tooltip` and axis formatters are plain functions. They don't have access to React
hooks directly. The solution is to close over `locale` from the component scope:

```tsx
import { useLocaleContext } from "../../i18n/LocaleProvider";
import { useTranslation } from "react-i18next";
import { formatCurrency, formatMonth } from "../../lib/format";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

export function RevenueChart({ data }: { data: DataPoint[] }) {
  const { locale } = useLocaleContext();
  const { t } = useTranslation("dashboard", { lng: locale });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis
          dataKey="month"
          tickFormatter={(ym: string) => formatMonth(ym, locale)}
        />
        <YAxis
          tickFormatter={(val: number) => formatCurrency(val, locale)}
        />
        <Tooltip
          formatter={(value: number) => [
            formatCurrency(value, locale),
            t("chart.revenue_label"),
          ]}
          labelFormatter={(ym: string) => formatMonth(ym, locale)}
        />
        <Line dataKey="revenue" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

The key insight: `locale` is captured in the closure. Recharts formatter functions don't need
hooks — they just reference the `locale` variable from the enclosing component scope.

### Migration checklist for Recharts

Search the codebase for all hardcoded locale strings in chart components:

```bash
grep -rn '"en-US"' apps/web/src/components/
grep -rn 'Intl.NumberFormat' apps/web/src/components/
grep -rn 'tickFormatter' apps/web/src/components/
grep -rn 'formatter=' apps/web/src/components/
```

Replace each hardcoded `"en-US"` with the locale-aware formatter from `format.ts`.

---

## 11. SettingsData Locale Persistence

The app already stores settings in localStorage via `SettingsData`. Locale should be added
to this existing infrastructure — the plumbing is already there.

### Changes to SettingsData

In `apps/web/src/app/types.ts`, add `locale` to the existing `SettingsData` interface:

```ts
import type { Locale } from "@/i18n/config";

export interface SettingsData {
  version: 1;
  listingNames: Record<string, string>;
  accountNames: Record<string, string>;
  listingOrder: string[] | null;
  accountOrder: string[] | null;
  filterBarExpanded: boolean;
  mlForecastAutoRefresh: boolean;
  quickFilterPinnedTime: boolean;
  quickFilterPinnedAccounts: boolean;
  quickFilterPinnedListings: boolean;
  showAllQuickListings: boolean;
  locale?: Locale;  // NEW — optional for backward-compat with existing stored data
}
```

No changes needed to `useSettings()` hook (`apps/web/src/hooks/useSettings.ts`) — its
`update(patch: Partial<SettingsData>)` method already handles arbitrary partial updates,
and `loadSettings()` uses `{ ...defaultSettings, ...parsed }` which tolerates the missing
field in old stored data.

### Locale resolution priority

```
1. URL prefix (/es/, /fr/, /zh/)    — highest priority, explicit user navigation
2. SettingsData.locale               — stored preference from previous session
3. defaultLocale ("en")              — fallback
```

This means:

- Clicking the language switcher updates both the URL and SettingsData
- Returning to `/` (no prefix) checks SettingsData and can redirect client-side
- First-time visitors get English (no `Accept-Language` sniffing for alpha)

---

## 12. Astro Pages (Thin Wrappers)

Use `Astro.currentLocale` (computed automatically by Astro's i18n routing) as the source of
truth in the Astro shell.

**`src/pages/index.astro`** (English — default, no prefix)

```astro
---
import Layout from "../layouts/Layout.astro";
import { defaultLocale, type Locale } from "../i18n/config";
import App from "../components/react/App";

const locale = (Astro.currentLocale ?? defaultLocale) as Locale;
---

<Layout>
  <App client:load locale={locale} />
</Layout>
```

**`src/pages/es/index.astro`** (Spanish wrapper — identical structure)

```astro
---
import Layout from "../../layouts/Layout.astro";
import { defaultLocale, type Locale } from "../../i18n/config";
import App from "../../components/react/App";

const locale = (Astro.currentLocale ?? defaultLocale) as Locale;
---

<Layout>
  <App client:load locale={locale} />
</Layout>
```

Every locale wrapper is the same few lines. The only difference is the import path depth.

---

## 13. Layout with `lang`, `hreflang`, and Language Switcher

**`src/layouts/Layout.astro`**

```astro
---
import { getRelativeLocaleUrl } from "astro:i18n";
import { locales, defaultLocale, type Locale } from "../i18n/config";
import LanguageSwitcher from "../components/LanguageSwitcher.astro";

const locale = (Astro.currentLocale ?? defaultLocale) as Locale;

// Base path for hreflang (strip locale prefix if present)
const pathSegments = Astro.url.pathname.split("/").filter(Boolean);
const firstIsLocale = locales.includes(pathSegments[0] as Locale);
const basePath =
  "/" + (firstIsLocale ? pathSegments.slice(1).join("/") : pathSegments.join("/"));
---

<!doctype html>
<html lang={locale}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    {/* SEO: hreflang alternate links (requires site in astro.config.mjs) */}
    {locales.map((loc) => (
      <link
        rel="alternate"
        hreflang={loc}
        href={new URL(
          getRelativeLocaleUrl(loc, basePath || "/"),
          Astro.site
        ).href}
      />
    ))}
    <link
      rel="alternate"
      hreflang="x-default"
      href={new URL(basePath || "/", Astro.site).href}
    />

    <slot name="head" />
  </head>
  <body>
    <header>
      <nav>
        <slot name="nav" />
        <LanguageSwitcher />
      </nav>
    </header>
    <main>
      <slot />
    </main>
  </body>
</html>
```

**`src/components/LanguageSwitcher.astro`**

```astro
---
import { getRelativeLocaleUrl } from "astro:i18n";
import { locales, localeLabels, defaultLocale, type Locale } from "../i18n/config";

const currentLocale = (Astro.currentLocale ?? defaultLocale) as Locale;

const pathSegments = Astro.url.pathname.split("/").filter(Boolean);
const firstIsLocale = locales.includes(pathSegments[0] as Locale);
const basePath =
  "/" + (firstIsLocale ? pathSegments.slice(1).join("/") : pathSegments.join("/"));
---

<div class="relative inline-block">
  <label for="lang-select" class="sr-only">Language</label>
  <select
    id="lang-select"
    class="appearance-none rounded-md border border-gray-300 bg-white px-3 py-1.5 pr-8
           text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1
           focus:ring-blue-500"
    onchange="window.location.href = this.value"
  >
    {locales.map((loc) => (
      <option
        value={getRelativeLocaleUrl(loc, basePath || "/")}
        selected={loc === currentLocale}
      >
        {localeLabels[loc]}
      </option>
    ))}
  </select>
</div>
```

### React Language Switcher (required from Phase 1)

The Astro `LanguageSwitcher.astro` lives in the Astro layout's `<nav>`, but the dashboard
is a full React app with its own header (`DashboardHeader.tsx`). Users interact with the
React-rendered header, not the Astro shell — so the language switcher **must also exist as
a React component inside `DashboardHeader`** from Phase 1, not deferred to Phase 2.

**`src/components/dashboard/ReactLanguageSwitcher.tsx`**

```tsx
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { locales, localeLabels, type Locale } from "@/i18n/config";

export function ReactLanguageSwitcher() {
  const { locale, setLocale } = useLocaleContext();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label="Language"
      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm
                 shadow-sm focus:border-ring focus:outline-none focus:ring-1
                 focus:ring-ring"
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeLabels[loc]}
        </option>
      ))}
    </select>
  );
}
```

**Add to `DashboardHeader.tsx`** (next to the currency badge):

```tsx
import { ReactLanguageSwitcher } from "./ReactLanguageSwitcher";

export function DashboardHeader() {
  // ... existing code ...
  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold tracking-tight">{t("app.title")}</h1>
        <Badge variant="secondary">{currency}</Badge>
      </div>
      <div className="flex items-center gap-3">
        <ReactLanguageSwitcher />
        <Button variant="outline" onClick={() => dispatch({ type: "RESET" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("actions.upload_new")}
        </Button>
      </div>
    </header>
  );
}
```

Both switchers exist in parallel: the Astro one covers the initial page load (before React
hydrates) and the upload page; the React one covers the dashboard where users spend most
of their time.

---

## 14. Domain Logic Boundary (Monorepo Rule)

**`packages/core` and `packages/importers` must NEVER return English strings.**

Return structured translation codes instead:

```ts
// packages/core/src/insights/rules.ts
export interface InsightResult {
  code: string;                              // e.g., "insights.underperforming"
  params: Record<string, string | number>;   // e.g., { listingName: "Beach House", pct: 23 }
  severity: "info" | "warning" | "critical";
}

// In the UI layer:
// t(insight.code, insight.params) → "Beach House is underperforming by 23%"
```

This keeps core logic language-agnostic, unit-testable without i18n, and decoupled from any
specific language.

---

## 15. Translation JSON Examples

### Key naming convention

Use dot-separated, lowercase, descriptive paths:

```
✅  dashboard.kpi.revenue
✅  upload.errors.file_too_large
✅  common.actions.confirm

❌  dashboardKpiRevenue       (flat, unreadable)
❌  UPLOAD_ERROR_FILE          (screaming snake)
```

### `en/common.json`

```json
{
  "app": {
    "title": "Rental Analytics",
    "description": "Analyze your rental platform exports"
  },
  "nav": {
    "dashboard": "Dashboard",
    "upload": "Upload",
    "forecast": "Forecast",
    "cashflow": "Cash Flow",
    "data_quality": "Data Quality",
    "settings": "Settings"
  },
  "actions": {
    "upload_file": "Upload File",
    "export": "Export",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "continue": "Continue",
    "back": "Back"
  },
  "language": {
    "label": "Language",
    "change": "Change language"
  },
  "errors": {
    "generic": "Something went wrong. Please try again.",
    "file_invalid": "This file format is not supported.",
    "no_data": "No data available."
  }
}
```

### `es/common.json`

```json
{
  "app": {
    "title": "Analítica de Alquileres",
    "description": "Analiza las exportaciones de tu plataforma de alquiler"
  },
  "nav": {
    "dashboard": "Panel",
    "upload": "Subir",
    "forecast": "Pronóstico",
    "cashflow": "Flujo de Caja",
    "data_quality": "Calidad de Datos",
    "settings": "Configuración"
  },
  "actions": {
    "upload_file": "Subir Archivo",
    "export": "Exportar",
    "cancel": "Cancelar",
    "confirm": "Confirmar",
    "continue": "Continuar",
    "back": "Volver"
  },
  "language": {
    "label": "Idioma",
    "change": "Cambiar idioma"
  },
  "errors": {
    "generic": "Algo salió mal. Por favor, inténtalo de nuevo.",
    "file_invalid": "Este formato de archivo no es compatible.",
    "no_data": "No hay datos disponibles."
  }
}
```

Follow the same key structure for `fr/` and `zh/`.

### `en/dashboard.json` (example)

```json
{
  "kpi": {
    "title": "Key Performance Indicators",
    "revenue": "Total Revenue",
    "occupancy": "Occupancy Rate",
    "adr": "Average Daily Rate",
    "revpar": "RevPAR"
  },
  "chart": {
    "revenue_over_time": "Revenue Over Time",
    "monthly_breakdown": "Monthly Breakdown",
    "revenue_label": "Revenue",
    "no_data": "No data to display for this period."
  },
  "table": {
    "listing": "Listing",
    "month": "Month",
    "payout": "Net Payout",
    "nights": "Nights Booked"
  },
  "comparison": {
    "title": "Listing Comparison",
    "vs_previous": "vs. previous month",
    "up": "up {{pct}}%",
    "down": "down {{pct}}%",
    "flat": "no change"
  }
}
```

Note the `{{pct}}` interpolation — i18next's default syntax, works identically everywhere:
`t("comparison.up", { pct: 12 })`.

---

## 16. Component Update Strategy

### Adding a new string

1. Add the key to `en/{namespace}.json`
2. Add the same key to `es`, `fr`, `zh` with translated values
3. Use `t("key.path")` in the component
4. Done — no component refactor

### Adding a new namespace

1. Create `{namespace}.json` in each locale folder
2. Add the static import in `src/i18n/resources.ts`
3. Add the namespace name to the `namespaces` array in `config.ts`

### Adding a new language

1. Add the locale code to `config.ts` (`locales`, `localeLabels`, `intlLocaleMap`)
2. Create the folder under `src/i18n/locales/{code}/`
3. Copy an existing language's JSONs and translate the values
4. Add static imports in `resources.ts`
5. Create the page wrapper under `src/pages/{code}/index.astro`
6. Update `astro.config.mjs` locales array

### Updating existing translations

Edit the JSON file. That's it. No rebuild of components, no code changes.

### Migration order (fastest payoff)

1. `format.ts` — add locale parameter to all functions (backward-compatible)
2. `common` — nav, buttons, empty states, generic errors
3. Upload flow — file validation, CTAs, instructions
4. Dashboard — KPI labels, table column headers, listing comparison
5. Charts — Recharts axis labels and tooltips (closure pattern from Section 10)
6. Forecast + ML — projection labels, confidence intervals
7. Cashflow — income/expense categories
8. Data quality — warnings panel, validation messages
9. Settings — preference labels, toggles
10. Insights — rule-based descriptions (using codes from core)

---

## 17. Translation Completeness Test (CI Safety Net)

**`apps/web/src/i18n/__tests__/completeness.test.ts`**

```ts
import { describe, test, expect } from "bun:test";
import { locales, namespaces } from "../config";
import { resources } from "../resources";

function flattenKeys(obj: Record<string, any>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null
      ? flattenKeys(value, fullKey)
      : [fullKey];
  });
}

describe("Translation completeness", () => {
  for (const ns of namespaces) {
    const enResource = resources.en[ns];
    if (!enResource) continue;

    const enKeys = flattenKeys(enResource).sort();

    for (const locale of locales.filter((l) => l !== "en")) {
      test(`${locale}/${ns} has all keys from en/${ns}`, () => {
        const localeResource = resources[locale]?.[ns];
        expect(localeResource).toBeDefined();
        const localeKeys = flattenKeys(localeResource ?? {}).sort();
        expect(localeKeys).toEqual(enKeys);
      });
    }
  }
});
```

Runs as part of `bun run test`. Fails CI if any locale is missing keys.

---

## 18. SEO & Accessibility Checklist

- [x] `<html lang={locale}>` on every page (via Layout)
- [x] `<link rel="alternate" hreflang="...">` for all locales + `x-default` (via Layout)
- [x] `site` configured in `astro.config.mjs` (required for absolute hreflang URLs)
- [x] Language switcher is keyboard-accessible (`<select>` with `<label>`)
- [x] Language switcher uses native language names ("Español" not "Spanish")
- [ ] Canonical URLs per locale (`<link rel="canonical">` in Layout — add in commit 4)

---

## 19. Commit Plan

### Branch

```bash
git checkout -b feat/i18n-foundation
```

### Commit 1 — Astro config + site URL + locale page wrappers

```
Files:
  apps/web/astro.config.mjs              (add i18n config + site property)
  apps/web/src/pages/es/index.astro      (thin wrapper)
  apps/web/src/pages/fr/index.astro      (thin wrapper)
  apps/web/src/pages/zh/index.astro      (thin wrapper)

Message:
  feat(i18n): enable Astro locale routing with site URL
```

### Commit 2 — i18n module + locale files

```
Files:
  apps/web/src/i18n/config.ts
  apps/web/src/i18n/resources.ts
  apps/web/src/i18n/server.ts
  apps/web/src/i18n/client.ts
  apps/web/src/i18n/locales/**/*.json    (all 9 namespaces × 4 locales)

Message:
  feat(i18n): add i18next config, resources, and translation files
```

### Commit 3 — LocaleProvider + SettingsData locale field

```
Files:
  apps/web/src/i18n/LocaleProvider.tsx
  (SettingsData type: add locale? field)
  (App.tsx: wrap tree in LocaleProvider, read locale from URL/settings)

Message:
  feat(i18n): add LocaleProvider context and persist locale in settings
```

### Commit 4 — Layout + language switchers + hreflang

```
Files:
  apps/web/src/layouts/Layout.astro
  apps/web/src/components/LanguageSwitcher.astro
  apps/web/src/components/dashboard/ReactLanguageSwitcher.tsx
  apps/web/src/components/dashboard/DashboardHeader.tsx  (add React switcher)

Message:
  feat(i18n): add layout lang attribute, hreflang tags, and language switchers
```

### Commit 5 — Migrate format.ts (backward-compatible)

```
Files:
  apps/web/src/lib/format.ts             (add locale parameter to all functions)

Message:
  refactor(i18n): add locale parameter to format.ts (backward-compatible defaults)
```

### Commit 6 — Translation completeness test

```
Files:
  apps/web/src/i18n/__tests__/completeness.test.ts

Message:
  test(i18n): add translation key completeness checks
```

### PR: `feat/i18n-foundation` → `main`

---

Then, on a second branch:

```bash
git checkout -b feat/i18n-migrate-components
```

### Commit 7+ — Migrate UI in small slices

```
refactor(i18n): localize common navigation and buttons
refactor(i18n): localize upload flow
refactor(i18n): localize dashboard KPI labels and tables
refactor(i18n): localize Recharts formatters with locale closure
refactor(i18n): localize forecast and ML sections
refactor(i18n): localize cashflow tab
refactor(i18n): localize data quality and warnings
refactor(i18n): localize settings tab
refactor(i18n): localize insight descriptions
```

### PR: `feat/i18n-migrate-components` → `main`

### Before every push

```bash
bun install
bun run test        # includes completeness test
bun run lint
bun run typecheck
bun run build:web
```

All scripts already defined in root `package.json`.

---

## 20. Post-Alpha Roadmap

| Phase   | Feature                     | Notes                                                    |
|---------|-----------------------------|----------------------------------------------------------|
| Phase 2 | Browser language detection  | Astro middleware (requires on-demand rendering)           |
| Phase 2 | Lazy-load translations      | `i18next-resources-to-backend` for bundle splitting      |
| Phase 2 | Upgrade React switcher      | Replace plain `<select>` with shadcn DropdownMenu        |
| Phase 3 | Translation platform        | Crowdin, Lokalise, or Tolgee for professional translators|
| Phase 3 | RTL support                 | `dir` attribute on `<html>`, Tailwind RTL plugin         |
| Phase 3 | Additional languages        | Zero architecture changes needed                         |

---

## Summary

| Concern                        | Solution                                                            |
|--------------------------------|---------------------------------------------------------------------|
| URL routing                    | Astro built-in i18n, `prefixDefaultLocale: false`                   |
| Locale detection (Astro)       | `Astro.currentLocale` (official API)                                |
| Locale delivery (React)        | `LocaleProvider` context — no prop-drilling                         |
| Locale persistence             | `SettingsData` in localStorage (existing infrastructure)            |
| Translation engine             | i18next everywhere (Astro + React) — one system, one syntax         |
| Astro page translations        | `createInstance()` per render via `createServerI18n(locale)`        |
| React component translations   | `useTranslation(ns, { lng: locale })` — no hydration flicker       |
| Currency / dates / numbers     | Migrated `format.ts` with locale parameter (not a new file)        |
| `formatMonth` signature        | Preserved: takes `YearMonth` string, not `Date` — no breaking change|
| Recharts formatters            | Locale captured via closure from component scope                    |
| Page deduplication             | Thin locale wrappers (views pattern available for future pages)     |
| Language switcher (Astro)      | Native `<select>` + `getRelativeLocaleUrl()` — no hydration        |
| Language switcher (React)      | `useLocaleContext().setLocale()` — handles persistence + navigation |
| Domain logic boundary          | `packages/core` returns `{ code, params }`, UI translates          |
| Namespaces                     | 9 namespaces aligned to actual UI tabs/areas                        |
| SEO                            | `<html lang>` + hreflang alternates + x-default + `site` config    |
| Missing key safety             | Fallback to `en` + console warning + CI completeness test           |
| Dependencies added             | `i18next`, `react-i18next` (2 packages)                            |
