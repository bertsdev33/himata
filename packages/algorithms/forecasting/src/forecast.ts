import type { MonthlyListingPerformance } from "@rental-analytics/core";
import type { ForecastResult, ListingForecast, PortfolioForecast } from "./types.js";
import { buildFeatureRows } from "./features.js";
import { trainRidgeModel, predict, getConfidenceTier } from "./model.js";

const MIN_TRAINING_ROWS = 3;

function emptyResult(): ForecastResult {
  return {
    portfolio: {
      targetMonth: "",
      currency: "",
      forecastGrossRevenueMinor: 0,
      totalMaeMinor: 0,
      upperBandMinor: 0,
      lowerBandMinor: 0,
      listingForecasts: [],
    },
    listings: [],
    excluded: [],
  };
}

/** Build a portfolio from a subset of listing forecasts. */
export function buildPortfolio(listings: ListingForecast[]): PortfolioForecast {
  const totalForecast = listings.reduce((s, l) => s + l.forecastGrossRevenueMinor, 0);
  const totalMae = listings.reduce((s, l) => s + l.maeMinor, 0);
  return {
    targetMonth: listings[0]?.targetMonth ?? "",
    currency: listings[0]?.currency ?? "",
    forecastGrossRevenueMinor: totalForecast,
    totalMaeMinor: totalMae,
    upperBandMinor: totalForecast + totalMae,
    lowerBandMinor: Math.max(0, totalForecast - totalMae),
    listingForecasts: listings,
  };
}

/**
 * Main pipeline: compute revenue forecasts from historical listing performance.
 *
 * Input data MUST be single-currency. The caller is responsible for
 * partitioning by currency before calling this function.
 *
 * 1. Feature engineering from MonthlyListingPerformance[]
 * 2. Ridge regression training with LOO alpha selection
 * 3. Per-listing forecasts with confidence tiers
 * 4. Portfolio-level aggregation (only listings sharing the same target month)
 */
export function computeRevenueForecast(
  data: MonthlyListingPerformance[],
): ForecastResult {
  if (data.length === 0) return emptyResult();

  const { trainingRows, predictionInputs, excluded } = buildFeatureRows(data);

  if (trainingRows.length < MIN_TRAINING_ROWS) {
    // Not enough training data — return all as excluded
    const result = emptyResult();
    result.excluded = [
      ...excluded,
      ...predictionInputs.map((p) => ({
        listingId: p.listingId,
        listingName: p.listingName,
        accountId: p.accountId,
        reasonCode: "insufficient_training_data" as const,
        reasonParams: {
          trainingRows: trainingRows.length,
          minTrainingRows: MIN_TRAINING_ROWS,
        },
        reason: `Insufficient training data (${trainingRows.length} rows across all listings, need ${MIN_TRAINING_ROWS})`,
        monthsAvailable: p.trainingMonths,
      })),
    ];
    return result;
  }

  const model = trainRidgeModel(trainingRows);

  const listings: ListingForecast[] = predictionInputs.map((input) => {
    const forecastGrossRevenueMinor = Math.round(predict(model, input.features));
    const maeMinor = Math.round(model.looMae);
    const upperBandMinor = forecastGrossRevenueMinor + maeMinor;
    const lowerBandMinor = Math.max(0, forecastGrossRevenueMinor - maeMinor);
    const confidence = getConfidenceTier(input.trainingMonths);

    return {
      listingId: input.listingId,
      listingName: input.listingName,
      accountId: input.accountId,
      currency: input.currency,
      targetMonth: input.targetMonth,
      forecastGrossRevenueMinor,
      maeMinor,
      upperBandMinor,
      lowerBandMinor,
      confidence,
      trainingMonths: input.trainingMonths,
    };
  });

  // Group listings by targetMonth, build portfolio from the largest group
  const byMonth = new Map<string, ListingForecast[]>();
  for (const l of listings) {
    const group = byMonth.get(l.targetMonth);
    if (group) group.push(l);
    else byMonth.set(l.targetMonth, [l]);
  }

  let largestGroup: ListingForecast[] = [];
  for (const group of byMonth.values()) {
    if (group.length > largestGroup.length) {
      largestGroup = group;
    }
  }

  const portfolio = buildPortfolio(largestGroup);

  return { portfolio, listings, excluded };
}
