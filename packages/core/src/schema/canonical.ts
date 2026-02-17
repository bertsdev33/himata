/** Source platform identifier */
export type SourceSystem = "airbnb";

/** Importer format version */
export type SourceVersion = "v1";

/** Whether data comes from paid (finalized) or upcoming (forecast) exports */
export type DatasetKind = "paid" | "upcoming";

/** All possible transaction kinds from source data */
export type TransactionKind =
  | "reservation"
  | "adjustment"
  | "resolution_adjustment"
  | "cancellation_fee"
  | "payout"
  | "resolution_payout";

/** Kinds that contribute to performance metrics (non-cashflow) */
export type PerformanceKind =
  | "reservation"
  | "adjustment"
  | "resolution_adjustment"
  | "cancellation_fee";

/** Kinds that contribute to cashflow */
export type CashflowKind = "payout" | "resolution_payout";

/** Year-month string in YYYY-MM format */
export type YearMonth = `${number}-${string}`;

/** Monetary amount in minor units (cents) with currency */
export interface Money {
  /** ISO 4217 currency code, e.g. "USD" */
  currency: string;
  /** Integer cents (minor units) */
  amountMinor: number;
}

/** Identifies a listing within an account */
export interface ListingRef {
  accountId: string;
  listingName: string;
  normalizedListingName: string;
  /**
   * Deterministic listing ID:
   * `${accountId}-${slug(normalizedListingName)}-${shortHash(accountId + "::" + normalizedListingName)}`
   */
  listingId: string;
}

/** Check-in/check-out window for stay-based transactions */
export interface StayWindow {
  /** YYYY-MM-DD */
  checkInDate: string;
  /** YYYY-MM-DD (exclusive — guest departs this day) */
  checkOutDate: string;
  nights: number;
}

/** Normalized transaction from any supported importer */
export interface CanonicalTransaction {
  /** Deterministic row fingerprint */
  transactionId: string;
  source: SourceSystem;
  sourceVersion: SourceVersion;
  datasetKind: DatasetKind;
  kind: TransactionKind;
  /** YYYY-MM-DD — the date the transaction appeared in the export */
  occurredDate: string;
  /** Undefined for payout-like rows without a listing */
  listing?: ListingRef;
  /** Undefined for non-stay rows (payouts) */
  stay?: StayWindow;

  /** Net amount: from Amount (non-payout) or Paid out (payout) */
  netAmount: Money;
  /** Gross earnings fallback: Amount + Service fee */
  grossAmount: Money;
  /** Host service fee (host-positive: negated from source) */
  hostServiceFeeAmount: Money;
  /** Cleaning fee (signed as in source) */
  cleaningFeeAmount: Money;
  /** Adjustment component for adjustment-like kinds, else 0 */
  adjustmentAmount: Money;

  /** Reference back to source file and row for traceability */
  rawRowRef: { fileName: string; rowNumber: number };
}

/** Warning emitted during import */
export interface ImportWarning {
  code:
    | "MULTI_CURRENCY_PARTITIONED"
    | "MISSING_REQUIRED_FIELD"
    | "INVALID_DATE"
    | "INVALID_MONEY"
    | "UNKNOWN_TRANSACTION_TYPE"
    | "MISSING_LISTING_FOR_PERFORMANCE_ROW"
    | "DEDUPLICATED_ROW";
  message: string;
  fileName: string;
  rowNumber?: number;
}

/** Result of running an importer */
export interface ImportResult {
  transactions: CanonicalTransaction[];
  warnings: ImportWarning[];
}

/** One slice of a stay-based transaction allocated to a specific month */
export interface MonthlyAllocationSlice {
  transactionId: string;
  kind: PerformanceKind;
  accountId: string;
  listingId: string;
  month: YearMonth;
  nights: number;
  allocationRatio: number;
  allocatedGrossMinor: number;
  allocatedNetMinor: number;
  allocatedCleaningFeeMinor: number;
  allocatedServiceFeeMinor: number;
  allocatedAdjustmentMinor: number;
  currency: string;
}

/** Aggregated performance for a listing in a single month */
export interface MonthlyListingPerformance {
  month: YearMonth;
  accountId: string;
  listingId: string;
  listingName: string;
  currency: string;
  bookedNights: number;
  grossRevenueMinor: number;
  netRevenueMinor: number;
  cleaningFeesMinor: number;
  serviceFeesMinor: number;
  reservationRevenueMinor: number;
  adjustmentRevenueMinor: number;
  resolutionAdjustmentRevenueMinor: number;
  cancellationFeeRevenueMinor: number;
}

/** Aggregated performance for the entire portfolio in a single month */
export interface MonthlyPortfolioPerformance {
  month: YearMonth;
  currency: string;
  grossRevenueMinor: number;
  netRevenueMinor: number;
  bookedNights: number;
  cleaningFeesMinor: number;
  serviceFeesMinor: number;
}

/** Monthly cashflow (payouts) aggregation */
export interface MonthlyCashflow {
  month: YearMonth;
  currency: string;
  accountId?: string;
  listingId?: string;
  /** Sum of payout + resolution_payout amounts */
  payoutsMinor: number;
}

/** Comparison of current month against trailing average */
export interface TrailingComparison {
  month: YearMonth;
  metric: "netRevenueMinor" | "grossRevenueMinor";
  trailingWindowMonths: 3 | 6 | 12;
  baselineMinor: number;
  currentMinor: number;
  deltaMinor: number;
  deltaPct: number | null;
  label: string;
}

/** Estimated occupancy for a month (assumption-based) */
export interface EstimatedOccupancy {
  month: YearMonth;
  currency: string;
  bookedNights: number;
  daysInMonth: number;
  listingsInService: number;
  estimatedOccupancyRate: number | null;
  label: "Estimated Occupancy (Assumption-Based)";
  disclaimer: "booked nights / (days_in_month * listings_in_service); not true occupancy";
}

/** Range a listing is considered "in service" for occupancy calculations */
export interface ListingServiceRange {
  listingId: string;
  currency: string;
  /** YYYY-MM-DD of first observed stay start */
  firstStayStart: string;
  /** YYYY-MM-DD of last observed stay end */
  lastStayEnd: string;
}

/** Performance kinds (non-cashflow) for type guards */
export const PERFORMANCE_KINDS: readonly PerformanceKind[] = [
  "reservation",
  "adjustment",
  "resolution_adjustment",
  "cancellation_fee",
] as const;

/** Cashflow kinds for type guards */
export const CASHFLOW_KINDS: readonly CashflowKind[] = [
  "payout",
  "resolution_payout",
] as const;

/** Check if a transaction kind is performance-related */
export function isPerformanceKind(kind: TransactionKind): kind is PerformanceKind {
  return (PERFORMANCE_KINDS as readonly string[]).includes(kind);
}

/** Check if a transaction kind is cashflow-related */
export function isCashflowKind(kind: TransactionKind): kind is CashflowKind {
  return (CASHFLOW_KINDS as readonly string[]).includes(kind);
}
