/**
 * @rental-analytics/core
 *
 * Canonical schema, allocation engine, performance aggregation,
 * cashflow, trailing comparisons, and estimated occupancy.
 */

// Schema types
export type {
  SourceSystem,
  SourceVersion,
  DatasetKind,
  TransactionKind,
  PerformanceKind,
  CashflowKind,
  YearMonth,
  Money,
  ListingRef,
  StayWindow,
  CanonicalTransaction,
  ImportWarning,
  ImportResult,
  MonthlyAllocationSlice,
  MonthlyListingPerformance,
  MonthlyPortfolioPerformance,
  MonthlyCashflow,
  TrailingComparison,
  EstimatedOccupancy,
  ListingServiceRange,
} from "./schema/canonical.js";

export {
  PERFORMANCE_KINDS,
  CASHFLOW_KINDS,
  isPerformanceKind,
  isCashflowKind,
} from "./schema/canonical.js";

// Allocation engine
export {
  allocatePerformanceToMonths,
  computeNightsPerMonth,
  largestRemainderDistribute,
  toYearMonth,
  daysInMonth,
} from "./allocation.js";

// Performance aggregation
export {
  computeMonthlyListingPerformance,
  computeMonthlyPortfolioPerformance,
} from "./performance.js";

// Cashflow
export { computeMonthlyCashflow } from "./cashflow.js";

// Trailing comparisons
export { computeTrailingComparisons } from "./trailing.js";

// Occupancy
export {
  computeEstimatedOccupancy,
  inferListingServiceRanges,
} from "./occupancy.js";
