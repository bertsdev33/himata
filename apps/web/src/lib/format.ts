import type { YearMonth } from "@rental-analytics/core";

/** Format minor-unit cents as currency string (e.g., "$1,234.56") */
export function formatMoney(amountMinor: number, currency: string = "USD"): string {
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-US", {
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
export function formatMoneyCompact(amountMinor: number, currency: string = "USD"): string {
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-US", {
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
export function formatPercent(ratio: number | null): string {
  if (ratio === null) return "N/A";
  return `${(ratio * 100).toFixed(1)}%`;
}

/** Format a delta percentage with sign (e.g., 0.15 -> "+15.0%") */
export function formatDeltaPercent(ratio: number | null): string {
  if (ratio === null) return "N/A";
  const pct = (ratio * 100).toFixed(1);
  return ratio >= 0 ? `+${pct}%` : `${pct}%`;
}

/** Format YearMonth as readable month (e.g., "2026-01" -> "Jan 2026") */
export function formatMonth(ym: YearMonth): string {
  const [year, month] = ym.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Format YearMonth as short month (e.g., "2026-01" -> "Jan") */
export function formatMonthShort(ym: YearMonth): string {
  const [year, month] = ym.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short" });
}
