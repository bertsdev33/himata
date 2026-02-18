export type ConfidenceTier = "high" | "medium" | "low";

export interface ListingForecast {
  listingId: string;
  listingName: string;
  accountId: string;
  currency: string;
  targetMonth: string; // YYYY-MM being predicted
  forecastGrossRevenueMinor: number; // predicted gross revenue (cents)
  maeMinor: number; // mean absolute error from LOO CV
  upperBandMinor: number; // forecast + MAE
  lowerBandMinor: number; // max(0, forecast - MAE)
  confidence: ConfidenceTier;
  trainingMonths: number; // months of history used
}

export interface PortfolioForecast {
  targetMonth: string;
  currency: string;
  forecastGrossRevenueMinor: number; // sum of listing forecasts
  totalMaeMinor: number; // summed MAE (conservative)
  upperBandMinor: number;
  lowerBandMinor: number;
  listingForecasts: ListingForecast[];
}

export interface ForecastResult {
  portfolio: PortfolioForecast;
  listings: ListingForecast[];
  excluded: ExcludedListing[];
}

// Internal types for model training
export interface FeatureRow {
  features: number[]; // 13 features
  target: number; // next month gross revenue (minor units)
  listingId: string;
  month: string;
}

export interface PredictionInput {
  features: number[];
  listingId: string;
  listingName: string;
  accountId: string;
  currency: string;
  targetMonth: string;
  trainingMonths: number;
}

export interface TrainedModel {
  beta: number[]; // 13 coefficients
  intercept: number; // always 0 in scaled space (unscaling handles it)
  featureMeans: number[]; // StandardScaler means
  featureStds: number[]; // StandardScaler stds
  targetMean: number;
  targetStd: number;
  alpha: number; // chosen regularization strength
  looMae: number; // LOO cross-validation MAE
}

export interface ExcludedListing {
  listingId: string;
  listingName: string;
  accountId: string;
  /**
   * Structured reason code for localization in UI.
   */
  reasonCode: "insufficient_listing_history" | "insufficient_training_data";
  /**
   * Optional interpolation values for the localized reason text.
   */
  reasonParams?: Record<string, string | number>;
  /**
   * Backward-compatible plain-text reason.
   */
  reason: string;
  monthsAvailable: number;
}
