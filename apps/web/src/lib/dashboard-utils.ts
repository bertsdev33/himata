import type {
  CanonicalTransaction,
  MonthlyListingPerformance,
  MonthlyPortfolioPerformance,
  MonthlyCashflow,
} from "@rental-analytics/core";

export type DatePreset = "3m" | "6m" | "12m" | "ytd" | "all";
export type DashboardViewMode = "realized" | "forecast" | "all";

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
  return projectMonthValueAtDate(value, month, new Date());
}

function projectMonthValueAtDate(value: number, month: string, now: Date): number {
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
 * Hospitality-style nowcast for the current month:
 * projected = max(OTB, pace), where
 *   OTB  = realized-to-date + upcoming-on-the-books
 *   pace = linear run-rate projection from realized-to-date
 *
 * This is used for forecast training when "Project this Month" is enabled.
 */
export function applyNowcastProjectionToListingPerformance(args: {
  realized: MonthlyListingPerformance[];
  upcoming: MonthlyListingPerformance[];
  now?: Date;
}): MonthlyListingPerformance[] {
  const { realized, upcoming, now = new Date() } = args;
  if (realized.length === 0 && upcoming.length === 0) return [];

  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const result = realized.map((row) => ({ ...row }));

  const upcomingCurrent = new Map<string, MonthlyListingPerformance>();
  for (const row of upcoming) {
    if (row.month !== currentYm) continue;
    upcomingCurrent.set(`${row.listingId}::${row.currency}`, row);
  }

  const realizedCurrentIndex = new Map<string, number>();
  for (let i = 0; i < result.length; i++) {
    const row = result[i];
    if (row.month !== currentYm) continue;
    const key = `${row.listingId}::${row.currency}`;
    realizedCurrentIndex.set(key, i);
  }

  for (const [key, idx] of realizedCurrentIndex) {
    const row = result[idx];
    const upcomingRow = upcomingCurrent.get(key);

    const otbGross = row.grossRevenueMinor + (upcomingRow?.grossRevenueMinor ?? 0);
    const otbNet = row.netRevenueMinor + (upcomingRow?.netRevenueMinor ?? 0);
    const otbNights = row.bookedNights + (upcomingRow?.bookedNights ?? 0);

    const paceGross = projectMonthValueAtDate(row.grossRevenueMinor, row.month, now);
    const paceNet = projectMonthValueAtDate(row.netRevenueMinor, row.month, now);
    const paceNights = projectMonthValueAtDate(row.bookedNights, row.month, now);

    result[idx] = {
      ...row,
      grossRevenueMinor: Math.max(otbGross, paceGross),
      netRevenueMinor: Math.max(otbNet, paceNet),
      bookedNights: Math.max(otbNights, paceNights),
      cleaningFeesMinor: row.cleaningFeesMinor + (upcomingRow?.cleaningFeesMinor ?? 0),
      serviceFeesMinor: row.serviceFeesMinor + (upcomingRow?.serviceFeesMinor ?? 0),
      reservationRevenueMinor:
        row.reservationRevenueMinor + (upcomingRow?.reservationRevenueMinor ?? 0),
      adjustmentRevenueMinor:
        row.adjustmentRevenueMinor + (upcomingRow?.adjustmentRevenueMinor ?? 0),
      resolutionAdjustmentRevenueMinor:
        row.resolutionAdjustmentRevenueMinor +
        (upcomingRow?.resolutionAdjustmentRevenueMinor ?? 0),
      cancellationFeeRevenueMinor:
        row.cancellationFeeRevenueMinor + (upcomingRow?.cancellationFeeRevenueMinor ?? 0),
    };
  }

  for (const [key, upcomingRow] of upcomingCurrent) {
    if (realizedCurrentIndex.has(key)) continue;
    result.push({ ...upcomingRow });
  }

  return result;
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

/**
 * Filter listing performance by dashboard scope controls.
 */
export function filterListingPerformance(
  data: MonthlyListingPerformance[],
  opts: {
    currency: string;
    selectedAccountIds: string[];
    selectedListingIds: string[];
    dateRange: { start: string | null; end: string | null };
  },
): MonthlyListingPerformance[] {
  let result = data.filter((lp) => lp.currency === opts.currency);

  if (opts.selectedAccountIds.length > 0) {
    const accountSet = new Set(opts.selectedAccountIds);
    result = result.filter((lp) => accountSet.has(lp.accountId));
  }

  if (opts.selectedListingIds.length > 0) {
    const listingSet = new Set(opts.selectedListingIds);
    result = result.filter((lp) => listingSet.has(lp.listingId));
  }

  if (opts.dateRange.start) {
    result = result.filter((lp) => lp.month >= opts.dateRange.start!);
  }
  if (opts.dateRange.end) {
    result = result.filter((lp) => lp.month <= opts.dateRange.end!);
  }

  return result;
}

/**
 * Filter canonical transactions by dashboard scope controls.
 */
export function filterTransactions(
  data: CanonicalTransaction[],
  opts: {
    viewMode: DashboardViewMode;
    currency: string;
    selectedAccountIds: string[];
    selectedListingIds: string[];
    dateRange: { start: string | null; end: string | null };
  },
): CanonicalTransaction[] {
  let result = data.filter((tx) => tx.netAmount.currency === opts.currency);

  if (opts.viewMode === "realized") {
    result = result.filter((tx) => tx.datasetKind === "paid");
  } else if (opts.viewMode === "forecast") {
    result = result.filter((tx) => tx.datasetKind === "upcoming");
  }

  if (opts.selectedAccountIds.length > 0) {
    const accountSet = new Set(opts.selectedAccountIds);
    result = result.filter((tx) => tx.listing != null && accountSet.has(tx.listing.accountId));
  }

  if (opts.selectedListingIds.length > 0) {
    const listingSet = new Set(opts.selectedListingIds);
    result = result.filter((tx) => tx.listing != null && listingSet.has(tx.listing.listingId));
  }

  if (opts.dateRange.start || opts.dateRange.end) {
    result = result.filter((tx) => {
      const month = tx.occurredDate.slice(0, 7);
      if (opts.dateRange.start && month < opts.dateRange.start) return false;
      if (opts.dateRange.end && month > opts.dateRange.end) return false;
      return true;
    });
  }

  return result;
}
