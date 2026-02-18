import type { MonthlyListingPerformance } from "@rental-analytics/core";
import type { FeatureRow, PredictionInput, ExcludedListing } from "./types.js";

const MIN_MONTHS = 3;
const NUM_FEATURES = 13;

interface ListingGroup {
  listingId: string;
  listingName: string;
  accountId: string;
  currency: string;
  months: MonthlyListingPerformance[];
}

export interface FeatureBuildResult {
  trainingRows: FeatureRow[];
  predictionInputs: PredictionInput[];
  excluded: ExcludedListing[];
}

/** Group listing performance data by listingId, sorted chronologically. */
export function groupByListing(data: MonthlyListingPerformance[]): ListingGroup[] {
  const map = new Map<string, ListingGroup>();
  for (const row of data) {
    let group = map.get(row.listingId);
    if (!group) {
      group = {
        listingId: row.listingId,
        listingName: row.listingName,
        accountId: row.accountId,
        currency: row.currency,
        months: [],
      };
      map.set(row.listingId, group);
    }
    group.months.push(row);
  }
  // Sort each group chronologically
  for (const group of map.values()) {
    group.months.sort((a, b) => a.month.localeCompare(b.month));
  }
  return [...map.values()];
}

/** Compute rolling average of the last `window` values up to (but not including) index i. */
export function rollingAverage(values: number[], i: number, window: number): number {
  const start = Math.max(0, i - window);
  const end = i;
  if (start >= end) return 0;
  let sum = 0;
  for (let k = start; k < end; k++) {
    sum += values[k];
  }
  return sum / (end - start);
}

/** Population standard deviation. Returns 0 if all values identical or single value. */
function popStd(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  let sumSq = 0;
  for (const v of values) {
    const d = v - mean;
    sumSq += d * d;
  }
  const variance = sumSq / values.length;
  return Math.sqrt(variance);
}

/** Compute months since a reference month. Both in "YYYY-MM" format. */
function monthsSince(refMonth: string, currentMonth: string): number {
  const [ry, rm] = refMonth.split("-").map(Number);
  const [cy, cm] = currentMonth.split("-").map(Number);
  return (cy - ry) * 12 + (cm - rm);
}

/** Extract month number (1-12) from "YYYY-MM". */
function monthNumber(ym: string): number {
  return parseInt(ym.split("-")[1], 10);
}

/** Compute next calendar month from "YYYY-MM". */
export function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Build feature rows for training and prediction from listing performance data.
 * 13 features per row (see plan for feature definitions).
 */
export function buildFeatureRows(data: MonthlyListingPerformance[]): FeatureBuildResult {
  const groups = groupByListing(data);
  const trainingRows: FeatureRow[] = [];
  const predictionInputs: PredictionInput[] = [];
  const excluded: ExcludedListing[] = [];

  for (const group of groups) {
    const n = group.months.length;

    if (n < MIN_MONTHS) {
      excluded.push({
        listingId: group.listingId,
        listingName: group.listingName,
        accountId: group.accountId,
        reasonCode: "insufficient_listing_history",
        reasonParams: {
          monthsAvailable: n,
          minMonths: MIN_MONTHS,
        },
        reason: `Only ${n} month(s) of data (need at least ${MIN_MONTHS})`,
        monthsAvailable: n,
      });
      continue;
    }

    const revenues = group.months.map((m) => m.grossRevenueMinor);
    const nights = group.months.map((m) => m.bookedNights);
    const firstMonth = group.months[0].month;

    // Precompute prefix sums for incremental mean/std (avoids data leakage)
    const prefixSum = new Array(n + 1);
    const prefixSumSq = new Array(n + 1);
    prefixSum[0] = 0;
    prefixSumSq[0] = 0;
    for (let k = 0; k < n; k++) {
      prefixSum[k + 1] = prefixSum[k] + revenues[k];
      prefixSumSq[k + 1] = prefixSumSq[k] + revenues[k] * revenues[k];
    }

    /** Compute mean of revenues[0..upTo] (inclusive). */
    function incrementalMean(upTo: number): number {
      const count = upTo + 1;
      return prefixSum[count] / count;
    }

    /** Compute population std of revenues[0..upTo] (inclusive). */
    function incrementalStd(upTo: number, mean: number): number {
      const count = upTo + 1;
      if (count <= 1) return 0;
      const variance = prefixSumSq[count] / count - mean * mean;
      return Math.sqrt(Math.max(0, variance));
    }

    /** Build a feature vector for month at index i (using only data up to i). */
    function buildFeatures(i: number): number[] {
      const features = new Array(NUM_FEATURES);
      const month = group.months[i].month;
      const mn = monthNumber(month);

      // Stats computed only from data up to and including index i (no leakage)
      const histMean = incrementalMean(i);
      const histStd = incrementalStd(i, histMean);

      // 0: rev_lag1m
      features[0] = i >= 1 ? revenues[i - 1] : 0;
      // 1: rev_lag2m
      features[1] = i >= 2 ? revenues[i - 2] : 0;
      // 2: rev_roll3m
      features[2] = rollingAverage(revenues, i, 3);
      // 3: rev_roll6m
      features[3] = rollingAverage(revenues, i, 6);
      // 4: nights_lag1m
      features[4] = i >= 1 ? nights[i - 1] : 0;
      // 5: rev_lag1m_norm
      features[5] = features[0] / (histMean + 1);
      // 6: rev_roll3m_norm
      features[6] = features[2] / (histMean + 1);
      // 7: month_sin
      features[7] = Math.sin((2 * Math.PI * mn) / 12);
      // 8: month_cos
      features[8] = Math.cos((2 * Math.PI * mn) / 12);
      // 9: trend
      features[9] = monthsSince(firstMonth, month);
      // 10: listing_hist_mean
      features[10] = histMean;
      // 11: listing_hist_std
      features[11] = histStd;
      // 12: listing_months
      features[12] = i + 1; // months seen so far, not total

      return features;
    }

    // Training rows: from index 2 to n-2 (target = revenue at i+1)
    for (let i = 2; i < n - 1; i++) {
      trainingRows.push({
        features: buildFeatures(i),
        target: revenues[i + 1],
        listingId: group.listingId,
        month: group.months[i].month,
      });
    }

    // Prediction input: features from last available month, predicting next month
    const lastIdx = n - 1;
    predictionInputs.push({
      features: buildFeatures(lastIdx),
      listingId: group.listingId,
      listingName: group.listingName,
      accountId: group.accountId,
      currency: group.currency,
      targetMonth: nextMonth(group.months[lastIdx].month),
      trainingMonths: n,
    });
  }

  return { trainingRows, predictionInputs, excluded };
}
