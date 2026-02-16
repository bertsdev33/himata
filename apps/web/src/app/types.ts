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
  | "data-quality";

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
  /** All unique listing IDs with their account */
  listings: { listingId: string; listingName: string; accountId: string }[];
  /** Pre-computed analytics partitioned by view mode */
  views: {
    all: ViewData;
    realized: ViewData;
    forecast: ViewData;
  };
}
