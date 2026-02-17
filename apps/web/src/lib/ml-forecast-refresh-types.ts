import type { ForecastResult } from "@rental-analytics/forecasting";
import type { MonthlyListingPerformance } from "@rental-analytics/core";

export type MlForecastRefreshStatus =
  | "idle"
  | "stale"
  | "recomputing"
  | "up_to_date"
  | "failed";

export interface TrainingScope {
  currency: string;
  accountIds: string[];
  listingIds: string[];
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
}

export interface TrainingMeta {
  rowCount: number;
  distinctMonths: number;
  listingCount: number;
  months: { start: string | null; end: string | null };
}

export type FallbackReason =
  | "insufficient_data_in_date_range__trained_on_full_history"
  | "insufficient_training_data"
  | "insufficient_per_listing_history"
  | null;

export interface MlForecastSnapshot {
  datasetId: string;
  desiredScope: TrainingScope;
  effectiveScope: TrainingScope;
  usedFallback: boolean;
  fallbackReason: FallbackReason;
  trainedAt: number;
  trainingMeta: TrainingMeta;
  result: ForecastResult | null;
}

export function normalizeTrainingScope(scope: TrainingScope): TrainingScope {
  return {
    ...scope,
    accountIds: [...scope.accountIds].sort(),
    listingIds: [...scope.listingIds].sort(),
    dateRangeStart: scope.dateRangeStart ?? null,
    dateRangeEnd: scope.dateRangeEnd ?? null,
  };
}

export function trainingScopeKey(scope: TrainingScope): string {
  return JSON.stringify(normalizeTrainingScope(scope));
}

export interface MlWorkerConfig {
  minTrainingRows?: number;
  minTrainingMonths?: number;
  fallback?: "drop_date_range" | "none";
}

export interface MlInitMessage {
  type: "init";
  datasetId: string;
  realizedListingPerformance: MonthlyListingPerformance[];
  config?: MlWorkerConfig;
}

export interface MlComputeMessage {
  type: "compute";
  datasetId: string;
  requestId: number;
  desiredScope: TrainingScope;
}

export type MlWorkerRequest = MlInitMessage | MlComputeMessage;

export interface MlReadyMessage {
  type: "ready";
  datasetId: string;
}

export interface MlResultMessage {
  type: "result";
  datasetId: string;
  requestId: number;
  desiredScope: TrainingScope;
  effectiveScope: TrainingScope;
  usedFallback: boolean;
  fallbackReason: FallbackReason;
  trainedAt: number;
  trainingMeta: TrainingMeta;
  result: ForecastResult | null;
}

export interface MlErrorMessage {
  type: "error";
  datasetId: string | null;
  requestId: number | null;
  error: string;
}

export type MlWorkerResponse = MlReadyMessage | MlResultMessage | MlErrorMessage;

