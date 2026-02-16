import type { MonthlyPortfolioPerformance, MonthlyCashflow } from "@rental-analytics/core";

export type DatePreset = "3m" | "6m" | "12m" | "ytd" | "all";

/**
 * Compute a date range from a named preset, anchored to the dataset's max month.
 */
export function getPresetRange(
  preset: DatePreset,
  maxMonth: string,
): { start: string | null; end: string | null } {
  if (preset === "all") return { start: null, end: null };
  if (!maxMonth) return { start: null, end: null };

  const year = parseInt(maxMonth.slice(0, 4));
  const month = parseInt(maxMonth.slice(5, 7)); // 1-based
  let startDate: Date;

  if (preset === "ytd") {
    startDate = new Date(year, 0, 1);
  } else {
    const offset = preset === "3m" ? 3 : preset === "6m" ? 6 : 12;
    startDate = new Date(year, month - offset, 1);
  }

  const startYm = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
  return { start: startYm, end: maxMonth };
}

/**
 * Project the current (incomplete) month's value to a full-month estimate.
 * Returns the original value if the month is not the current month.
 */
export function projectMonthValue(value: number, month: string): number {
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (month !== currentYm) return value;

  const dayOfMonth = now.getDate();
  const yr = parseInt(month.slice(0, 4));
  const mo = parseInt(month.slice(5, 7));
  const daysInMonth = new Date(yr, mo, 0).getDate();

  if (dayOfMonth === 0) return value;
  return Math.round((value / dayOfMonth) * daysInMonth);
}

/**
 * Scale the current incomplete month in a portfolio performance array
 * to a full-month projection estimate.
 */
export function applyProjection(
  data: MonthlyPortfolioPerformance[],
): MonthlyPortfolioPerformance[] {
  if (data.length === 0) return data;

  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  if (dayOfMonth === 0) return data;

  const scale = daysInMonth / dayOfMonth;

  return data.map((p) => {
    if (p.month !== currentYm) return p;
    return {
      ...p,
      grossRevenueMinor: Math.round(p.grossRevenueMinor * scale),
      netRevenueMinor: Math.round(p.netRevenueMinor * scale),
      bookedNights: Math.round(p.bookedNights * scale),
      cleaningFeesMinor: Math.round(p.cleaningFeesMinor * scale),
      serviceFeesMinor: Math.round(p.serviceFeesMinor * scale),
    };
  });
}

/**
 * Filter cashflow data by selected accounts, listings, currency, and date range.
 * When account or listing filters are active, unattributed rows (null IDs) are excluded.
 */
export function filterCashflow(
  data: MonthlyCashflow[],
  opts: {
    currency: string;
    selectedAccountIds: string[];
    selectedListingIds: string[];
    dateRange: { start: string | null; end: string | null };
  },
): MonthlyCashflow[] {
  let result = data.filter((cf) => cf.currency === opts.currency);

  if (opts.selectedAccountIds.length > 0) {
    const accountSet = new Set(opts.selectedAccountIds);
    result = result.filter((cf) => cf.accountId != null && accountSet.has(cf.accountId));
  }

  if (opts.selectedListingIds.length > 0) {
    const listingSet = new Set(opts.selectedListingIds);
    result = result.filter((cf) => cf.listingId != null && listingSet.has(cf.listingId));
  }

  if (opts.dateRange.start) {
    result = result.filter((cf) => cf.month >= opts.dateRange.start!);
  }
  if (opts.dateRange.end) {
    result = result.filter((cf) => cf.month <= opts.dateRange.end!);
  }

  return result;
}
