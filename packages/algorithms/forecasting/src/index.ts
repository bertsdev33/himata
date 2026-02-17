/**
 * @rental-analytics/forecasting
 *
 * In-browser Ridge Regression revenue forecasting.
 * Trains on MonthlyListingPerformance[], predicts next-month gross revenue per listing.
 */

export { computeRevenueForecast, buildPortfolio } from "./forecast.js";

export type {
  ForecastResult,
  ListingForecast,
  PortfolioForecast,
  ConfidenceTier,
  ExcludedListing,
} from "./types.js";
