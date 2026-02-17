/**
 * Monthly allocation engine.
 *
 * Splits stay-based transactions across months proportionally by night overlap.
 * Uses largest-remainder correction to ensure minor-unit totals reconcile exactly.
 */

import type {
  CanonicalTransaction,
  MonthlyAllocationSlice,
  PerformanceKind,
  YearMonth,
} from "./schema/canonical.js";
import { isPerformanceKind } from "./schema/canonical.js";

/**
 * Get YYYY-MM from a YYYY-MM-DD date string.
 */
export function toYearMonth(isoDate: string): YearMonth {
  return isoDate.slice(0, 7) as YearMonth;
}

/**
 * Get the number of days in a given month.
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Compute night counts per month for a stay window.
 * Returns a map of YearMonth -> nights in that month.
 */
export function computeNightsPerMonth(
  checkIn: string,
  checkOut: string,
  totalNights: number
): Map<YearMonth, number> {
  const result = new Map<YearMonth, number>();

  // Each "night" is the night starting on that date
  // e.g., checkIn 2026-01-29, checkOut 2026-02-01 = nights on Jan 29, Jan 30, Jan 31
  const startDate = new Date(checkIn + "T00:00:00Z");

  for (let i = 0; i < totalNights; i++) {
    const nightDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const year = nightDate.getUTCFullYear();
    const month = String(nightDate.getUTCMonth() + 1).padStart(2, "0");
    const ym = `${year}-${month}` as YearMonth;

    result.set(ym, (result.get(ym) ?? 0) + 1);
  }

  return result;
}

/**
 * Distribute a total minor-unit amount across buckets using largest-remainder method.
 * Ensures the sum of distributed amounts equals the total exactly.
 */
export function largestRemainderDistribute(
  total: number,
  ratios: number[]
): number[] {
  if (ratios.length === 0) return [];
  if (ratios.length === 1) return [total];

  // Compute exact (floating) allocations
  const exact = ratios.map((r) => total * r);

  // Floor each allocation
  const floored = exact.map((e) => Math.trunc(e));

  // Compute remainders
  const remainders = exact.map((e, i) => e - floored[i]);

  // Distribute the remaining cents by largest remainder
  let remaining = total - floored.reduce((a, b) => a + b, 0);
  const indices = remainders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r - a.r);

  for (const { i } of indices) {
    if (remaining === 0) break;
    if (remaining > 0) {
      floored[i] += 1;
      remaining -= 1;
    } else {
      floored[i] -= 1;
      remaining += 1;
    }
  }

  return floored;
}

/**
 * Allocate performance transactions to months based on stay-night overlap.
 *
 * - reservation and cancellation_fee: allocate by stay nights.
 * - adjustment and resolution_adjustment: default to occurredDate month
 *   unless stay dates exist, then allocate by stay overlap.
 * - payout and resolution_payout: excluded (not performance kinds).
 */
export function allocatePerformanceToMonths(
  transactions: CanonicalTransaction[]
): MonthlyAllocationSlice[] {
  const slices: MonthlyAllocationSlice[] = [];

  for (const tx of transactions) {
    if (!isPerformanceKind(tx.kind)) continue;
    if (!tx.listing) continue;

    const { accountId, listingId } = tx.listing;
    const currency = tx.netAmount.currency;

    // Determine month allocation
    let nightsPerMonth: Map<YearMonth, number>;

    const hasStay = tx.stay && tx.stay.nights > 0;
    const isStayBased = tx.kind === "reservation" || tx.kind === "cancellation_fee";

    if (hasStay && (isStayBased || tx.stay)) {
      // Allocate by stay-night overlap
      nightsPerMonth = computeNightsPerMonth(
        tx.stay!.checkInDate,
        tx.stay!.checkOutDate,
        tx.stay!.nights
      );
    } else {
      // Default to occurred-date month
      const ym = toYearMonth(tx.occurredDate);
      nightsPerMonth = new Map([[ym, 1]]);
    }

    const totalNights = [...nightsPerMonth.values()].reduce((a, b) => a + b, 0);
    const months = [...nightsPerMonth.entries()];
    const ratios = months.map(([, n]) => n / totalNights);

    // Distribute each money component
    const grossDistrib = largestRemainderDistribute(tx.grossAmount.amountMinor, ratios);
    const netDistrib = largestRemainderDistribute(tx.netAmount.amountMinor, ratios);
    const cleaningDistrib = largestRemainderDistribute(tx.cleaningFeeAmount.amountMinor, ratios);
    const serviceDistrib = largestRemainderDistribute(tx.hostServiceFeeAmount.amountMinor, ratios);
    const adjDistrib = largestRemainderDistribute(tx.adjustmentAmount.amountMinor, ratios);

    for (let i = 0; i < months.length; i++) {
      const [month, nights] = months[i];
      slices.push({
        transactionId: tx.transactionId,
        kind: tx.kind as PerformanceKind,
        accountId,
        listingId,
        month,
        nights,
        allocationRatio: ratios[i],
        allocatedGrossMinor: grossDistrib[i],
        allocatedNetMinor: netDistrib[i],
        allocatedCleaningFeeMinor: cleaningDistrib[i],
        allocatedServiceFeeMinor: serviceDistrib[i],
        allocatedAdjustmentMinor: adjDistrib[i],
        currency,
      });
    }
  }

  return slices;
}
