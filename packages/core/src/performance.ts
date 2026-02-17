/**
 * Monthly performance aggregation from allocation slices.
 */

import type {
  MonthlyAllocationSlice,
  MonthlyListingPerformance,
  MonthlyPortfolioPerformance,
  YearMonth,
} from "./schema/canonical.js";

/**
 * Compute monthly performance per listing from allocation slices.
 *
 * Groups slices by (month, accountId, listingId, currency) and sums
 * allocated amounts. Breaks down revenue by transaction kind.
 */
export function computeMonthlyListingPerformance(
  allocations: MonthlyAllocationSlice[],
  listingNames?: Map<string, string>
): MonthlyListingPerformance[] {
  const groups = new Map<string, {
    month: YearMonth;
    accountId: string;
    listingId: string;
    currency: string;
    bookedNights: number;
    grossRevenueMinor: number;
    netRevenueMinor: number;
    cleaningFeesMinor: number;
    serviceFeesMinor: number;
    reservationRevenueMinor: number;
    adjustmentRevenueMinor: number;
    resolutionAdjustmentRevenueMinor: number;
    cancellationFeeRevenueMinor: number;
  }>();

  for (const slice of allocations) {
    const key = `${slice.month}|${slice.accountId}|${slice.listingId}|${slice.currency}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        month: slice.month,
        accountId: slice.accountId,
        listingId: slice.listingId,
        currency: slice.currency,
        bookedNights: 0,
        grossRevenueMinor: 0,
        netRevenueMinor: 0,
        cleaningFeesMinor: 0,
        serviceFeesMinor: 0,
        reservationRevenueMinor: 0,
        adjustmentRevenueMinor: 0,
        resolutionAdjustmentRevenueMinor: 0,
        cancellationFeeRevenueMinor: 0,
      };
      groups.set(key, group);
    }

    // Only count nights from reservations — adjustments, resolutions, and
    // cancellation fees reference the same stay but don't represent new nights.
    if (slice.kind === "reservation") {
      group.bookedNights += slice.nights;
    }
    group.grossRevenueMinor += slice.allocatedGrossMinor;
    group.netRevenueMinor += slice.allocatedNetMinor;
    group.cleaningFeesMinor += slice.allocatedCleaningFeeMinor;
    group.serviceFeesMinor += slice.allocatedServiceFeeMinor;

    // Categorize net revenue by transaction kind
    switch (slice.kind) {
      case "reservation":
        group.reservationRevenueMinor += slice.allocatedNetMinor;
        break;
      case "adjustment":
        group.adjustmentRevenueMinor += slice.allocatedNetMinor;
        break;
      case "resolution_adjustment":
        group.resolutionAdjustmentRevenueMinor += slice.allocatedNetMinor;
        break;
      case "cancellation_fee":
        group.cancellationFeeRevenueMinor += slice.allocatedNetMinor;
        break;
    }
  }

  // Convert to array, sorted by month then listing
  return [...groups.values()]
    .map((g) => ({
      ...g,
      listingName: listingNames?.get(g.listingId) ?? g.listingId,
    }))
    .sort((a, b) => a.month.localeCompare(b.month) || a.listingId.localeCompare(b.listingId));
}

/**
 * Compute monthly portfolio-level performance from listing performance.
 * Groups by (month, currency).
 */
export function computeMonthlyPortfolioPerformance(
  listingPerf: MonthlyListingPerformance[]
): MonthlyPortfolioPerformance[] {
  const groups = new Map<string, MonthlyPortfolioPerformance>();

  for (const lp of listingPerf) {
    const key = `${lp.month}|${lp.currency}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        month: lp.month,
        currency: lp.currency,
        grossRevenueMinor: 0,
        netRevenueMinor: 0,
        bookedNights: 0,
        cleaningFeesMinor: 0,
        serviceFeesMinor: 0,
      };
      groups.set(key, group);
    }

    group.grossRevenueMinor += lp.grossRevenueMinor;
    group.netRevenueMinor += lp.netRevenueMinor;
    group.bookedNights += lp.bookedNights;
    group.cleaningFeesMinor += lp.cleaningFeesMinor;
    group.serviceFeesMinor += lp.serviceFeesMinor;
  }

  return [...groups.values()].sort((a, b) =>
    a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency)
  );
}
