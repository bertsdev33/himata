/**
 * Trailing comparison computation.
 *
 * Computes current month vs trailing N-month average for net and gross revenue.
 * Adaptive window: M < 3 → no comparison, 3-5 → 3, 6-11 → 6, >= 12 → 12.
 * Uses contiguous calendar months with zero-fill for gaps.
 */

import type {
  MonthlyListingPerformance,
  TrailingComparison,
  YearMonth,
} from "./schema/canonical.js";

/**
 * Decrement a YearMonth by one month.
 */
function prevMonth(ym: YearMonth): YearMonth {
  const [yearStr, monthStr] = ym.split("-");
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1;

  if (month < 1) {
    month = 12;
    year -= 1;
  }

  return `${year}-${String(month).padStart(2, "0")}` as YearMonth;
}

/**
 * Generate a list of N contiguous months ending before the given month.
 */
function trailingMonths(currentMonth: YearMonth, windowSize: number): YearMonth[] {
  const months: YearMonth[] = [];
  let ym = currentMonth;
  for (let i = 0; i < windowSize; i++) {
    ym = prevMonth(ym);
    months.unshift(ym);
  }
  return months;
}

/**
 * Determine trailing window size based on available historical months.
 */
function selectWindow(availableMonths: number): 3 | 6 | 12 | null {
  if (availableMonths < 3) return null;
  if (availableMonths <= 5) return 3;
  if (availableMonths <= 11) return 6;
  return 12;
}

/**
 * Compute trailing comparisons for each listing+currency combination.
 */
export function computeTrailingComparisons(
  listingPerf: MonthlyListingPerformance[]
): TrailingComparison[] {
  const results: TrailingComparison[] = [];

  // Group by (listingId, currency)
  const groups = new Map<string, MonthlyListingPerformance[]>();
  for (const lp of listingPerf) {
    const key = `${lp.listingId}|${lp.currency}`;
    const group = groups.get(key) ?? [];
    group.push(lp);
    groups.set(key, group);
  }

  for (const [, perfs] of groups) {
    // Build month -> performance lookup
    const monthMap = new Map<YearMonth, MonthlyListingPerformance>();
    for (const p of perfs) {
      monthMap.set(p.month, p);
    }

    // Get all months sorted
    const allMonths = [...monthMap.keys()].sort();
    if (allMonths.length < 2) continue;

    for (const currentMonth of allMonths) {
      // Count available historical months (before current)
      const historicalMonths = allMonths.filter((m) => m < currentMonth);
      const M = historicalMonths.length;

      const windowSize = selectWindow(M);
      if (!windowSize) continue;

      const windowMonths = trailingMonths(currentMonth, windowSize);
      const currentPerf = monthMap.get(currentMonth)!;

      for (const metric of ["netRevenueMinor", "grossRevenueMinor"] as const) {
        // Zero-fill: sum values for window months, using 0 for missing months
        let windowSum = 0;
        for (const wm of windowMonths) {
          const p = monthMap.get(wm);
          windowSum += p ? p[metric] : 0;
        }

        const baselineMinor = Math.round(windowSum / windowSize);
        const currentMinor = currentPerf[metric];
        const deltaMinor = currentMinor - baselineMinor;
        const deltaPct = baselineMinor !== 0
          ? Math.round((deltaMinor / Math.abs(baselineMinor)) * 10000) / 10000
          : null;

        results.push({
          month: currentMonth,
          metric,
          trailingWindowMonths: windowSize,
          baselineMinor,
          currentMinor,
          deltaMinor,
          deltaPct,
          label: `vs trailing ${windowSize}-month average`,
        });
      }
    }
  }

  return results.sort((a, b) =>
    a.month.localeCompare(b.month) || a.metric.localeCompare(b.metric)
  );
}
