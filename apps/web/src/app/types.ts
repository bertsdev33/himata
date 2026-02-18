import type {
  DatasetKind,
  CanonicalTransaction,
  ImportWarning,
  MonthlyListingPerformance,
  MonthlyPortfolioPerformance,
  MonthlyCashflow,
  TrailingComparison,
  EstimatedOccupancy,
  ListingServiceRange,
} from "@rental-analytics/core";
import type { ForecastResult } from "@rental-analytics/forecasting";
import type { Locale } from "@/i18n/config";

/** Represents a file entry in the upload flow */
export interface FileEntry {
  id: string;
  file: File;
  accountId: string;
  datasetKind: DatasetKind;
}

/** Realized or forecast view */
export type ViewMode = "realized" | "forecast" | "all";

/** Revenue basis for chart display */
export type RevenueBasis = "net" | "gross" | "both";

/** Dashboard tab identifiers */
export type DashboardTab =
  | "portfolio-overview"
  | "listing-comparison"
  | "listing-detail"
  | "cashflow"
  | "forecast"
  | "transactions"
  | "data-quality"
  | "settings";

/** Dashboard filter state */
export interface FilterState {
  selectedAccountIds: string[];
  selectedListingIds: string[];
  dateRange: { start: string | null; end: string | null };
  viewMode: ViewMode;
  currency: string | null;
  projection: boolean;
  activeTab: DashboardTab;
}

/** Pre-computed analytics for a specific view (realized, forecast, or all) */
export interface ViewData {
  listingPerformance: MonthlyListingPerformance[];
  portfolioPerformance: MonthlyPortfolioPerformance[];
  cashflow: MonthlyCashflow[];
  trailing: TrailingComparison[];
  occupancy: EstimatedOccupancy[];
}

/** All computed analytics data */
export interface AnalyticsData {
  transactions: CanonicalTransaction[];
  warnings: ImportWarning[];
  serviceRanges: ListingServiceRange[];
  /** Primary currency (most common) */
  currency: string;
  /** All unique currencies in the dataset */
  currencies: string[];
  /** All unique account IDs */
  accountIds: string[];
  /** Map of listingId -> listingName */
  listingNames: Map<string, string>;
  /** All unique listing IDs with their account, sorted by transaction count DESC */
  listings: { listingId: string; listingName: string; accountId: string; transactionCount: number }[];
  /** Pre-computed analytics partitioned by view mode */
  views: {
    all: ViewData;
    realized: ViewData;
    forecast: ViewData;
  };
  /** ML-based revenue forecasts keyed by currency (Ridge Regression) */
  mlForecasts: Record<string, ForecastResult>;
}

/** Persisted user settings for the dashboard */
export interface SettingsData {
  version: 1;
  listingNames: Record<string, string>;  // listingId -> custom name
  accountNames: Record<string, string>;  // accountId -> custom name
  listingOrder: string[] | null;         // custom order, null = default (by txCount)
  accountOrder: string[] | null;         // custom order, null = default
  filterBarExpanded: boolean;
  /** Auto-refresh ML forecasts in background when the UI is idle. */
  mlForecastAutoRefresh: boolean;
  /** Keep the time quick-filter row visible when quick filters are collapsed. */
  quickFilterPinnedTime: boolean;
  /** Keep the account quick-filter row visible when quick filters are collapsed. */
  quickFilterPinnedAccounts: boolean;
  /** Keep the listing quick-filter row visible when quick filters are collapsed. */
  quickFilterPinnedListings: boolean;
  /** Show all listing quick filters even when there are many listings. */
  showAllQuickListings: boolean;
  /** Selected UI locale (optional for backward-compat with existing stored settings). */
  locale?: Locale;
}
