import type { YearMonth } from "@rental-analytics/core";
import { defaultLocale, intlLocaleMap, type Locale } from "@/i18n/config";

function resolveIntlLocale(locale: Locale = defaultLocale): string {
  return intlLocaleMap[locale] ?? intlLocaleMap[defaultLocale];
}

/** Format minor-unit cents as currency string (e.g., "$1,234.56") */
export function formatMoney(
  amountMinor: number,
  currency: string = "USD",
  locale: Locale = defaultLocale,
): string {
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat(resolveIntlLocale(locale), {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Format minor-unit cents as compact currency (e.g., "$1.2K") */
export function formatMoneyCompact(
  amountMinor: number,
  currency: string = "USD",
  locale: Locale = defaultLocale,
): string {
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat(resolveIntlLocale(locale), {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

/** Format a decimal ratio as percentage (e.g., 0.85 -> "85.0%") */
export function formatPercent(ratio: number | null, locale: Locale = defaultLocale): string {
  if (ratio === null) return "N/A";
  return new Intl.NumberFormat(resolveIntlLocale(locale), {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ratio);
}

/** Format a delta percentage with sign (e.g., 0.15 -> "+15.0%") */
export function formatDeltaPercent(ratio: number | null, locale: Locale = defaultLocale): string {
  if (ratio === null) return "N/A";
  const formattedAbsolute = new Intl.NumberFormat(resolveIntlLocale(locale), {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(ratio));
  return ratio >= 0 ? `+${formattedAbsolute}` : `-${formattedAbsolute}`;
}

/** Format YearMonth as readable month (e.g., "2026-01" -> "Jan 2026") */
export function formatMonth(ym: YearMonth, locale: Locale = defaultLocale): string {
  const [year, month] = ym.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString(resolveIntlLocale(locale), {
    month: "short",
    year: "numeric",
  });
}

/** Format YearMonth as short month (e.g., "2026-01" -> "Jan") */
export function formatMonthShort(ym: YearMonth, locale: Locale = defaultLocale): string {
  const [year, month] = ym.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString(resolveIntlLocale(locale), { month: "short" });
}
