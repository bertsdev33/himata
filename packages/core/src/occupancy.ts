/**
 * Estimated occupancy computation.
 *
 * Formula: bookedNights / (daysInMonth * listingsInService)
 * Listings-in-service uses inferred lifecycle range from observed stays.
 */

import type {
  EstimatedOccupancy,
  ListingServiceRange,
  MonthlyListingPerformance,
  YearMonth,
} from "./schema/canonical.js";
import { daysInMonth } from "./allocation.js";

/**
 * Return the ISO date string for the day before the given date.
 */
function dayBefore(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Generate all YearMonth values between two dates (inclusive of both months).
 */
function monthRange(startDate: string, endDate: string): YearMonth[] {
  const months: YearMonth[] = [];
  const [startYear, startMonth] = startDate.slice(0, 7).split("-").map(Number);
  const [endYear, endMonth] = endDate.slice(0, 7).split("-").map(Number);

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}` as YearMonth);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

/**
 * Compute estimated occupancy per month and currency.
 *
 * listingsInService for a given month = count of listings whose service range
 * includes that month.
 */
export function computeEstimatedOccupancy(
  listingPerf: MonthlyListingPerformance[],
  listingServiceRanges: ListingServiceRange[]
): EstimatedOccupancy[] {
  // Group listing performance by (month, currency)
  const perfByMonthCurrency = new Map<string, { bookedNights: number }>();

  for (const lp of listingPerf) {
    const key = `${lp.month}|${lp.currency}`;
    const existing = perfByMonthCurrency.get(key);
    if (existing) {
      existing.bookedNights += lp.bookedNights;
    } else {
      perfByMonthCurrency.set(key, { bookedNights: lp.bookedNights });
    }
  }

  // For each service range, determine which months the listing is in service
  const listingsInServiceByMonthCurrency = new Map<string, number>();

  for (const range of listingServiceRanges) {
    // lastStayEnd is checkout-exclusive; the last occupied night is the day before.
    // Use the previous day to determine the last month of service.
    const lastOccupiedDate = dayBefore(range.lastStayEnd);
    const months = monthRange(range.firstStayStart, lastOccupiedDate);
    for (const m of months) {
      const key = `${m}|${range.currency}`;
      listingsInServiceByMonthCurrency.set(
        key,
        (listingsInServiceByMonthCurrency.get(key) ?? 0) + 1
      );
    }
  }

  // Compute occupancy for each (month, currency) that has performance data
  const results: EstimatedOccupancy[] = [];

  for (const [key, perf] of perfByMonthCurrency) {
    const [monthStr, currency] = key.split("|");
    const month = monthStr as YearMonth;
    const [year, monthNum] = month.split("-").map(Number);
    const days = daysInMonth(year, monthNum);
    const listingsInService = listingsInServiceByMonthCurrency.get(key) ?? 0;

    const totalAvailableNights = days * listingsInService;
    const estimatedOccupancyRate = totalAvailableNights > 0
      ? Math.round((perf.bookedNights / totalAvailableNights) * 10000) / 10000
      : null;

    results.push({
      month,
      currency,
      bookedNights: perf.bookedNights,
      daysInMonth: days,
      listingsInService,
      estimatedOccupancyRate,
      label: "Estimated Occupancy (Assumption-Based)",
      disclaimer: "booked nights / (days_in_month * listings_in_service); not true occupancy",
    });
  }

  return results.sort((a, b) =>
    a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency)
  );
}

/**
 * Infer listing service ranges from canonical transactions.
 * A listing is "in service" from its first observed stay start to last observed stay end.
 */
export function inferListingServiceRanges(
  listingPerf: MonthlyListingPerformance[],
  transactions: import("./schema/canonical.js").CanonicalTransaction[]
): ListingServiceRange[] {
  const ranges = new Map<string, { firstStart: string; lastEnd: string; currency: string }>();

  for (const tx of transactions) {
    if (!tx.listing || !tx.stay) continue;
    const key = `${tx.listing.listingId}|${tx.netAmount.currency}`;
    const existing = ranges.get(key);

    if (!existing) {
      ranges.set(key, {
        firstStart: tx.stay.checkInDate,
        lastEnd: tx.stay.checkOutDate,
        currency: tx.netAmount.currency,
      });
    } else {
      if (tx.stay.checkInDate < existing.firstStart) {
        existing.firstStart = tx.stay.checkInDate;
      }
      if (tx.stay.checkOutDate > existing.lastEnd) {
        existing.lastEnd = tx.stay.checkOutDate;
      }
    }
  }

  return [...ranges.entries()].map(([key, range]) => {
    const listingId = key.split("|")[0];
    return {
      listingId,
      currency: range.currency,
      firstStayStart: range.firstStart,
      lastStayEnd: range.lastEnd,
    };
  });
}
